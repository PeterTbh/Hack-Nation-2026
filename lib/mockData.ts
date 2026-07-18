// Isolated mock data source for the freight negotiation demo.
// Swap this module for a real API/backend later — everything else in the
// app reads only through the exported functions/constants below.

import type { CallResult, NegotiationReport, ProductSpec, SupplyChainPath } from "@/lib/types"

export const productSpecs: ProductSpec[] = [
  {
    id: "herbal-drops-1",
    mode: "transport",
    productName: "Herbal Immunity Drops (Glass Bottles)",
    origin: "Sofia, Bulgaria",
    destination: "Hamburg, Germany",
    weightKg: 850,
    palletCount: 4,
    cargoValueEur: 18500,
    readyDate: "2026-08-04",
    incoterm: "FCA",
    specialRequirements: [
      "Fragile — glass bottles",
      "Temperature range 5–25°C",
      "Food-grade documentation required",
    ],
  },
  {
    id: "cnc-parts-1",
    mode: "sourcing_transport",
    productName: "Precision CNC Machine Parts",
    destination: "Rotterdam, Netherlands",
    weightKg: 12400,
    palletCount: 18,
    cargoValueEur: 210000,
    readyDate: "2026-08-18",
    productSpecifications:
      "Precision-machined aluminum housings, ISO 9001 certified factory, anti-corrosion coating, oversized crates (>2.4m).",
    specialRequirements: ["Oversized crates (>2.4m)", "Anti-corrosion wrap", "Insurance mandatory"],
  },
  {
    id: "matcha-sourcing-1",
    mode: "sourcing",
    productName: "Ceremonial Matcha Powder (Private Label)",
    weightKg: 500,
    palletCount: 2,
    cargoValueEur: 12000,
    readyDate: "2026-09-10",
    productSpecifications:
      "Ceremonial grade, EU-organic certified, stone-ground, custom private-label pouch packaging.",
    neededByDate: "2026-09-20",
    specialRequirements: [],
  },
]

function node(partial: Omit<CallResult, "id">, id: string): CallResult {
  return { id, ...partial }
}

// ---------------------------------------------------------------------------
// Report 1: Herbal Immunity Drops — Sofia -> Hamburg (the primary demo report)
// ---------------------------------------------------------------------------

