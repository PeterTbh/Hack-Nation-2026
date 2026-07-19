// Injects a live-negotiated freight quote into a report built from
// mock/synthetic data. The live price is the anchor: every synthetic
// comparison quote is rescaled to sit within ±20% of it — except the one
// deliberately-suspicious outlier, which stays far below the field and keeps
// its red flag instead of being normalized away.
//
// This runs exactly once, right after the live call ends and before the
// report is ever shown — so the Negotiating step and the Results step always
// render the same numbers, never two independently-computed versions.

import type { CallResult, NegotiationReport, SupplyChainPath } from "@/lib/types"
import { SUSPICIOUS_LOW_FLAG } from "@/lib/mockData"

// Demo-fixed conversion — the agent may negotiate in USD, the report sums in EUR.
export const USD_TO_EUR = 0.92

// Deterministic spread for credible comparison quotes relative to the live
// price — all inside the ±20% band a like-for-like forwarder quote should
// land in. The flagged outlier sits far below it on purpose.
const COMPARISON_FACTORS = [0.93, 1.08, 1.18]
const OUTLIER_FACTOR = 0.65

function toEur(node: CallResult): number {
  return node.currency === "USD" ? Math.round(node.totalPrice * USD_TO_EUR) : node.totalPrice
}

function roundTo(n: number, step = 5): number {
  return Math.round(n / step) * step
}

function recompute(path: SupplyChainPath, cargoValueEur: number): SupplyChainPath {
  const nodesCost = path.nodes.reduce((sum, n) => sum + toEur(n), 0)
  return { ...path, landedCostEur: cargoValueEur + nodesCost }
}

// Scales a node to a new total, keeping the line-item split and the
// negotiation delta's discount ratio (rounding drift lands on the first
// included line item). "Not included" extras stay untouched.
function scaleNode(node: CallResult, target: number): CallResult {
  if (node.totalPrice <= 0 || target === node.totalPrice) return node
  const factor = target / node.totalPrice
  const lineItems = node.lineItems.map((item) =>
    item.included ? { ...item, amount: Math.max(0, Math.round(item.amount * factor)) } : item
  )
  const includedSum = lineItems.filter((i) => i.included).reduce((sum, i) => sum + i.amount, 0)
  const main = lineItems.find((i) => i.included)
  if (main) main.amount += target - includedSum
  return {
    ...node,
    totalPrice: target,
    lineItems,
    negotiationDelta: {
      ...node.negotiationDelta,
      initialPrice: roundTo(node.negotiationDelta.initialPrice * factor),
      finalPrice: target,
    },
  }
}

// Rescales a comparison path so its transport cost lands at factor × the
// live price. Single-node forwarder paths in practice; multi-node paths
// scale proportionally across their nodes.
function rescalePath(path: SupplyChainPath, liveEur: number, factor: number): SupplyChainPath {
  const current = path.nodes.reduce((sum, n) => sum + toEur(n), 0)
  if (current <= 0) return path
  const target = roundTo(liveEur * factor)
  const nodes = path.nodes.map((n) => scaleNode(n, roundTo((toEur(n) / current) * target)))
  return { ...path, nodes }
}

export function mergeLiveResult(report: NegotiationReport, live: CallResult): NegotiationReport {
  // A declined call or callback commitment carries no usable price — merging
  // it would rank a €0 leg as the cheapest path. Keep the mock report as-is.
  if (live.outcome !== "quote" || live.totalPrice <= 0) return report

  const liveEur = toEur(live)

  // The first path with a main-carriage leg is the one the live call
  // actually replaces — it becomes the live-negotiated option outright.
  const mergeIndex = report.paths.findIndex((p) => p.nodes.some((n) => n.nodeType === "ocean_freight"))

  let comparisonIndex = 0
  const paths = report.paths.map((path, i) => {
    if (i === mergeIndex) {
      return recompute(
        { ...path, label: `Live negotiated — ${live.counterparty}`, nodes: [live] },
        report.productSpec.cargoValueEur
      )
    }
    const suspicious = path.nodes.some((n) => n.redFlags.includes(SUSPICIOUS_LOW_FLAG))
    const factor = suspicious
      ? OUTLIER_FACTOR
      : COMPARISON_FACTORS[comparisonIndex++ % COMPARISON_FACTORS.length]
    return recompute(rescalePath(path, liveEur, factor), report.productSpec.cargoValueEur)
  })

  // If no path had a main-carriage leg (e.g. curated mock report), add the
  // live call as its own path so the result is never dropped.
  if (mergeIndex === -1) {
    paths.push(
      recompute(
        {
          id: "live-path",
          label: `Live negotiated — ${live.counterparty}`,
          recommended: false,
          landedCostEur: 0,
          nodes: [live],
        },
        report.productSpec.cargoValueEur
      )
    )
  }

  // A flagged quote is never the recommendation, however cheap it looks —
  // cheapest clean offer wins.
  const sorted = [...paths].sort((a, b) => a.landedCostEur - b.landedCostEur)
  const clean = sorted.filter((p) => p.nodes.every((n) => n.redFlags.length === 0))
  const recommended = clean[0] ?? sorted[0]
  const recommendedPathId = recommended.id
  for (const path of paths) path.recommended = path.id === recommendedPathId

  // The pre-merge summary references pre-merge names and prices — rebuild it.
  const runnerUp = clean.find((p) => p.id !== recommendedPathId) ?? sorted.find((p) => p.id !== recommendedPathId)
  const savings = runnerUp ? runnerUp.landedCostEur - recommended.landedCostEur : 0
  const hasOutlier = paths.some((p) => p.nodes.some((n) => n.redFlags.includes(SUSPICIOUS_LOW_FLAG)))
  const executiveSummary =
    `${recommended.label} lands at the lowest credible landed cost` +
    (savings > 0 ? `, roughly €${savings} under the next best offer` : "") +
    `. The winning freight quote was negotiated on a live call with ${live.counterparty}.` +
    (hasOutlier
      ? " One quote came in far below the field and is flagged as suspicious rather than recommended."
      : "")

  return { ...report, paths, recommendedPathId, executiveSummary }
}
