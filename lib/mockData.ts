// Isolated mock data source for the freight negotiation demo.
// Swap this module for a real API/backend later — everything else in the
// app reads only through the exported functions/constants below.

import type { CallResult, NegotiationReport, ProductSpec, SupplyChainPath } from "@/lib/types"

export const productSpecs: ProductSpec[] = [
  // Live-call ready: matches the ElevenLabs shipping agent's demo scenario.
  // No curated report — the synthetic generator supplies the comparison
  // paths, and the real negotiated ocean quote is merged in after the call.
  {
    id: "bottles-live-1",
    productName: "Stainless-Steel Drinking Bottles",
    origin: "Shenzhen, China",
    destination: "Hamburg, Germany",
    weightKg: 9500,
    palletCount: 20,
    cargoValueEur: 62000,
    readyDate: "2026-09-01",
    incoterm: "FOB",
    clientName: "Northvolt Trading GmbH",
    counterpartyName: "OceanLine Forwarding",
    counterpartyType: "freight forwarder",
    cargoDescription: "consumer goods, stainless-steel drinking bottles, non-hazardous",
    containerType: "40ft",
    cartonCount: 500,
    latestArrivalDate: "2026-10-06",
    paymentTerms: "30 days net after invoice",
    benchmarkRateUsd: 2800,
    typicalTransitDays: "30–33 days",
    competingQuotes: [
      {
        vendor: "OceanLine Forwarding",
        amountUsd: 2650,
        allIn: true,
        transitDays: 32,
        freeDays: 7,
        validityDays: 14,
      },
      {
        vendor: "TransGlobal Cargo",
        amountUsd: 2400,
        allIn: false,
        extras: "destination THC USD 280 and documentation USD 95",
        transitDays: 30,
        freeDays: 5,
      },
    ],
    specialRequirements: [],
  },
  {
    id: "herbal-drops-1",
    productName: "Herbal Immunity Drops (Glass Bottles)",
    origin: "Sofia, Bulgaria",
    destination: "Hamburg, Germany",
    weightKg: 850,
    palletCount: 4,
    cargoValueEur: 18500,
    readyDate: "2026-08-04",
    incoterm: "FCA",
    // Live-call context so Emma is available on this example too — the
    // curated report below still provides the comparison paths.
    clientName: "VitaBotanics GmbH",
    counterpartyName: "OceanLine Forwarding",
    counterpartyType: "freight forwarder",
    cargoDescription: "herbal immunity drops in glass bottles, food-grade, non-hazardous",
    paymentTerms: "30 days net after invoice",
    benchmarkRateUsd: 2400,
    typicalTransitDays: "3–5 days",
    specialRequirements: [
      "Fragile — glass bottles",
      "Temperature range 5–25°C",
      "Food-grade documentation required",
    ],
  },
]

function node(partial: Omit<CallResult, "id">, id: string): CallResult {
  return { id, ...partial }
}

// ---------------------------------------------------------------------------
// Report 1: Herbal Immunity Drops — Sofia -> Hamburg (the primary demo report)
// ---------------------------------------------------------------------------

