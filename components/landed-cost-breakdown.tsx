import type { SupplyChainPath } from "@/lib/types"
import { formatMoney, nodeTypeLabels } from "@/lib/format"

export function LandedCostBreakdown({
  path,
  cargoValueEur,
}: {
  path: SupplyChainPath
  cargoValueEur: number
}) {
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Cargo value</span>
        <span className="tabular-nums">{formatMoney(cargoValueEur)}</span>
      </div>
      {path.nodes.map((node) => (
        <div key={node.id} className="flex items-center justify-between">
          <span className="text-muted-foreground">
            + {nodeTypeLabels[node.nodeType]}
            <span className="text-muted-foreground/70"> · {node.counterparty}</span>
          </span>
          <span className="tabular-nums">{formatMoney(node.totalPrice, node.currency)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
        <span>= Landed cost</span>
        <span className="tabular-nums">{formatMoney(path.landedCostEur)}</span>
      </div>
    </div>
  )
}
