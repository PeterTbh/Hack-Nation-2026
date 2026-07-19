import type { CallResult } from "@/lib/types"
import { formatMoney } from "@/lib/format"
import { Badge } from "@/components/ui/badge"

// The purist, post-call summary: just the quote and the one or two facts that
// actually matter. Full line items, transcript, and terms stay in the
// Results evidence dialog — this is not the place for them.
export function LiveResultSummary({
  result,
  label = "Live call result",
}: {
  result: CallResult | null
  label?: string
}) {
  if (!result) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          Call ended without a structured quote — continuing with the simulated negotiation.
        </p>
      </div>
    )
  }

  const key = [
    result.maxTotalPrice
      ? `up to ${formatMoney(result.maxTotalPrice, result.currency)} worst case${result.maxPriceDrivers ? ` (${result.maxPriceDrivers})` : ""}`
      : null,
    result.alsoMentioned ?? null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="rounded-lg border border-brand/30 bg-brand/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="font-medium">{result.counterparty}</p>
        </div>
        <Badge className="bg-brand text-brand-foreground">Live negotiated</Badge>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">
        {formatMoney(result.totalPrice, result.currency)}
        <span className="ml-2 text-sm font-normal text-muted-foreground">realistic all-in</span>
      </p>
      {key && <p className="mt-1 text-xs text-muted-foreground">{key}</p>}
      {result.negotiatedImprovement && (
        <p className="mt-2 text-xs text-brand">✓ Negotiated: {result.negotiatedImprovement}</p>
      )}
      {result.redFlags.length > 0 && (
        <p className="mt-2 text-xs text-destructive">⚠ {result.redFlags[0]}</p>
      )}
    </div>
  )
}