const herbalReport: NegotiationReport = {
  productSpec: productSpecs[0],
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

// ---------------------------------------------------------------------------
// Report 2: Precision CNC Machine Parts — sourcing_transport (Rotterdam only,
// origin left open — the agent evaluates factories AND their shipping together)
// ---------------------------------------------------------------------------

const sourcingTransportReport: NegotiationReport = {
  productSpec: productSpecs[1],
  recommendedPathId: "path-ocean-lcl",
  executiveSummary:
    "Ningbo Metal Fabrication + Ocean LCL lands at €196,740 total cost — €7,060 under the Shenzhen FCL option and €19,410 under sourcing from Vietnam with air freight. The agent evaluated three factories and their onward shipping as one decision, not two separate bids.",
  paths: [
    {
      id: "path-ocean-fcl",
      label: "Shenzhen Factory + Standard Ocean FCL",
      recommended: false,
      landedCostEur: 203800,
      nodes: [
        node(
          {
            nodeType: "sourcing",
            counterparty: "Shenzhen Precision Works",
            status: "done",
            outcome: "quote",
            totalPrice: 198500,
            currency: "EUR",
            lineItems: [
              { label: "Unit production cost (full order)", amount: 191000, included: true },
              { label: "Tooling & QC setup", amount: 7500, included: true },
            ],
            validityDays: 30,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 208000,
              finalPrice: 198500,
              leverUsed: "Committed to a repeat-order schedule for a lower unit price",
            },
            transcriptQuotes: [
              "\"If you commit to two more runs this year, I can bring the unit price down to €198,500 total.\"",
            ],
          },
          "fcl-0-sourcing"
        ),
        node(
          {
            nodeType: "inland_trucking",
            counterparty: "PearlRiver Trucking Co.",
            status: "done",
            outcome: "quote",
            totalPrice: 480,
            currency: "EUR",
            lineItems: [
              { label: "Factory → Yantian port drayage", amount: 420, included: true },
              { label: "Port entry fee", amount: 60, included: true },
            ],
            validityDays: 14,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 480,
              finalPrice: 480,
              leverUsed: "None — fixed drayage tariff",
            },
            transcriptQuotes: ["\"Drayage is a flat €480, that one doesn't move.\""],
          },
          "fcl-1-trucking"
        ),
        node(
          {
            nodeType: "ocean_freight",
            counterparty: "OceanLink Shipping",
            status: "done",
            outcome: "quote",
            totalPrice: 4200,
            currency: "EUR",
            lineItems: [
              { label: "Ocean freight base (2x 40ft FCL)", amount: 3200, included: true },
              { label: "Bunker adjustment factor (BAF)", amount: 420, included: true },
              { label: "Terminal handling charge — origin", amount: 280, included: true },
              { label: "Terminal handling charge — destination", amount: 300, included: true },
            ],
            validityDays: 21,
            binding: true,
            redFlags: ["Destination THC quoted separately, after the contract draft was already signed"],
            negotiationDelta: {
              initialPrice: 4950,
              finalPrice: 4200,
              leverUsed: "Committed to a 12-month volume contract for a reduced FCL rate",
            },
            transcriptQuotes: [
              "\"Lock in 12 months of volume and I can get you €4,200 instead of the spot rate.\"",
              "\"Ah, destination THC — that's billed separately at the Rotterdam terminal, around €300.\"",
            ],
          },
          "fcl-2-ocean"
        ),
        node(
          {
            nodeType: "customs_brokerage",
            counterparty: "RotterdamGate Customs",
            status: "done",
            outcome: "quote",
            totalPrice: 620,
            currency: "EUR",
            lineItems: [
              { label: "Import declaration", amount: 260, included: true },
              { label: "HS classification review", amount: 180, included: true },
              { label: "VAT deferment license fee", amount: 180, included: true },
            ],
            validityDays: 30,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 680,
              finalPrice: 620,
              leverUsed: "Requested bundled rate across classification + declaration",
            },
            transcriptQuotes: ["\"Bundle the classification review with the declaration and I'll knock off €60.\""],
          },
          "fcl-3-customs"
        ),
      ],
    },
    {
      id: "path-ocean-lcl",
      label: "Ningbo Factory + Ocean LCL Consolidated",
      recommended: true,
      landedCostEur: 196740,
      nodes: [
        node(
          {
            nodeType: "sourcing",
            counterparty: "Ningbo Metal Fabrication Co.",
            status: "done",
            outcome: "quote",
            totalPrice: 192000,
            currency: "EUR",
            lineItems: [
              { label: "Unit production cost (full order)", amount: 184500, included: true },
              { label: "Tooling & QC setup", amount: 7500, included: true },
            ],
            validityDays: 30,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 201000,
              finalPrice: 192000,
              leverUsed: "Beat the Shenzhen factory's quote by sharing it directly",
            },
            transcriptQuotes: [
              "\"Send me their number and I'll come in under it — €192,000 all-in.\"",
            ],
          },
          "lcl-0-sourcing"
        ),
        node(
          {
            nodeType: "inland_trucking",
            counterparty: "PearlRiver Trucking Co.",
            status: "done",
            outcome: "quote",
            totalPrice: 480,
            currency: "EUR",
            lineItems: [
              { label: "Factory → Yantian port drayage", amount: 420, included: true },
              { label: "Port entry fee", amount: 60, included: true },
            ],
            validityDays: 14,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 480,
              finalPrice: 480,
              leverUsed: "None — fixed drayage tariff",
            },
            transcriptQuotes: ["\"Same drayage rate regardless of FCL or LCL, €480.\""],
          },
          "lcl-1-trucking"
        ),
        node(
          {
            nodeType: "ocean_freight",
            counterparty: "ConsolFreight Asia",
            status: "done",
            outcome: "quote",
            totalPrice: 3100,
            currency: "EUR",
            lineItems: [
              { label: "LCL freight (per CBM, consolidated)", amount: 2650, included: true },
              { label: "Bunker adjustment factor (BAF)", amount: 280, included: true },
              { label: "Documentation fee", amount: 170, included: true },
            ],
            validityDays: 21,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 3400,
              finalPrice: 3100,
              leverUsed: "Matched a competing per-CBM rate quote from ShareCargo",
            },
            transcriptQuotes: [
              "\"If ShareCargo really quoted that per-CBM rate, I'll match it at €3,100.\"",
            ],
          },
          "lcl-2-ocean"
        ),
        node(
          {
            nodeType: "warehousing",
            counterparty: "Maasvlakte Distribution Center",
            status: "done",
            outcome: "quote",
            totalPrice: 540,
            currency: "EUR",
            lineItems: [
              { label: "Deconsolidation handling", amount: 320, included: true },
              { label: "Re-palletizing", amount: 120, included: true },
              { label: "Short-term storage (up to 5 days)", amount: 100, included: true },
            ],
            validityDays: 10,
            binding: false,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 540,
              finalPrice: 540,
              leverUsed: "None — flat deconsolidation package rate",
            },
            transcriptQuotes: ["\"Deconsolidation package is €540 flat, covers up to 5 days storage.\""],
          },
          "lcl-3-warehouse"
        ),
        node(
          {
            nodeType: "customs_brokerage",
            counterparty: "RotterdamGate Customs",
            status: "done",
            outcome: "quote",
            totalPrice: 620,
            currency: "EUR",
            lineItems: [
              { label: "Import declaration", amount: 260, included: true },
              { label: "HS classification review", amount: 180, included: true },
              { label: "VAT deferment license fee", amount: 180, included: true },
            ],
            validityDays: 30,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 680,
              finalPrice: 620,
              leverUsed: "Same bundled rate as the FCL quote, applied consistently",
            },
            transcriptQuotes: ["\"Same bundled classification + declaration rate, €620.\""],
          },
          "lcl-4-customs"
        ),
      ],
    },
    {
      id: "path-air-expedite",
      label: "Ho Chi Minh Factory + Air Freight Expedite",
      recommended: false,
      landedCostEur: 216150,
      nodes: [
        node(
          {
            nodeType: "sourcing",
            counterparty: "Ho Chi Minh Precision Manufacturing",
            status: "done",
            outcome: "quote",
            totalPrice: 205000,
            currency: "EUR",
            lineItems: [
              { label: "Unit production cost (full order)", amount: 197000, included: true },
              { label: "Tooling & QC setup", amount: 8000, included: true },
            ],
            validityDays: 21,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 215000,
              finalPrice: 205000,
              leverUsed: "Traded faster turnaround commitment for a lower tooling fee",
            },
            transcriptQuotes: [
              "\"We can turn this around two weeks faster — €205,000 all-in if you confirm this week.\"",
            ],
          },
          "air-cnc-0-sourcing"
        ),
        node(
          {
            nodeType: "inland_trucking",
            counterparty: "Mekong Ground Services",
            status: "done",
            outcome: "quote",
            totalPrice: 300,
            currency: "EUR",
            lineItems: [{ label: "Factory → Tan Son Nhat Airport drayage", amount: 300, included: true }],
            validityDays: 14,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 300,
              finalPrice: 300,
              leverUsed: "None — fixed short-haul tariff",
            },
            transcriptQuotes: ["\"Flat €300 to the airport, no room to move there.\""],
          },
          "air-cnc-1-trucking"
        ),
        node(
          {
            nodeType: "air_freight",
            counterparty: "IndoChina Air Cargo",
            status: "done",
            outcome: "quote",
            totalPrice: 9800,
            currency: "EUR",
            lineItems: [
              { label: "Air freight base rate", amount: 8600, included: true },
              { label: "Fuel & security surcharge", amount: 900, included: true },
              { label: "Oversized crate handling", amount: 300, included: true },
            ],
            validityDays: 5,
            binding: true,
            redFlags: ["Fuel surcharge index not locked — subject to change until actual departure"],
            negotiationDelta: {
              initialPrice: 11200,
              finalPrice: 9800,
              leverUsed: "Requested a spot-rate re-quote after showing a competing carrier's offer",
            },
            transcriptQuotes: [
              "\"Show me their number and I'll try to beat it... okay, €9,800.\"",
              "\"Just know the fuel index isn't locked until you actually depart.\"",
            ],
          },
          "air-cnc-2-airfreight"
        ),
        node(
          {
            nodeType: "customs_brokerage",
            counterparty: "Schiphol Import Services",
            status: "done",
            outcome: "quote",
            totalPrice: 640,
            currency: "EUR",
            lineItems: [
              { label: "Import declaration", amount: 280, included: true },
              { label: "HS classification review", amount: 190, included: true },
              { label: "VAT deferment license fee", amount: 170, included: true },
            ],
            validityDays: 30,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 640,
              finalPrice: 640,
              leverUsed: "None — standard airport clearance rate",
            },
            transcriptQuotes: ["\"€640 standard clearance, nothing unusual on this shipment.\""],
          },
          "air-cnc-3-customs"
        ),
        node(
          {
            nodeType: "last_mile_delivery",
            counterparty: "BeNeLux Distribution",
            status: "done",
            outcome: "quote",
            totalPrice: 410,
            currency: "EUR",
            lineItems: [
              { label: "Schiphol → Rotterdam delivery", amount: 360, included: true },
              { label: "Oversized crate offloading", amount: 50, included: true },
            ],
            validityDays: 7,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 460,
              finalPrice: 410,
              leverUsed: "Requested off-peak delivery slot discount",
            },
            transcriptQuotes: ["\"Off-peak slot brings it down to €410.\""],
          },
          "air-cnc-4-lastmile"
        ),
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Report 3: Ceremonial Matcha Powder — pure sourcing (no destination/transport
// negotiated yet; the agent is calling candidate suppliers/factories only)
// ---------------------------------------------------------------------------

const sourcingReport: NegotiationReport = {
  productSpec: productSpecs[2],
  recommendedPathId: "path-uji-collective",
  executiveSummary:
    "Uji Green Collective lands at €10,780 total procurement cost — €740 under the Kagoshima co-op and €2,950 under the import broker option. The agent negotiated the private-label packaging fee down separately from the raw matcha cost with each supplier.",
  paths: [
    {
      id: "path-kagoshima-coop",
      label: "Kagoshima Family Farm Co-op",
      recommended: false,
      landedCostEur: 11520,
      nodes: [
        node(
          {
            nodeType: "sourcing",
            counterparty: "Kagoshima Family Farm Co-op",
            status: "done",
            outcome: "quote",
            totalPrice: 9800,
            currency: "EUR",
            lineItems: [
              { label: "Ceremonial-grade matcha, stone-ground (500kg)", amount: 9200, included: true },
              { label: "Organic certification transfer fee", amount: 600, included: true },
            ],
            validityDays: 21,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 10600,
              finalPrice: 9800,
              leverUsed: "Committed to next season's harvest for a lower per-kg rate",
            },
            transcriptQuotes: [
              "\"If you commit to next season too, I can do €9,800 for this batch.\"",
            ],
          },
          "kag-1-sourcing"
        ),
        node(
          {
            nodeType: "sourcing",
            counterparty: "Kyoto Pack & Label Studio",
            status: "done",
            outcome: "quote",
            totalPrice: 1720,
            currency: "EUR",
            lineItems: [
              { label: "Custom private-label pouches (design + print)", amount: 1200, included: true },
              { label: "Fill & seal run", amount: 520, included: true },
            ],
            validityDays: 14,
            binding: true,
            redFlags: ["Design proof revisions billed separately after the second round"],
            negotiationDelta: {
              initialPrice: 1950,
              finalPrice: 1720,
              leverUsed: "Bundled fill-and-seal with the design run for a package rate",
            },
            transcriptQuotes: [
              "\"Bundle the fill-and-seal with the design run and it's €1,720 total.\"",
              "\"Just know revisions past round two are billed separately.\"",
            ],
          },
          "kag-2-packaging"
        ),
      ],
    },
    {
      id: "path-uji-collective",
      label: "Uji Green Collective",
      recommended: true,
      landedCostEur: 10780,
      nodes: [
        node(
          {
            nodeType: "sourcing",
            counterparty: "Uji Green Collective",
            status: "done",
            outcome: "quote",
            totalPrice: 9200,
            currency: "EUR",
            lineItems: [
              { label: "Ceremonial-grade matcha, stone-ground (500kg)", amount: 8750, included: true },
              { label: "Organic certification transfer fee", amount: 450, included: true },
            ],
            validityDays: 21,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 9900,
              finalPrice: 9200,
              leverUsed: "Matched the Kagoshima co-op's quote and beat it slightly",
            },
            transcriptQuotes: [
              "\"I heard Kagoshima quoted €9,800 — I can do €9,200 for the same volume.\"",
            ],
          },
          "uji-1-sourcing"
        ),
        node(
          {
            nodeType: "sourcing",
            counterparty: "Kyoto Pack & Label Studio",
            status: "done",
            outcome: "quote",
            totalPrice: 1580,
            currency: "EUR",
            lineItems: [
              { label: "Custom private-label pouches (design + print)", amount: 1100, included: true },
              { label: "Fill & seal run", amount: 480, included: true },
            ],
            validityDays: 14,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 1580,
              finalPrice: 1580,
              leverUsed: "None — same package rate as other suppliers using this studio",
            },
            transcriptQuotes: ["\"Same package rate regardless of which farm you go with, €1,580.\""],
          },
          "uji-2-packaging"
        ),
      ],
    },
    {
      id: "path-import-broker",
      label: "Direct Import Broker (Pre-Blended)",
      recommended: false,
      landedCostEur: 13730,
      nodes: [
        node(
          {
            nodeType: "sourcing",
            counterparty: "Marunouchi Trading Co.",
            status: "done",
            outcome: "quote",
            totalPrice: 12400,
            currency: "EUR",
            lineItems: [
              { label: "Pre-blended ceremonial matcha, broker margin included (500kg)", amount: 11600, included: true },
              { label: "Organic certification transfer fee", amount: 800, included: true },
            ],
            validityDays: 10,
            binding: true,
            redFlags: ["Broker would not disclose which farms the blend is sourced from"],
            negotiationDelta: {
              initialPrice: 13100,
              finalPrice: 12400,
              leverUsed: "Pushed back on the broker margin after comparing farm-direct quotes",
            },
            transcriptQuotes: [
              "\"We blend from several partner farms — I can't share which ones, but I can do €12,400.\"",
            ],
          },
          "broker-1-sourcing"
        ),
        node(
          {
            nodeType: "sourcing",
            counterparty: "Marunouchi Trading Co.",
            status: "done",
            outcome: "quote",
            totalPrice: 1330,
            currency: "EUR",
            lineItems: [{ label: "Private-label packaging (in-house)", amount: 1330, included: true }],
            validityDays: 10,
            binding: true,
            redFlags: [],
            negotiationDelta: {
              initialPrice: 1330,
              finalPrice: 1330,
              leverUsed: "None — fixed in-house packaging rate",
            },
            transcriptQuotes: ["\"Packaging is handled in-house, flat €1,330, no separate studio needed.\""],
          },
          "broker-2-packaging"
        ),
      ],
    },
  ],
}

