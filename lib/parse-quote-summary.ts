// Parses the structured "QUOTE SUMMARY" the shipping agent speaks as its
// final message on every call into a CallResult the results UI understands.
// The summary format is mandated by the agent's system prompt:
//
//   "QUOTE SUMMARY — Vendor: [name]. Outcome: [itemised_quote /
//   callback_commitment / declined]. Base rate: [amount]. Surcharges: [...].
//   Not included: [...]. Transit time: [days]. Next sailing: [date].
//   Free days: [...]. Payment terms: [...]. Valid until: [date].
//   Binding: [yes/no]. Missing information: [...]. Red flag: [...]."

import type { CallOutcome, CallResult, LineItem } from "@/lib/types"

export interface TranscriptLine {
  role: "agent" | "vendor"
  text: string
}

const FIELD_NAMES = [
  "Vendor",
  "Outcome",
  "Base rate",
  "Surcharges",
  "Not included",
  "Transit time",
  "Next sailing",
  "Free days",
  "Payment terms",
  "Valid until",
  "Binding",
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

function parseFirstInt(text: string | undefined): number | null {
  if (!text) return null
  const match = text.match(/(\d+)/)
  return match ? Number(match[1]) : null
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

function parseValidityDays(text: string | undefined): number {
  if (!text) return 14
  const date = new Date(text)
  if (!Number.isNaN(date.getTime())) {
    const days = Math.round((date.getTime() - Date.now()) / 86_400_000)
    if (days > 0 && days < 365) return days
  }
  return parseFirstInt(text) ?? 14
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

  if (!str("outcome") && num("base_rate") <= 0) return null

  const currency = /eur|€/i.test(str("currency")) ? "EUR" : "USD"
  const redFlag = str("red_flag")
  const summary =
    `QUOTE SUMMARY — Vendor: ${str("vendor_name") || fallbackCounterparty}. ` +
    `Outcome: ${str("outcome") || "itemised_quote"}. ` +
    `Base rate: ${currency} ${num("base_rate")}. ` +
    `Surcharges: ${str("surcharges") || "none"}. ` +
    `Not included: ${str("not_included") || "none"}. ` +
    `Transit time: ${num("transit_days") > 0 ? `${num("transit_days")} days` : "none"}. ` +
    `Next sailing: ${str("next_sailing") || "none"}. ` +
    `Free days: ${str("free_days") || "none"}. ` +
    `Payment terms: ${str("payment_terms") || "none"}. ` +
    `Valid until: ${str("valid_until") || "none"}. ` +
    `Binding: ${val("binding") === true ? "yes" : "no"}. ` +
    `Missing information: ${str("missing_information") || "none"}. ` +
    `Red flag: ${!redFlag || /^no\b/i.test(redFlag) ? "no" : `yes + ${redFlag}`}.`

  const result = parseQuoteSummary([{ role: "agent", text: summary }], fallbackCounterparty)
  if (!result) return null

  // Data collection also captures the vendor's opening rate, so unlike the
  // spoken summary we can report a real negotiation delta here.
  const initialBase = num("initial_rate")
  const finalBase = num("base_rate")
  if (initialBase > finalBase && finalBase > 0) {
    const surchargeSum = result.totalPrice - finalBase
    result.negotiationDelta = {
      initialPrice: initialBase + surchargeSum,
      finalPrice: result.totalPrice,
      leverUsed: "Live voice negotiation",
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
  const pricedText = `${fields["Base rate"] ?? ""} ${fields["Surcharges"] ?? ""}`
  const currency = /(?:EUR|€|euros?)/i.test(pricedText) && !/(?:USD|\$)/i.test(fields["Base rate"] ?? "")
    ? "EUR"
    : "USD"
  const baseAmount = parseAmount(fields["Base rate"]) ?? 0
  const surcharges = parseSurcharges(fields["Surcharges"])
  const totalPrice = baseAmount + surcharges.reduce((sum, item) => sum + item.amount, 0)

  const lineItems: LineItem[] = [
    { label: "Base freight rate", amount: baseAmount, included: true },
    ...surcharges,
  ]
  if (!isNone(fields["Not included"])) {
    for (const item of fields["Not included"]!.split(/[,;]/)) {
      const label = item.trim()
      if (label) lineItems.push({ label, amount: parseAmount(label) ?? 0, included: false })
    }
  }

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
    validityDays: parseValidityDays(fields["Valid until"]),
    binding: /^yes/i.test(fields["Binding"] ?? ""),
    redFlags,
    negotiationDelta: {
      initialPrice: totalPrice,
      finalPrice: totalPrice,
      leverUsed: "Live voice negotiation",
    },
    transcriptQuotes: vendorQuotes,
    transitDays: parseFirstInt(fields["Transit time"]) ?? undefined,
    nextSailing: isNone(fields["Next sailing"]) ? undefined : fields["Next sailing"],
    freeDays: isNone(fields["Free days"]) ? undefined : fields["Free days"],
    paymentTerms: isNone(fields["Payment terms"]) ? undefined : fields["Payment terms"],
    missingInformation,
    live: true,
  }
}
