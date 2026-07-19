// Parses the structured "QUOTE SUMMARY" the shipping agent speaks as its
// final message on every call into a CallResult the results UI understands.
// The summary format is mandated by the agent's system prompt:
//
//   "QUOTE SUMMARY — Vendor: [name]. Outcome: [quote / callback_commitment /
//   declined]. Base rate: [amount]. Typical surcharges: [category and amount,
//   each]. Realistic all-in: [amount]. Maximum all-in: [amount — driven by
//   what]. Negotiated improvement: [what got better, or 'none']. Also
//   mentioned: [volunteered details, or 'none']. Missing information: [...].
//   Red flag: [yes + reason / no]."

import type { CallOutcome, CallResult, LineItem } from "@/lib/types"

export interface TranscriptLine {
  role: "agent" | "vendor"
  text: string
}

const FIELD_NAMES = [
  "Vendor",
  "Outcome",
  "Base rate",
  "Typical surcharges",
  "Realistic all-in",
  "Maximum all-in",
  "Negotiated improvement",
  "Also mentioned",
  "Missing information",
  "Red flag",
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

function parseAmount(text: string | undefined): number | null {
  if (!text) return null
  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/)
  return match ? Math.round(Number(match[1])) : null
}

function isNone(text: string | undefined): boolean {
  return !text || /^(none|n\/a|nothing|-|no)$/i.test(text.trim())
}

function parseOutcome(text: string | undefined): CallOutcome {
  if (!text) return "quote"
  if (/callback/i.test(text)) return "callback"
  if (/declin/i.test(text)) return "decline"
  return "quote"
}

// "fuel/BAF USD 200, destination THC USD 280" -> one LineItem per segment.
function parseSurcharges(text: string | undefined): LineItem[] {
  if (isNone(text)) return []
  return text!
    .split(/[,;]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const amount = parseAmount(segment) ?? 0
      const label = segment
        .replace(/(?:USD|EUR|\$|€)\s*[\d,.]+/gi, "")
        .replace(/[\d,.]+\s*(?:USD|EUR|dollars?|euros?)/gi, "")
        .replace(/\s{2,}/g, " ")
        .replace(/[:\-–]\s*$/, "")
        .trim()
      return { label: label || "Surcharge", amount, included: true }
    })
}

/** Find the QUOTE SUMMARY block in a transcript, searching from the end. */
export function findQuoteSummary(lines: TranscriptLine[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].role === "agent" && /QUOTE SUMMARY/i.test(lines[i].text)) {
      return lines[i].text.slice(lines[i].text.search(/QUOTE SUMMARY/i))
    }
  }
  return null
}

// Post-call data collection results from ElevenLabs analysis — extracted by
// the platform from the full transcript, so they exist even when the agent
// never spoke its structured summary. We synthesize a canonical summary
// string from them and reuse the same parser for a single code path.
export type DataCollectionResults = Record<string, { value?: unknown } | undefined>

export function parseFromDataCollection(
  dc: DataCollectionResults,
  fallbackCounterparty: string
): CallResult | null {
  const val = (k: string) => dc[k]?.value
  const num = (k: string) => {
    const n = Number(val(k))
    return Number.isFinite(n) ? n : 0
  }
  const str = (k: string) => {
    const s = val(k)
    return typeof s === "string" ? s.trim() : ""
  }

  if (!str("outcome") && num("base_rate") <= 0 && num("realistic_all_in") <= 0) return null

  const currency = /eur|€/i.test(str("currency")) ? "EUR" : "USD"
  const redFlag = str("red_flag")
  const surcharges = str("typical_surcharges") || str("surcharges")
  const summary =
    `QUOTE SUMMARY — Vendor: ${str("vendor_name") || fallbackCounterparty}. ` +
    `Outcome: ${str("outcome") || "quote"}. ` +
    `Base rate: ${currency} ${num("base_rate")}. ` +
    `Typical surcharges: ${surcharges || "none"}. ` +
    `Realistic all-in: ${num("realistic_all_in") > 0 ? `${currency} ${num("realistic_all_in")}` : "none"}. ` +
    `Maximum all-in: ${num("maximum_all_in") > 0 ? `${currency} ${num("maximum_all_in")}${str("maximum_drivers") ? ` — driven by ${str("maximum_drivers")}` : ""}` : "none"}. ` +
    `Negotiated improvement: ${str("negotiated_improvement") || "none"}. ` +
    `Also mentioned: ${str("also_mentioned") || "none"}. ` +
    `Missing information: ${str("missing_information") || "none"}. ` +
    `Red flag: ${!redFlag || /^no\b/i.test(redFlag) ? "no" : `yes + ${redFlag}`}.`

  const result = parseQuoteSummary([{ role: "agent", text: summary }], fallbackCounterparty)
  if (!result) return null

  // Data collection also captures the vendor's opening rate, so unlike the
  // spoken summary we can report a real negotiation delta here.
  const initialBase = num("initial_rate")
  const finalBase = num("base_rate")
  if (initialBase > finalBase && finalBase > 0) {
    const delta = initialBase - finalBase
    result.negotiationDelta = {
      initialPrice: result.totalPrice + delta,
      finalPrice: result.totalPrice,
      leverUsed: result.negotiatedImprovement ?? "Live voice negotiation",
    }
  }
  return result
}

