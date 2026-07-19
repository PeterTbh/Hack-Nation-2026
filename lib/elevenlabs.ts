// Maps a ProductSpec to the dynamic variables the ElevenLabs shipping
// negotiator agent ("Emma") expects. Every templated section of the dashboard
// prompt — SHIPMENT SPEC and MARKET CONTEXT included — is fed from here, so
// the agent negotiates the shipment the user actually entered.
//
// The agent's honesty rules mean it can only cite numbers we pass in:
// benchmark, red-flag threshold, and competing quotes are composed here and
// must come from real user input, never invented defaults at call time.

import type { CompetingQuote, ProductSpec } from "@/lib/types"

const DEFAULT_LEVERS =
  "competing quotes, all-in pricing, surcharge reduction, free days, recurring volume"

function formatUsd(amount: number): string {
  return `USD ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)}`
}

function formatLongDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function containerAndVolume(spec: ProductSpec): string {
  const weight = `~${new Intl.NumberFormat("en-US").format(spec.weightKg)} kg gross`
  const cartons = spec.cartonCount ? `approx. ${spec.cartonCount} cartons, ` : ""
  if (spec.containerType === "LCL") {
    return `LCL shipment, ${cartons}${spec.palletCount} pallets, ${weight}`
  }
  const box = spec.containerType ?? "40ft"
  return `1x ${box} standard container (FCL), ${cartons}${weight}`
}

function incotermContext(spec: ProductSpec): string {
  switch (spec.incoterm) {
    case "EXW":
      return "purchased EXW — we arrange and pay for everything from the seller's door onward, including origin charges, ocean freight, and destination charges"
    case "DDP":
      return "selling DDP — we cover the full chain door-to-door including destination customs; quote must reflect that"
    case "CIF":
      return "purchased CIF — seller covers freight and insurance to destination port; we pay destination charges onward"
    case "FCA":
      return "purchased FCA — seller delivers to the carrier at origin; we pay main carriage and destination charges"
    case "FOB":
    default:
      return "purchased FOB origin port — freight and origin THC handled by seller; we pay ocean freight and destination charges"
  }
}

function competingQuoteLine(quote: CompetingQuote, label: string): string {
  const parts: string[] = []
  parts.push(
    quote.allIn
      ? `${formatUsd(quote.amountUsd)} all-in`
      : `${formatUsd(quote.amountUsd)} base rate${quote.extras ? ` PLUS ${quote.extras}` : ""}`
  )
  if (quote.transitDays) parts.push(`${quote.transitDays} days transit`)
  if (quote.freeDays) parts.push(`${quote.freeDays} free days at destination`)
  if (quote.validityDays) parts.push(`valid ${quote.validityDays} days`)
  return `- Competing quote ${label}: ${quote.vendor} — ${parts.join(", ")}`
}

export function buildCompetingQuotesBlock(quotes: CompetingQuote[] | undefined): string {
  if (!quotes || quotes.length === 0) {
    return "- No competing quotes are on hand for this shipment. Do not reference any competing quote; rely on the other negotiation levers."
  }
  const labels = ["A", "B", "C", "D"]
  const lines = quotes.map((q, i) => competingQuoteLine(q, labels[i] ?? String(i + 1)))
  lines.push(
    "- Note: always compare effective all-in totals, not base rates — a lower base rate with open surcharges can cost more."
  )
  return lines.join("\n")
}

export type DynamicVariables = Record<string, string | number | boolean>

export function buildDynamicVariables(spec: ProductSpec): DynamicVariables {
  const benchmark = spec.benchmarkRateUsd ?? 0
  return {
    client_name: spec.clientName ?? "the client",
    language: spec.language ?? "English",
    counterparty_name: spec.counterpartyName ?? "the vendor",
    counterparty_type: spec.counterpartyType ?? "freight forwarder",
    origin_port: spec.origin ?? "",
    destination_port: spec.destination ?? "",
    cargo_ready_date: formatLongDate(spec.readyDate),
    cargo_description: spec.cargoDescription ?? spec.productName,
    container_and_volume: containerAndVolume(spec),
    incoterm_context: incotermContext(spec),
    latest_arrival: spec.latestArrivalDate ? formatLongDate(spec.latestArrivalDate) : "no hard deadline communicated",
    payment_terms: spec.paymentTerms ?? "30 days net after invoice",
    benchmark_rate: benchmark > 0 ? formatUsd(benchmark) : "no benchmark available",
    red_flag_threshold:
      benchmark > 0 ? formatUsd(Math.round(benchmark * 0.7)) : "not applicable (no benchmark)",
    typical_transit: spec.typicalTransitDays ?? "not known for this route",
    competing_quotes: buildCompetingQuotesBlock(spec.competingQuotes),
    negotiation_levers: DEFAULT_LEVERS,
  }
}