const herbalReport: NegotiationReport = {
  productSpec: productSpecs.find((s) => s.id === "herbal-drops-1")!,
  recommendedPathId: "path-groupage-rotterdam",
  executiveSummary:
    "The Rotterdam groupage route lands at €21,050 total cost — €725 cheaper than the next best option and nearly €2,000 under the air freight route. The AI agent negotiated a €330 reduction on the Sofia-Rotterdam linehaul by bundling into an existing weekly route, and flagged an undisclosed storage escalation clause at the Rotterdam cross-dock before accepting.",
  paths: [
    {
      id: "path-direct-road",
      label: "Direct Road Freight",
      recommended: false,
      landedCostEur: 21775,
      nodes: [
        node(
          {
            nodeType: "inland_trucking",
            counterparty: "Balkan Express Logistics",
            status: "done",
            outcome: "quote",
            totalPrice: 2545,
            currency: "EUR",
            lineItems: [
              { label: "Base linehaul (Sofia → Hamburg)", amount: 2150, included: true },
              { label: "Fuel surcharge (BAF)", amount: 215, included: true },
              { label: "Temperature-controlled trailer", amount: 180, included: true },
              { label: "Waiting time / demurrage", amount: 0, included: false },
            ],
            validityDays: 10,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 2890,
              finalPrice: 2545,
              leverUsed: "Requested competitive 3-quote comparison, secured backhaul discount",
            },
            transcriptQuotes: [
              "\"If you can confirm today, I can offer the backhaul rate since we have a truck returning empty from Hamburg anyway.\"",
              "\"€2,545 all-in, fuel surcharge included, valid for 10 days.\"",
            ],
          },
          "direct-1-trucking"
        ),
        node(
          {
            nodeType: "customs_brokerage",
            counterparty: "EuroClear Customs Partners",
            status: "done",
            outcome: "quote",
            totalPrice: 320,
            currency: "EUR",
            lineItems: [
              { label: "EU internal declaration", amount: 140, included: true },
              { label: "Health/food certificate handling", amount: 130, included: true },
              { label: "Documentation admin fee", amount: 50, included: true },
            ],
            validityDays: 14,
            binding: true,
            redFlags: ["Health certificate handling fee not disclosed until the second call"],
            negotiationDelta: {
              initialPrice: 320,
              finalPrice: 320,
              leverUsed: "None — accepted published rate",
            },
            transcriptQuotes: [
              "\"Oh, I should mention — food-grade shipments also need the health certificate handled, that's an extra €130.\"",
            ],
          },
          "direct-2-customs"
        ),
        node(
          {
            nodeType: "last_mile_delivery",
            counterparty: "Hamburg CityFreight",
            status: "done",
            outcome: "quote",
            totalPrice: 410,
            currency: "EUR",
            lineItems: [
              { label: "Final delivery (pallet, ground floor)", amount: 360, included: true },
              { label: "Delivery notification / appointment booking", amount: 50, included: true },
            ],
            validityDays: 7,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 460,
              finalPrice: 410,
              leverUsed: "Requested off-peak delivery slot discount",
            },
            transcriptQuotes: [
              "\"Tuesday morning slot saves you €50 versus a fixed-time appointment.\"",
            ],
          },
          "direct-3-lastmile"
        ),
      ],
    },
    {
      id: "path-groupage-rotterdam",
      label: "Consolidated Groupage via Rotterdam",
      recommended: true,
      landedCostEur: 21050,
      nodes: [
        node(
          {
            nodeType: "inland_trucking",
            counterparty: "TransEuro Groupage",
            status: "done",
            outcome: "quote",
            totalPrice: 1450,
            currency: "EUR",
            lineItems: [
              { label: "Shared-load linehaul (Sofia → Rotterdam hub)", amount: 1280, included: true },
              { label: "Fuel surcharge (BAF)", amount: 120, included: true },
              { label: "Pallet handling at origin", amount: 50, included: true },
            ],
            validityDays: 10,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 1780,
              finalPrice: 1450,
              leverUsed: "Bundled into existing weekly Rotterdam route capacity",
            },
            transcriptQuotes: [
              "\"We already run this lane every Thursday — if your pallets fit in the remaining space, I can do €1,450 instead of a dedicated quote.\"",
            ],
          },
          "groupage-1-trucking"
        ),
        node(
          {
            nodeType: "warehousing",
            counterparty: "Rotterdam Consolidation Hub BV",
            status: "done",
            outcome: "quote",
            totalPrice: 260,
            currency: "EUR",
            lineItems: [
              { label: "Cross-dock handling", amount: 140, included: true },
              { label: "Short-term storage (up to 48h)", amount: 120, included: true },
            ],
            validityDays: 5,
            binding: false,
            redFlags: ["Storage fee escalates sharply after 48h without advance notice"],
            negotiationDelta: {
              initialPrice: 260,
              finalPrice: 260,
              leverUsed: "None — flat cross-dock rate, no room to negotiate under 1 pallet-ton",
            },
            transcriptQuotes: [
              "\"After 48 hours it jumps to €45 per pallet per day — make sure your onward truck is booked.\"",
            ],
          },
          "groupage-2-warehouse"
        ),
        node(
          {
            nodeType: "inland_trucking",
            counterparty: "NordSee Cargo",
            status: "done",
            outcome: "quote",
            totalPrice: 540,
            currency: "EUR",
            lineItems: [
              { label: "Linehaul (Rotterdam → Hamburg)", amount: 470, included: true },
              { label: "Fuel surcharge (BAF)", amount: 70, included: true },
            ],
            validityDays: 10,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 610,
              finalPrice: 540,
              leverUsed: "Matched a competing quote from Alpine-North Forwarding",
            },
            transcriptQuotes: [
              "\"Alright, I can match €540 to keep the business — just don't tell the other guy.\"",
            ],
          },
          "groupage-3-trucking"
        ),
        node(
          {
            nodeType: "customs_brokerage",
            counterparty: "EuroClear Customs Partners",
            status: "done",
            outcome: "quote",
            totalPrice: 300,
            currency: "EUR",
            lineItems: [
              { label: "EU internal declaration", amount: 140, included: true },
              { label: "Health/food certificate handling", amount: 110, included: true },
              { label: "Documentation admin fee", amount: 50, included: true },
            ],
            validityDays: 14,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 320,
              finalPrice: 300,
              leverUsed: "Repeat-customer rate applied since same broker as other paths",
            },
            transcriptQuotes: [
              "\"Since you're already a client on the other lane, I'll shave €20 off the admin fee.\"",
            ],
          },
          "groupage-4-customs"
        ),
      ],
    },
    {
      id: "path-air-express",
      label: "Air Freight Express",
      recommended: false,
      landedCostEur: 23040,
      nodes: [
        node(
          {
            nodeType: "inland_trucking",
            counterparty: "SkyLink Ground Services",
            status: "done",
            outcome: "quote",
            totalPrice: 180,
            currency: "EUR",
            lineItems: [{ label: "Sofia depot → Sofia Airport", amount: 180, included: true }],
            validityDays: 7,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 180,
              finalPrice: 180,
              leverUsed: "None — short haul, fixed rate",
            },
            transcriptQuotes: ["\"Flat €180 for airport transfer, no negotiation room on this short a leg.\""],
          },
          "air-1-trucking"
        ),
        node(
          {
            nodeType: "air_freight",
            counterparty: "AeroCargo Balkan",
            status: "done",
            outcome: "quote",
            totalPrice: 3650,
            currency: "EUR",
            lineItems: [
              { label: "Air freight base rate", amount: 2900, included: true },
              { label: "Fuel & security surcharge", amount: 450, included: true },
              { label: "Fragile cargo handling", amount: 200, included: true },
              { label: "Airway bill fee", amount: 100, included: true },
            ],
            validityDays: 5,
            binding: true,
            redFlags: ["Fragile cargo surcharge quoted verbally, missing from written contract draft"],
            negotiationDelta: {
              initialPrice: 4200,
              finalPrice: 3650,
              leverUsed: "Cited a competing offer from AeroBridge Cargo to force a re-quote",
            },
            transcriptQuotes: [
              "\"If AeroBridge really quoted €3,700, I can do €3,650 — but I need your booking confirmed by tomorrow.\"",
              "\"The €200 fragile handling fee applies, I'll send it in writing... eventually.\"",
            ],
          },
          "air-2-airfreight"
        ),
        node(
          {
            nodeType: "customs_brokerage",
            counterparty: "EuroClear Customs Partners",
            status: "done",
            outcome: "quote",
            totalPrice: 300,
            currency: "EUR",
            lineItems: [
              { label: "EU internal declaration", amount: 140, included: true },
              { label: "Health/food certificate handling", amount: 110, included: true },
              { label: "Documentation admin fee", amount: 50, included: true },
            ],
            validityDays: 14,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 300,
              finalPrice: 300,
              leverUsed: "None — repeat-customer rate already applied",
            },
            transcriptQuotes: ["\"Same rate as your other lane, €300 flat.\""],
          },
          "air-3-customs"
        ),
        node(
          {
            nodeType: "last_mile_delivery",
            counterparty: "Hamburg CityFreight",
            status: "done",
            outcome: "quote",
            totalPrice: 410,
            currency: "EUR",
            lineItems: [
              { label: "Final delivery (pallet, ground floor)", amount: 360, included: true },
              { label: "Delivery notification / appointment booking", amount: 50, included: true },
            ],
            validityDays: 7,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 410,
              finalPrice: 410,
              leverUsed: "None — already at discounted off-peak rate",
            },
            transcriptQuotes: ["\"Same crew handles this drop, €410 as before.\""],
          },
          "air-4-lastmile"
        ),
      ],
    },
    {
      id: "path-vienna-combo",
      label: "Road-Road Combo via Vienna",
      recommended: false,
      landedCostEur: 21070,
      nodes: [
        node(
          {
            nodeType: "inland_trucking",
            counterparty: "CarpathianLine Haulage",
            status: "done",
            outcome: "quote",
            totalPrice: 980,
            currency: "EUR",
            lineItems: [
              { label: "Linehaul (Sofia → Vienna)", amount: 890, included: true },
              { label: "Fuel surcharge (BAF)", amount: 90, included: true },
            ],
            validityDays: 10,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 1120,
              finalPrice: 980,
              leverUsed: "Negotiated round-trip rate against a return load from Vienna",
            },
            transcriptQuotes: [
              "\"I have a return load already lined up in Vienna, so €980 works for me.\"",
            ],
          },
          "vienna-1-trucking"
        ),
        node(
          {
            nodeType: "inland_trucking",
            counterparty: "Alpine-North Forwarding",
            status: "done",
            outcome: "quote",
            totalPrice: 1290,
            currency: "EUR",
            lineItems: [
              { label: "Linehaul (Vienna → Hamburg)", amount: 1180, included: true },
              { label: "Fuel surcharge (BAF)", amount: 110, included: true },
            ],
            validityDays: 10,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 1290,
              finalPrice: 1290,
              leverUsed: "None — single-carrier rate, no leverage on a one-off leg",
            },
            transcriptQuotes: ["\"€1,290 is already our best rate for a single-pallet-count load this size.\""],
          },
          "vienna-2-trucking"
        ),
        node(
          {
            nodeType: "customs_brokerage",
            counterparty: "Vienna TransitDocs GmbH",
            status: "done",
            outcome: "quote",
            totalPrice: 300,
            currency: "EUR",
            lineItems: [
              { label: "EU internal declaration", amount: 150, included: true },
              { label: "Health/food certificate handling", amount: 120, included: true },
              { label: "Documentation admin fee", amount: 30, included: true },
            ],
            validityDays: 14,
            binding: true,
            redFlags: ["Broker requested an upfront cash deposit, atypical for EU-internal moves"],
            negotiationDelta: {
              initialPrice: 300,
              finalPrice: 300,
              leverUsed: "None — declined deposit request but rate unchanged",
            },
            transcriptQuotes: [
              "\"We'll need a €200 deposit upfront before we file the declaration.\"",
            ],
          },
          "vienna-3-customs"
        ),
      ],
    },
  ],
}

