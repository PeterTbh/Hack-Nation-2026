// Injects a live-negotiated quote into a report built from mock/synthetic
// data: replaces the corresponding node, rescales the other paths' main
// carriage leg toward what the call actually revealed (so the whole
// comparison feels informed by the conversation rather than an unrelated
// guess), and recomputes landed costs and the recommendation.
//
// This runs exactly once, right after the live call ends and before the
// report is ever shown — so the Negotiating step and the Results step always
// render the same numbers, never two independently-computed versions.

import type { CallResult, LineItem, NegotiationReport, SupplyChainPath } from "@/lib/types"

// Demo-fixed conversion — the agent negotiates in USD, the report sums in EUR.
export const USD_TO_EUR = 0.92

// How far a path's main-carriage leg is allowed to move toward the live
// price — wide enough to feel informed by the call, narrow enough that one
// data point can't send a path to an absurd extreme.
const MIN_SCALE = 0.4
const MAX_SCALE = 2.5

function toEur(node: CallResult): number {
  return node.currency === "USD" ? node.totalPrice * USD_TO_EUR : node.totalPrice
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isMainCarriage(node: CallResult): boolean {
  return node.nodeType === "ocean_freight" || node.nodeType === "air_freight"
}

// Scales a simulated node's fees toward the live-discovered price level.
// Only line items actually included in the price move; "not included" extras
// (e.g. potential demurrage) are left as-is since the call said nothing about
// them either way.
function rescaleNode(node: CallResult, factor: number): CallResult {
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

  const liveEur = toEur(live)

  // The first path with an ocean-freight leg is the one the live call
  // actually replaces; its original mock price sets the scale for how far
  // reality diverged from the guess.
  const mergeIndex = report.paths.findIndex((p) => p.nodes.some((n) => n.nodeType === "ocean_freight"))
  let scaleFactor = 1
  if (mergeIndex !== -1) {
    const original = report.paths[mergeIndex].nodes.find((n) => n.nodeType === "ocean_freight")
    const originalEur = original ? toEur(original) : 0
    if (originalEur > 0) scaleFactor = clamp(liveEur / originalEur, MIN_SCALE, MAX_SCALE)
  }

  const paths = report.paths.map((path, i) => {
    if (i === mergeIndex) {
      const nodes = path.nodes.map((n) => (n.nodeType === "ocean_freight" ? live : n))
      return recompute({ ...path, nodes }, report.productSpec.cargoValueEur)
    }
    // Every other path keeps its own simulated calls, but its main-carriage
    // leg (ocean or air) moves toward what the live call actually found —
    // trucking, customs, and warehousing weren't part of that call, so they
    // stay untouched.
    const nodes = path.nodes.map((n) => (isMainCarriage(n) ? rescaleNode(n, scaleFactor) : n))
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
