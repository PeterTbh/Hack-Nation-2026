// Data contract for the freight negotiation demo.
// Everything the UI reads flows through these types + lib/mockData.ts,
// so the mock source can later be swapped for a real backend/API.

export type Incoterm = "EXW" | "FOB" | "CIF" | "DDP" | "FCA"

// What OpenBid should handle for this shipment. Determines which fields are
// relevant on the intake form and which node types appear downstream.
export type NegotiationMode = "sourcing" | "transport" | "sourcing_transport"

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