export const negotiationReportsBySpecId: Record<string, NegotiationReport> = {
  "herbal-drops-1": herbalReport,
}

// ---------------------------------------------------------------------------
// Synthetic report generator — for any ProductSpec entered via the custom
// intake form (no curated report exists for it). Deterministic per spec
// content, so re-rendering the same shipment doesn't reshuffle numbers.
// ---------------------------------------------------------------------------

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let state = seed
  return function random() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

function roundTo(n: number, step = 5): number {
  return Math.round(n / step) * step
}

// Comparison quotes are door-to-door offers from freight forwarders /
// intermediaries who organize the whole A→B move — the counterparty type the
// live agent negotiates with, so the comparison is like-for-like.
const FORWARDER_COS = [
  "Meridian Freight Solutions",
  "CrossBridge Global Forwarding",
  "HarborLink Logistics",
  "Vantage Cargo Partners",
  "TransContinental Freight Services",
  "BlueRoute Forwarding Group",
  "AtlasGate Logistics",
]

const SERVICE_FLAVORS = ["standard service", "consolidated service", "priority service"]

const LEVERS = [
  "Beat a competing forwarder's all-in quote",
  "Bundled into an existing weekly consignment on this lane",
  "Documentation fee dropped after pushback",
  "Signalled a recurring lane for a lower rate",
]