export const negotiationReportsBySpecId: Record<string, NegotiationReport> = {
  "herbal-drops-1": herbalReport,
  "cnc-parts-1": sourcingTransportReport,
  "matcha-sourcing-1": sourcingReport,
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

const TRUCKING_COS = ["Meridian Overland", "CrossPoint Haulage", "Iron Route Logistics", "Vantage Ground Transport"]
const OCEAN_COS = ["Blue Horizon Shipping", "Continental Ocean Lines", "Pacific Gate Carriers"]
const AIR_COS = ["Skyway Cargo Partners", "Falcon Air Logistics", "Nimbus Air Freight"]
const CUSTOMS_COS = ["ClearPath Customs Brokers", "Harbor Gate Compliance", "Meridian Customs Advisory"]
const WAREHOUSE_COS = ["Nexus Distribution Center", "Anchor Point Warehousing"]
const LASTMILE_COS = ["CityLine Final Mile", "Metro Direct Delivery"]
const SUPPLIER_COS = ["Meridian Sourcing Partners", "Northfield Producers Alliance", "Cascade Direct Manufacturing", "Anchor Point Supply Co."]
const PACKAGING_COS = ["Formwork Packaging Studio", "Crestline Pack & Label"]

const LEVERS = [
  "Beat a competing quote from another carrier",
  "Committed to a longer contract for a lower rate",
  "Bundled with an existing route for shared capacity",
  "Matched a rival broker's rate after pushback",
  "Requested an off-peak / non-priority slot discount",
]

const RED_FLAGS = [
  "Fee was not disclosed until the second call",
  "Verbal surcharge not yet reflected in the written contract",
  "Storage/demurrage terms escalate quickly without advance notice",
  "Broker requested an atypical upfront deposit",
]

const QUOTE_POOL: Record<string, string[]> = {
  inland_trucking: [
    "\"We can slot your pallets into a route we already run this week.\"",
    "\"Base rate plus fuel surcharge, that's our all-in number.\"",
  ],
  ocean_freight: [
    "\"Container space is tight this month, but I can offer you a shared-load rate.\"",
    "\"Bunker adjustment moves monthly, everything else is locked in.\"",
  ],
  air_freight: [
    "\"If you need it there fast, this is the rate — space is confirmed today.\"",
    "\"Fuel and security surcharge are the only variables here.\"",
  ],
  customs_brokerage: [
    "\"Standard declaration plus classification review, nothing unusual on this one.\"",
    "\"I'll bundle the paperwork fees since you're already a client.\"",
  ],
  warehousing: [
    "\"Cross-dock handling is flat, storage kicks in after the first two days.\"",
    "\"We can hold it short-term while the onward leg is arranged.\"",
  ],
  last_mile_delivery: [
    "\"Ground floor delivery, appointment booking included.\"",
    "\"Off-peak slot saves you a bit versus a fixed appointment window.\"",
  ],
  sourcing: [
    "\"We can commit to that volume — here's our best per-unit rate.\"",
    "\"Match a competing quote and I'll see what I can do on price.\"",
  ],
}

function buildSyntheticNode(
  rng: () => number,
  nodeType: CallResult["nodeType"],
  counterparty: string,
  baseAmount: number,
  primaryLabel: string,
  id: string
): CallResult {
  const totalPrice = roundTo(baseAmount * (0.9 + rng() * 0.2))
  const primaryAmount = roundTo(totalPrice * 0.82)
  const surcharge = totalPrice - primaryAmount

  let initialPrice = totalPrice
  let leverUsed = "None — accepted standard published rate"
  const wasNegotiated = rng() < 0.6
  if (wasNegotiated) {
    const discount = 0.06 + rng() * 0.1
    initialPrice = roundTo(totalPrice / (1 - discount))
    leverUsed = pick(rng, LEVERS)
  }

  const quotes = [...(QUOTE_POOL[nodeType] ?? [])]
  const transcriptQuotes = quotes.length ? [pick(rng, quotes)] : []

  return {
    id,
    nodeType,
    counterparty,
    status: "done",
    outcome: "quote",
    totalPrice,
    currency: "EUR",
    lineItems: [
      { label: primaryLabel, amount: primaryAmount, included: true },
      { label: "Fuel / handling surcharge", amount: surcharge, included: true },
    ],
    validityDays: 10,
    binding: true,
    redFlags: [],
    negotiationDelta: {
      initialPrice,
      finalPrice: totalPrice,
      leverUsed,
    },
    transcriptQuotes,
  }
}

function buildTransportPaths(rng: () => number, spec: ProductSpec): SupplyChainPath[] {
  const truckingBase = 350 + spec.weightKg * 0.85 + spec.palletCount * 35
  const oceanBase = 900 + spec.weightKg * 0.55 + spec.cargoValueEur * 0.004
  const airBase = 1800 + spec.weightKg * 1.6 + spec.cargoValueEur * 0.01
  const customsBase = 220 + spec.cargoValueEur * 0.0035
  const warehouseBase = 180 + spec.palletCount * 25
  const lastMileBase = 300 + spec.palletCount * 15

  return [
    {
      id: "synthetic-standard",
      label: "Standard Freight Route",
      recommended: false,
      landedCostEur: 0,
      nodes: [
        buildSyntheticNode(rng, "inland_trucking", pick(rng, TRUCKING_COS), truckingBase, "Linehaul", "syn-std-1"),
        buildSyntheticNode(rng, "ocean_freight", pick(rng, OCEAN_COS), oceanBase, "Ocean freight base rate", "syn-std-2"),
        buildSyntheticNode(rng, "customs_brokerage", pick(rng, CUSTOMS_COS), customsBase, "Import declaration", "syn-std-3"),
      ],
    },
    {
      id: "synthetic-consolidated",
      label: "Consolidated Freight Route",
      recommended: false,
      landedCostEur: 0,
      nodes: [
        buildSyntheticNode(rng, "inland_trucking", pick(rng, TRUCKING_COS), truckingBase * 0.88, "Shared-load linehaul", "syn-con-1"),
        buildSyntheticNode(rng, "warehousing", pick(rng, WAREHOUSE_COS), warehouseBase, "Cross-dock handling", "syn-con-2"),
        buildSyntheticNode(rng, "ocean_freight", pick(rng, OCEAN_COS), oceanBase * 0.8, "Consolidated freight rate", "syn-con-3"),
        buildSyntheticNode(rng, "customs_brokerage", pick(rng, CUSTOMS_COS), customsBase, "Import declaration", "syn-con-4"),
      ],
    },
    {
      id: "synthetic-express",
      label: "Express Air Route",
      recommended: false,
      landedCostEur: 0,
      nodes: [
        buildSyntheticNode(rng, "inland_trucking", pick(rng, TRUCKING_COS), truckingBase * 0.4, "Airport transfer", "syn-exp-1"),
        buildSyntheticNode(rng, "air_freight", pick(rng, AIR_COS), airBase, "Air freight base rate", "syn-exp-2"),
        buildSyntheticNode(rng, "customs_brokerage", pick(rng, CUSTOMS_COS), customsBase, "Import declaration", "syn-exp-3"),
        buildSyntheticNode(rng, "last_mile_delivery", pick(rng, LASTMILE_COS), lastMileBase, "Final delivery", "syn-exp-4"),
      ],
    },
  ]
}

function buildSourcingPaths(rng: () => number, spec: ProductSpec): SupplyChainPath[] {
  // cargoValueEur here is the user's target/budget reference, not a fixed
  // known cost — each supplier path negotiates its own quote around it.
  const targetUnitCost = Math.max(spec.cargoValueEur, 500)
  const packagingBase = 150 + spec.palletCount * 90

  const supplierNames = [pick(rng, SUPPLIER_COS), pick(rng, SUPPLIER_COS), pick(rng, SUPPLIER_COS)]
  const packagingName = pick(rng, PACKAGING_COS)

  return [0.92, 0.85, 1.08].map((factor, i) => ({
    id: `synthetic-supplier-${i}`,
    label: `${supplierNames[i]} (Option ${i + 1})`,
    recommended: false,
    landedCostEur: 0,
    nodes: [
      buildSyntheticNode(rng, "sourcing", supplierNames[i], targetUnitCost * factor, "Product / unit cost", `syn-src-${i}-1`),
      buildSyntheticNode(rng, "sourcing", packagingName, packagingBase, "Packaging & labeling", `syn-src-${i}-2`),
    ],
  }))
}

function buildSourcingTransportPaths(rng: () => number, spec: ProductSpec): SupplyChainPath[] {
  const targetUnitCost = Math.max(spec.cargoValueEur, 2000)
  const truckingBase = 350 + spec.weightKg * 0.85 + spec.palletCount * 35
  const oceanBase = 900 + spec.weightKg * 0.55 + targetUnitCost * 0.004
  const airBase = 1800 + spec.weightKg * 1.6 + targetUnitCost * 0.01
  const customsBase = 220 + targetUnitCost * 0.0035

  const factories = [pick(rng, SUPPLIER_COS), pick(rng, SUPPLIER_COS), pick(rng, SUPPLIER_COS)]

  return [
    {
      id: "synthetic-source-standard",
      label: `${factories[0]} + Standard Ocean Route`,
      recommended: false,
      landedCostEur: 0,
      nodes: [
        buildSyntheticNode(rng, "sourcing", factories[0], targetUnitCost * 0.95, "Product / unit cost", "syn-st-std-0"),
        buildSyntheticNode(rng, "inland_trucking", pick(rng, TRUCKING_COS), truckingBase, "Linehaul to port", "syn-st-std-1"),
        buildSyntheticNode(rng, "ocean_freight", pick(rng, OCEAN_COS), oceanBase, "Ocean freight base rate", "syn-st-std-2"),
        buildSyntheticNode(rng, "customs_brokerage", pick(rng, CUSTOMS_COS), customsBase, "Import declaration", "syn-st-std-3"),
      ],
    },
    {
      id: "synthetic-source-consolidated",
      label: `${factories[1]} + Consolidated Ocean Route`,
      recommended: false,
      landedCostEur: 0,
      nodes: [
        buildSyntheticNode(rng, "sourcing", factories[1], targetUnitCost * 0.88, "Product / unit cost", "syn-st-con-0"),
        buildSyntheticNode(rng, "inland_trucking", pick(rng, TRUCKING_COS), truckingBase * 0.88, "Shared-load linehaul", "syn-st-con-1"),
        buildSyntheticNode(rng, "ocean_freight", pick(rng, OCEAN_COS), oceanBase * 0.82, "Consolidated freight rate", "syn-st-con-2"),
        buildSyntheticNode(rng, "customs_brokerage", pick(rng, CUSTOMS_COS), customsBase, "Import declaration", "syn-st-con-3"),
      ],
    },
    {
      id: "synthetic-source-express",
      label: `${factories[2]} + Express Air Route`,
      recommended: false,
      landedCostEur: 0,
      nodes: [
        buildSyntheticNode(rng, "sourcing", factories[2], targetUnitCost * 1.05, "Product / unit cost", "syn-st-exp-0"),
        buildSyntheticNode(rng, "inland_trucking", pick(rng, TRUCKING_COS), truckingBase * 0.4, "Airport transfer", "syn-st-exp-1"),
        buildSyntheticNode(rng, "air_freight", pick(rng, AIR_COS), airBase, "Air freight base rate", "syn-st-exp-2"),
        buildSyntheticNode(rng, "customs_brokerage", pick(rng, CUSTOMS_COS), customsBase, "Import declaration", "syn-st-exp-3"),
      ],
    },
  ]
}

export function generateSyntheticReport(spec: ProductSpec): NegotiationReport {
  const seedKey = [spec.mode, spec.productName, spec.origin, spec.destination, spec.weightKg, spec.cargoValueEur, spec.incoterm].join("|")
  const rng = mulberry32(hashSeed(seedKey))

  const paths =
    spec.mode === "sourcing"
      ? buildSourcingPaths(rng, spec)
      : spec.mode === "sourcing_transport"
        ? buildSourcingTransportPaths(rng, spec)
        : buildTransportPaths(rng, spec)

  // Attach exactly one red flag somewhere in the report, so the demo always
  // has at least one transparency-relevant callout to surface.
  const flagPathIndex = Math.floor(rng() * paths.length)
  const flagNodeIndex = Math.floor(rng() * paths[flagPathIndex].nodes.length)
  paths[flagPathIndex].nodes[flagNodeIndex].redFlags = [pick(rng, RED_FLAGS)]

  // Transport is the only mode where cargoValueEur is a known, already-fixed
  // value being added to logistics fees. Sourcing and sourcing_transport
  // negotiate the product's cost itself as a node, so it isn't added twice.
  const includeCargoValue = spec.mode === "transport"
  for (const path of paths) {
    const nodesCost = path.nodes.reduce((sum, n) => sum + n.totalPrice, 0)
    path.landedCostEur = includeCargoValue ? spec.cargoValueEur + nodesCost : nodesCost
  }

  const sorted = [...paths].sort((a, b) => a.landedCostEur - b.landedCostEur)
  const recommendedPathId = sorted[0].id
  for (const path of paths) {
    path.recommended = path.id === recommendedPathId
  }

  const cheapest = sorted[0]
  const nextBest = sorted[1]
  const savings = nextBest ? nextBest.landedCostEur - cheapest.landedCostEur : 0

  return {
    productSpec: spec,
    paths,
    recommendedPathId,
    executiveSummary:
      `${cheapest.label} lands at the lowest total cost for ${spec.productName}` +
      (savings > 0 ? `, roughly €${roundTo(savings)} under the next best option.` : "."),
  }
}

export function getReportForSpec(spec: ProductSpec): NegotiationReport {
  return negotiationReportsBySpecId[spec.id] ?? generateSyntheticReport(spec)
}
