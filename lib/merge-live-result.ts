// Injects a live-negotiated ocean freight quote into a report built from
// mock/synthetic data, replacing the corresponding node and recomputing
// landed costs and the recommendation.

import type { CallResult, NegotiationReport, SupplyChainPath } from "@/lib/types"

// Demo-fixed conversion — the agent negotiates in USD, the report sums in EUR.
export const USD_TO_EUR = 0.92

function recompute(path: SupplyChainPath, cargoValueEur: number, includeCargoValue: boolean): SupplyChainPath {
  const nodesCost = path.nodes.reduce(
    (sum, n) => sum + (n.currency === "USD" ? Math.round(n.totalPrice * USD_TO_EUR) : n.totalPrice),
    0
  )
  return { ...path, landedCostEur: includeCargoValue ? cargoValueEur + nodesCost : nodesCost }
}

export function mergeLiveResult(report: NegotiationReport, live: CallResult): NegotiationReport {
  // A declined call or callback commitment carries no usable price — merging
  // it would rank a €0 leg as the cheapest path. Keep the mock report as-is.
  if (live.outcome !== "quote" || live.totalPrice <= 0) return report

  const includeCargoValue = report.productSpec.mode === "transport"

  // Replace the ocean freight node in the first path that has one; other
  // paths keep their mock quotes so the comparison stays multi-path.
  let replaced = false
  const paths = report.paths.map((path) => {
    if (!replaced && path.nodes.some((n) => n.nodeType === "ocean_freight")) {
      replaced = true
      const nodes = path.nodes.map((n) => (n.nodeType === "ocean_freight" ? live : n))
      return recompute({ ...path, nodes }, report.productSpec.cargoValueEur, includeCargoValue)
    }
    return recompute(path, report.productSpec.cargoValueEur, includeCargoValue)
  })

  // If no path had an ocean leg (e.g. road-only mock report), add the live
  // call as its own path so the result is never dropped.
  if (!replaced) {
    paths.push(
      recompute(
        {
          id: "live-ocean-path",
          label: `Live negotiated — ${live.counterparty}`,
          recommended: false,
          landedCostEur: 0,
          nodes: [live],
        },
        report.productSpec.cargoValueEur,
        includeCargoValue
      )
    )
  }

  const sorted = [...paths].sort((a, b) => a.landedCostEur - b.landedCostEur)
  const recommendedPathId = sorted[0].id
  for (const path of paths) path.recommended = path.id === recommendedPathId

  return { ...report, paths, recommendedPathId }
}