// The one deliberately-suspicious quote every report carries: far below the
// rest, which in this market means hidden charges — not a bargain.
export const SUSPICIOUS_LOW_FLAG =
  "Quote is far below every other offer for this shipment — in this market that usually means hidden surcharges or rolled cargo, not a bargain. Treat as suspicious."

const QUOTE_POOL = [
  "\"That's our all-in door-to-door number — pickup, main leg, and delivery included.\"",
  "\"We run this lane regularly, so I can give you a package rate.\"",
  "\"Base rate plus our standard surcharges, nothing hidden on top.\"",
  "\"If you can be flexible on the pickup week, that's the rate I can hold.\"",
]

function buildForwarderQuote(
  rng: () => number,
  counterparty: string,
  totalTarget: number,
  id: string
): CallResult {
  const totalPrice = roundTo(totalTarget)
  const baseAmount = roundTo(totalPrice * (0.72 + rng() * 0.08))
  const fuelAmount = roundTo(totalPrice * (0.1 + rng() * 0.05))
  const handlingAmount = totalPrice - baseAmount - fuelAmount

  let initialPrice = totalPrice
  let leverUsed = "None — accepted standard published rate"
  if (rng() < 0.6) {
    const discount = 0.05 + rng() * 0.08
    initialPrice = roundTo(totalPrice / (1 - discount))
    leverUsed = pick(rng, LEVERS)
  }

  return {
    id,
    nodeType: "ocean_freight",
    counterparty,
    status: "done",
    outcome: "quote",
    totalPrice,
    currency: "EUR",
    lineItems: [
      { label: "Door-to-door base rate", amount: baseAmount, included: true },
      { label: "Fuel & carrier surcharges", amount: fuelAmount, included: true },
      { label: "Handling & documentation", amount: handlingAmount, included: true },
    ],
    validityDays: 10,
    binding: true,
    redFlags: [],
    negotiationDelta: {
      initialPrice,
      finalPrice: totalPrice,
      leverUsed,
    },
    transcriptQuotes: [pick(rng, QUOTE_POOL)],
  }
}

