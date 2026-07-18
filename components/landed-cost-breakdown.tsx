import type { NegotiationMode, SupplyChainPath } from "@/lib/types"
import { formatMoney, nodeTypeLabels } from "@/lib/format"

export function LandedCostBreakdown({
  path,
  cargoValueEur,
  mode,
}: {
  path: SupplyChainPath
  cargoValueEur: number
  mode: NegotiationMode
}) {
  // Transport is the only mode where cargoValueEur is a known, already-fixed
  // goods value being added on top of logistics fees. In sourcing modes the
  // product's own cost is negotiated as a node, so it isn't added twice.
  const showCargoValue = mode === "transport"

  return (
    <div className="space-y-1.5 text-sm">
      {showCargoValue && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Cargo value</span>
          <span className="tabular-nums">{formatMoney(cargoValueEur)}</span>
        </div>
      )}
      {path.nodes.map((node, i) => (
        <div key={node.id} className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {showCargoValue || i > 0 ? "+ " : ""}
            {nodeTypeLabels[node.nodeType]}
            <span className="text-muted-foreground/70"> · {node.counterparty}</span>
          </span>
          <span className="tabular-nums">{formatMoney(node.totalPrice, node.currency)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
        <span>= {mode === "transport" ? "Landed cost" : "Total cost"}</span>
        <span className="tabular-nums">{formatMoney(path.landedCostEur)}</span>
      </div>
    </div>
  )
}
