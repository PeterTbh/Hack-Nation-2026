// Data contract for the freight negotiation demo.
// Everything the UI reads flows through these types + lib/mockData.ts,
// so the mock source can later be swapped for a real backend/API.

export type Incoterm = "EXW" | "FOB" | "CIF" | "DDP" | "FCA"

// What OpenBid should handle for this shipment. Determines which fields are
// relevant on the intake form and which node types appear downstream.
export type NegotiationMode = "sourcing" | "transport" | "sourcing_transport"

export type ContainerType = "20ft" | "40ft" | "40ft HC" | "LCL"

// A real quote we already hold from another vendor. Under the agent's honesty
// rules these are the ONLY competing numbers it may cite on a call, so they
// must be entered accurately — never invented.
export interface CompetingQuote {
  vendor: string
  amountUsd: number
  allIn: boolean // true = all-in; false = base rate with extras billed on top
  extras?: string // e.g. "plus destination THC USD 280 and documentation USD 95"
  transitDays?: number
  freeDays?: number
  validityDays?: number
}

export interface ProductSpec {
  id: string
  mode: NegotiationMode
  productName: string
  weightKg: number
  palletCount: number
  cargoValueEur: number
  readyDate: string // ISO date

  // transport only
  origin?: string
  destination?: string
  incoterm?: Incoterm

  // transport only — context the live voice agent needs to open, negotiate,
  // and red-flag realistically. Optional so curated mock specs stay valid.
  clientName?: string
  language?: string
  cargoDescription?: string // incl. non-hazardous confirmation
  containerType?: ContainerType
  cartonCount?: number
  latestArrivalDate?: string // ISO date — hard arrival deadline at destination
  paymentTerms?: string
  counterpartyName?: string // who the agent is calling
  counterpartyType?: string // freight forwarder / carrier booking desk / NVOCC
  benchmarkRateUsd?: number // market all-in benchmark; red-flag floor = 70% of it
  typicalTransitDays?: string // e.g. "30–33 days"
  competingQuotes?: CompetingQuote[]

  // sourcing_transport only (final delivery point; origin is left open on
  // purpose — the agent evaluates sourcing options and their shipping together)
  // (destination reuses the same field as transport, above)

  // sourcing + sourcing_transport
  productSpecifications?: string
  neededByDate?: string // sourcing only

  specialRequirements: string[]
}

export type NodeType =
  | "sourcing"
  | "inland_trucking"
  | "ocean_freight"
  | "air_freight"
  | "customs_brokerage"
  | "warehousing"
  | "last_mile_delivery"

export type CallStatus = "calling" | "negotiating" | "done"
export type CallOutcome = "quote" | "callback" | "decline"

export interface LineItem {
  label: string
  amount: number
  included: boolean
}

export interface NegotiationDelta {
  initialPrice: number
  finalPrice: number
  leverUsed: string
}

export interface CallResult {
  id: string
  nodeType: NodeType
  counterparty: string
  status: CallStatus
  outcome: CallOutcome
  totalPrice: number
  currency: string
  lineItems: LineItem[]
  validityDays: number
  binding: boolean
  redFlags: string[]
  negotiationDelta: NegotiationDelta
  transcriptQuotes: string[]

  // Populated when the node was negotiated by the live voice agent (parsed
  // from its closing QUOTE SUMMARY); absent on mock/simulated nodes.
  transitDays?: number
  nextSailing?: string
  freeDays?: string // e.g. "7 demurrage / 5 detention"
  paymentTerms?: string
  missingInformation?: string[] // items the vendor couldn't provide + plausibility judgement
  live?: boolean
}

export interface SupplyChainPath {
  id: string
  label: string
  nodes: CallResult[]
  landedCostEur: number
  recommended: boolean
}

export interface NegotiationReport {
  productSpec: ProductSpec
  paths: SupplyChainPath[]
  recommendedPathId: string
  executiveSummary: string
}