export function parseQuoteSummary(
  lines: TranscriptLine[],
  fallbackCounterparty: string
): CallResult | null {
  const summary = findQuoteSummary(lines)
  if (!summary) return null

  const fields = extractFields(summary)
  // The agent negotiates in whatever currency the vendor quotes; detect EUR
  // from the priced fields, defaulting to USD (the benchmark currency).
  const pricedText = `${fields["Base rate"] ?? ""} ${fields["Typical surcharges"] ?? ""} ${fields["Realistic all-in"] ?? ""}`
  const currency = /(?:EUR|€|euros?)/i.test(pricedText) && !/(?:USD|\$)/i.test(fields["Base rate"] ?? "")
    ? "EUR"
    : "USD"
  const baseAmount = parseAmount(fields["Base rate"]) ?? 0
  const surcharges = parseSurcharges(fields["Typical surcharges"])
  const surchargeSum = surcharges.reduce((sum, item) => sum + item.amount, 0)
  // The realistic all-in estimate is the number the whole call is after; the
  // itemised sum only stands in when the forwarder never gave one.
  const realisticAllIn = isNone(fields["Realistic all-in"]) ? null : parseAmount(fields["Realistic all-in"])
  const totalPrice = realisticAllIn ?? baseAmount + surchargeSum

  const maxField = isNone(fields["Maximum all-in"]) ? undefined : fields["Maximum all-in"]
  const maxTotalPrice = parseAmount(maxField) ?? undefined
  const maxPriceDrivers = maxField?.match(/driven by\s*(.+)$/i)?.[1]?.trim()

  const negotiatedImprovement = isNone(fields["Negotiated improvement"])
    ? undefined
    : fields["Negotiated improvement"]
  const alsoMentioned = isNone(fields["Also mentioned"]) ? undefined : fields["Also mentioned"]

  const lineItems: LineItem[] = [
    { label: "Base freight rate", amount: baseAmount, included: true },
    ...surcharges,
  ]

  const redFlagText = fields["Red flag"]
  const redFlags =
    redFlagText && /^yes/i.test(redFlagText)
      ? [redFlagText.replace(/^yes\s*[+:\-–]?\s*/i, "") || "Quote flagged as suspiciously low"]
      : []

  const missingInformation = isNone(fields["Missing information"])
    ? []
    : fields["Missing information"]!.split(/[;]/).map((s) => s.trim()).filter(Boolean)

  // The summary states final numbers only; without a reliable opening price
  // we report no delta rather than invent one.
  const vendorQuotes = lines
    .filter((l) => l.role === "vendor" && /\d/.test(l.text) && l.text.length < 160)
    .slice(-2)
    .map((l) => `"${l.text}"`)

  return {
    id: `live-${Date.now()}`,
    nodeType: "ocean_freight",
    counterparty: fields["Vendor"] || fallbackCounterparty,
    status: "done",
    outcome: parseOutcome(fields["Outcome"]),
    totalPrice,
    currency,
    lineItems,
    validityDays: 14,
    binding: false,
    redFlags,
    negotiationDelta: {
      initialPrice: totalPrice,
      finalPrice: totalPrice,
      leverUsed: negotiatedImprovement ?? "Live voice negotiation",
    },
    transcriptQuotes: vendorQuotes,
    maxTotalPrice,
    maxPriceDrivers,
    negotiatedImprovement,
    alsoMentioned,
    missingInformation,
    live: true,
  }
}
