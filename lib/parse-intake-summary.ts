// Parses the structured "SHIPMENT SPEC SUMMARY" the voice-intake secretary
// agent speaks as its final message once it has gathered every field. The
// summary format is mandated by the agent's system prompt (agent/intake-prompt.md):
//
//   "SHIPMENT SPEC SUMMARY — Product: [name]. Origin: [city]. Destination:
//   [city]. Weight: [kg] kg. Pallets: [count]. Cargo value: [amount] EUR.
//   Ready date: [date]. Client: [company or 'not specified']. Cargo
//   description: [text or 'not specified']. Latest arrival: [date or 'not
//   specified']. Payment terms: [text or 'not specified']. Benchmark rate:
//   [amount] USD or 'not specified'. Typical transit: [text or 'not
//   specified']."
//
// A second layer (parseIntakeFromDataCollection) covers agents configured
// with ElevenLabs' post-call Data Collection instead of — or in addition to
// — a spoken summary, mirroring the dual-layer approach in
// parse-quote-summary.ts for the negotiation agent.

import type { ProductSpec } from "@/lib/types"

export interface IntakeTranscriptLine {
  role: "agent" | "user"
  text: string
}

const FIELD_NAMES = [
  "Product",
  "Origin",
  "Destination",
  "Weight",
  "Pallets",
  "Cargo value",
  "Ready date",
  "Client",
  "Cargo description",
  "Latest arrival",
  "Payment terms",
  "Benchmark rate",
  "Typical transit",
] as const

type FieldName = (typeof FIELD_NAMES)[number]

function extractFields(summary: string): Partial<Record<FieldName, string>> {
  const fields: Partial<Record<FieldName, string>> = {}
  const lookahead = FIELD_NAMES.join("|")
  for (const name of FIELD_NAMES) {
    const re = new RegExp(`${name}\\s*:\\s*([\\s\\S]*?)(?=(?:${lookahead})\\s*:|$)`, "i")
    const match = summary.match(re)
    if (match) fields[name] = match[1].trim().replace(/[.\s]+$/, "")
  }
  return fields
}

function parseNumber(text: string | undefined): number {
  if (!text) return 0
  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/)
  return match ? Math.round(Number(match[1])) : 0
}

function isNone(text: string | undefined): boolean {
  return !text || /^(none|n\/a|unknown|-|not[\s-]?specified|not[\s-]?given|not[\s-]?provided)$/i.test(text.trim())
}

function parseIsoDate(text: string | undefined): string | undefined {
  if (!text || isNone(text)) return undefined
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().slice(0, 10)
}

function fieldsToSpec(fields: Partial<Record<FieldName, string>>): Partial<ProductSpec> | null {
  if (isNone(fields["Product"]) || isNone(fields["Origin"]) || isNone(fields["Destination"])) {
    return null
  }

  return {
    productName: fields["Product"],
    origin: fields["Origin"],
    destination: fields["Destination"],
    weightKg: parseNumber(fields["Weight"]),
    palletCount: parseNumber(fields["Pallets"]),
    cargoValueEur: parseNumber(fields["Cargo value"]),
    readyDate: parseIsoDate(fields["Ready date"]),
    clientName: isNone(fields["Client"]) ? undefined : fields["Client"],
    cargoDescription: isNone(fields["Cargo description"]) ? undefined : fields["Cargo description"],
    latestArrivalDate: parseIsoDate(fields["Latest arrival"]),
    paymentTerms: isNone(fields["Payment terms"]) ? undefined : fields["Payment terms"],
    benchmarkRateUsd: isNone(fields["Benchmark rate"]) ? undefined : parseNumber(fields["Benchmark rate"]),
    typicalTransitDays: isNone(fields["Typical transit"]) ? undefined : fields["Typical transit"],
  }
}

/** Find the SHIPMENT SPEC SUMMARY block in a transcript, searching from the end. */
export function findIntakeSummary(lines: IntakeTranscriptLine[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].role === "agent" && /SHIPMENT SPEC SUMMARY/i.test(lines[i].text)) {
      return lines[i].text.slice(lines[i].text.search(/SHIPMENT SPEC SUMMARY/i))
    }
  }
  return null
}

export function parseIntakeSummary(lines: IntakeTranscriptLine[]): Partial<ProductSpec> | null {
  const summary = findIntakeSummary(lines)
  if (!summary) return null
  return fieldsToSpec(extractFields(summary))
}

// Post-call data collection results from ElevenLabs analysis — extracted by
// the platform from the full transcript, so they exist even when the agent
// never spoke the structured summary (as with the currently deployed
// Secretary agent, which gathers every field conversationally but never
// recites them back in a parseable format). Configure a Data Collection item
// per field below in the ElevenLabs dashboard for this to kick in.
export type DataCollectionResults = Record<string, { value?: unknown } | undefined>

export function parseIntakeFromDataCollection(dc: DataCollectionResults): Partial<ProductSpec> | null {
  const val = (k: string) => dc[k]?.value
  const str = (k: string) => {
    const s = val(k)
    return typeof s === "string" ? s.trim() : ""
  }
  const num = (k: string) => {
    const n = Number(val(k))
    return Number.isFinite(n) ? n : 0
  }

  if (!str("product_name") || !str("origin") || !str("destination")) return null

  return {
    productName: str("product_name"),
    origin: str("origin"),
    destination: str("destination"),
    weightKg: num("weight_kg"),
    palletCount: num("pallet_count"),
    cargoValueEur: num("cargo_value_eur"),
    readyDate: parseIsoDate(str("ready_date")),
    clientName: str("client_name") || undefined,
    cargoDescription: str("cargo_description") || undefined,
    latestArrivalDate: parseIsoDate(str("latest_arrival_date")),
    paymentTerms: str("payment_terms") || undefined,
    benchmarkRateUsd: str("benchmark_rate_usd") ? num("benchmark_rate_usd") : undefined,
    typicalTransitDays: str("typical_transit_days") || undefined,
  }
}