export function generateSyntheticReport(spec: ProductSpec): NegotiationReport {
  const seedKey = [spec.productName, spec.origin, spec.destination, spec.weightKg, spec.cargoValueEur, spec.incoterm].join("|")
  const rng = mulberry32(hashSeed(seedKey))

  // Rough all-in anchor for a door-to-door move of this size. When a live
  // call happens, mergeLiveResult rescales every quote around the negotiated
  // price anyway — this anchor only carries the no-call flow.
  const anchor = 900 + spec.weightKg * 0.75 + spec.palletCount * 40 + spec.cargoValueEur * 0.005

  const forwarders = [...FORWARDER_COS]
  const takeForwarder = () => forwarders.splice(Math.floor(rng() * forwarders.length), 1)[0]

  // Three credible quotes inside a ±15% band, plus one suspiciously low
  // outlier that gets flagged rather than celebrated. The outlier is never
  // the first path — that slot is replaced by the live result on merge.
  const factors = [0.9 + rng() * 0.3, 0.85 + rng() * 0.3, 0.85 + rng() * 0.3, 0.6 + rng() * 0.08]
  const outlierIndex = 1 + Math.floor(rng() * 3)
  ;[factors[outlierIndex], factors[3]] = [factors[3], factors[outlierIndex]]

  const paths: SupplyChainPath[] = factors.map((factor, i) => {
    const name = takeForwarder()
    const node = buildForwarderQuote(rng, name, anchor * factor, `syn-fwd-${i + 1}`)
    if (i === outlierIndex) node.redFlags = [SUSPICIOUS_LOW_FLAG]
    return {
      id: `synthetic-fwd-${i + 1}`,
      label: `${name} — ${pick(rng, SERVICE_FLAVORS)}`,
      recommended: false,
      landedCostEur: 0,
      nodes: [node],
    }
  })

  for (const path of paths) {
    const nodesCost = path.nodes.reduce((sum, n) => sum + n.totalPrice, 0)
    path.landedCostEur = spec.cargoValueEur + nodesCost
  }

  // The suspicious outlier is the cheapest by construction, but a flagged
  // quote is never the recommendation — cheapest clean offer wins.
  const sorted = [...paths].sort((a, b) => a.landedCostEur - b.landedCostEur)
  const clean = sorted.filter((p) => p.nodes.every((n) => n.redFlags.length === 0))
  const cheapest = clean[0] ?? sorted[0]
  const nextBest = clean[1] ?? sorted[1]
  const recommendedPathId = cheapest.id
  for (const path of paths) {
    path.recommended = path.id === recommendedPathId
  }

  const savings = nextBest ? nextBest.landedCostEur - cheapest.landedCostEur : 0

  return {
    productSpec: spec,
    paths,
    recommendedPathId,
    executiveSummary:
      `${cheapest.label} lands at the lowest credible total cost for ${spec.productName}` +
      (savings > 0 ? `, roughly €${roundTo(savings)} under the next best offer.` : ".") +
      " One quote came in far below the field and is flagged as suspicious rather than recommended.",
  }
}

export function getReportForSpec(spec: ProductSpec): NegotiationReport {
  return negotiationReportsBySpecId[spec.id] ?? generateSyntheticReport(spec)
}
