// Injects a live-negotiated quote into a report built from mock/synthetic
// data. The live price becomes a sanity check, not a full override: each
// other node keeps its own weight/pallet-based synthetic guess (so a small
// shipment still gets small accessorial costs), but gets CLAMPED into a
// realistic band relative to the live price if the guess was egregiously off
// — e.g. a feeder trucking leg that costs more than the main freight it
// feeds into. Nodes already inside a sane band are left untouched.
//
// This runs exactly once, right after the live call ends and before the
// report is ever shown — so the Negotiating step and the Results step always
// render the same numbers, never two independently-computed versions.

import type { CallResult, LineItem, NegotiationReport, NodeType, SupplyChainPath } from "@/lib/types"

// Demo-fixed conversion — the agent negotiates in USD, the report sums in EUR.
export const USD_TO_EUR = 0.92

function toEur(node: CallResult): number {
  return node.currency === "USD" ? node.totalPrice * USD_TO_EUR : node.totalPrice
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isMainCarriage(node: CallResult): boolean {
  return node.nodeType === "ocean_freight" || node.nodeType === "air_freight"
}

// Sane bands as a multiple of the live anchor, with absolute floors so small
// accessorial fees never collapse to pocket-change amounts. Mode ordering is
// enforced by construction: ocean (the anchor) is the cheapest way to move
// the goods, driving the ENTIRE route sits clearly above it, and air sits
// clearly above that. "hasMainCarriage" distinguishes a short feeder/drayage
// leg (small fraction of the main freight it feeds) from a path with no
// main-carriage node at all — there, inland_trucking IS the whole
// point-to-point job and must never undercut the ocean freight it competes
// against.
function auxiliaryBounds(nodeType: NodeType, hasMainCarriage: boolean, anchorEur: number): [number, number] | null {
  switch (nodeType) {
    case "inland_trucking":
      return hasMainCarriage
        ? [Math.max(180, anchorEur * 0.06), Math.max(420, anchorEur * 0.3)]
        : [anchorEur * 1.4, anchorEur * 2.6]
    case "customs_brokerage":
      return [Math.max(140, anchorEur * 0.03), Math.max(320, anchorEur * 0.12)]
    case "warehousing":
      return [Math.max(120, anchorEur * 0.03), Math.max(300, anchorEur * 0.15)]
    case "last_mile_delivery":
      return [Math.max(160, anchorEur * 0.04), Math.max(360, anchorEur * 0.18)]
    default:
      return null
  }
}

// Competing ocean quotes hover around the negotiated level (nobody magically
// undercuts the negotiated rate by 40%); air freight is genuinely a multiple
// of ocean for the same cargo — a few times over, not a few percent.
function mainCarriageBounds(node: CallResult, anchorEur: number): [number, number] {
  if (node.nodeType === "air_freight") return [anchorEur * 2.5, anchorEur * 6]
  return [anchorEur * 0.95, anchorEur * 1.5]
}

// Clamps a simulated node's included-fee total into [minEur, maxEur],
// preserving the relative split between line items and the negotiation
// delta's discount ratio. Leaves the node untouched if it's already inside
// the band. "Not included" extras are left as-is either way — the live call
// said nothing about them.
function clampNode(node: CallResult, minEur: number, maxEur: number): CallResult {
  const current = node.lineItems.filter((item) => item.included).reduce((sum, item) => sum + item.amount, 0)
  if (current <= 0) return node
  const target = clamp(current, minEur, maxEur)
  const factor = target / current
  if (factor === 1) return node

  const lineItems: LineItem[] = node.lineItems.map((item) =>
    item.included ? { ...item, amount: Math.max(0, Math.round(item.amount * factor)) } : item
  )
  const totalPrice = lineItems.filter((item) => item.included).reduce((sum, item) => sum + item.amount, 0)
  const initialPrice = Math.round(node.negotiationDelta.initialPrice * factor)

  return {
    ...node,
    lineItems,
    totalPrice,
    negotiationDelta: { ...node.negotiationDelta, initialPrice, finalPrice: totalPrice },
  }
}

function recompute(path: SupplyChainPath, cargoValueEur: number): SupplyChainPath {
  const nodesCost = path.nodes.reduce((sum, n) => sum + Math.round(toEur(n)), 0)
  return { ...path, landedCostEur: cargoValueEur + nodesCost }
}

export function mergeLiveResult(report: NegotiationReport, live: CallResult): NegotiationReport {
  // A declined call or callback commitment carries no usable price — merging
  // it would rank a €0 leg as the cheapest path. Keep the mock report as-is.
  if (live.outcome !== "quote" || live.totalPrice <= 0) return report

  const anchorEur = toEur(live)

  // The first path with an ocean-freight leg is the one the live call
  // actually replaces.
  const mergeIndex = report.paths.findIndex((p) => p.nodes.some((n) => n.nodeType === "ocean_freight"))

  const paths = report.paths.map((path, i) => {
    const isMergePath = i === mergeIndex
    const hasMainCarriage = isMergePath || path.nodes.some(isMainCarriage)

    const nodes = path.nodes.map((n) => {
      if (isMergePath && n.nodeType === "ocean_freight") return live
      if (isMainCarriage(n)) {
        const [min, max] = mainCarriageBounds(n, anchorEur)
        return clampNode(n, min, max)
      }
      const bounds = auxiliaryBounds(n.nodeType, hasMainCarriage, anchorEur)
      return bounds ? clampNode(n, bounds[0], bounds[1]) : n
    })
    return recompute({ ...path, nodes }, report.productSpec.cargoValueEur)
  })

  // If no path had an ocean leg (e.g. road-only mock report), add the live
  // call as its own path so the result is never dropped.
  if (mergeIndex === -1) {
    paths.push(
      recompute(
        {
          id: "live-ocean-path",
          label: `Live negotiated — ${live.counterparty}`,
          recommended: false,
          landedCostEur: 0,
          nodes: [live],
        },
        report.productSpec.cargoValueEur
      )
    )
  }

  const sorted = [...paths].sort((a, b) => a.landedCostEur - b.landedCostEur)
  const recommendedPathId = sorted[0].id
  for (const path of paths) path.recommended = path.id === recommendedPathId

  return { ...report, paths, recommendedPathId }
}
