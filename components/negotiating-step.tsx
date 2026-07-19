"use client"

import { useEffect, useState } from "react"
import type { CallResult, NegotiationReport } from "@/lib/types"
import { formatMoney, nodeTypeLabels } from "@/lib/format"
import { USD_TO_EUR } from "@/lib/merge-live-result"
import { useCountdownPrice } from "@/hooks/use-countdown-price"
import { LiveResultSummary } from "@/components/live-result-summary"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SimStatus = "calling" | "negotiating" | "done"

const NEGOTIATING_DELAY_MS = 400
const DONE_DELAY_MS = 1100
const STAGGER_MS = 350

function useSimulatedCalls(nodeIds: string[]) {
  const [stages, setStages] = useState<SimStatus[]>(() => nodeIds.map(() => "calling"))

  useEffect(() => {
    setStages(nodeIds.map(() => "calling"))
    const timers: ReturnType<typeof setTimeout>[] = []

    nodeIds.forEach((_, i) => {
      const baseDelay = i * STAGGER_MS
      timers.push(
        setTimeout(() => {
          setStages((prev) => prev.map((s, idx) => (idx === i ? "negotiating" : s)))
        }, baseDelay + NEGOTIATING_DELAY_MS)
      )
      timers.push(
        setTimeout(() => {
          setStages((prev) => prev.map((s, idx) => (idx === i ? "done" : s)))
        }, baseDelay + DONE_DELAY_MS)
      )
    })

    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIds.join(",")])

  return stages
}

function nodeEur(node: CallResult): number {
  return node.currency === "USD" ? Math.round(node.totalPrice * USD_TO_EUR) : node.totalPrice
}

export function NegotiatingStep({
  report,
  onComplete,
}: {
  report: NegotiationReport
  onComplete: () => void
}) {
  const spec = report.productSpec
  const allNodes = report.paths.flatMap((p) => p.nodes)
  const liveNode = allNodes.find((n) => n.live)
  const simNodes = allNodes.filter((n) => !n.live)
  const stages = useSimulatedCalls(simNodes.map((n) => n.id))
  const stageById = new Map(simNodes.map((n, i) => [n.id, stages[i]] as const))
  const allDone = stages.every((s) => s === "done")
  const doneCount = stages.filter((s) => s === "done").length

  // Same ordering as the Results ranking table — cheapest landed cost first —
  // so what completes here maps row-for-row onto the next screen.
  const orderedPaths = [...report.paths].sort((a, b) => a.landedCostEur - b.landedCostEur)

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Negotiating the remaining legs</h1>
        <p className="text-muted-foreground">
          {liveNode
            ? `Using the live quote as the anchor while the agent negotiates each candidate route for ${spec.productName} — ${doneCount}/${simNodes.length} calls complete.`
            : `Calling every remaining provider for ${spec.productName} — ${doneCount}/${simNodes.length} calls complete.`}
        </p>
      </div>

      {liveNode && <LiveResultSummary result={liveNode} label="From your live call" />}

      <div className="flex flex-col gap-8">
        {orderedPaths.map((path) => {
          const pathDone = path.nodes.every((n) => n.live || stageById.get(n.id) === "done")
          const logisticsCost = path.nodes.reduce((sum, n) => sum + nodeEur(n), 0)
          return (
            <section key={path.id} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  {path.label}
                  {pathDone && path.recommended && (
                    <Badge className="bg-brand text-brand-foreground">Recommended</Badge>
                  )}
                </h2>
                {pathDone ? (
                  <span className="text-sm text-muted-foreground">
                    Logistics {formatMoney(logisticsCost)} · Landed{" "}
                    <span className="font-semibold text-foreground">{formatMoney(path.landedCostEur)}</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Calls in progress…</span>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {path.nodes.map((node) => (
                  <CallCard
                    key={node.id}
                    node={node}
                    status={node.live ? "done" : (stageById.get(node.id) ?? "done")}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button size="lg" disabled={!allDone} onClick={onComplete}>
          {allDone ? "View Results" : "Calls in progress…"}
        </Button>
      </div>
    </div>
  )
}

const NEGOTIATION_ANIM_MS = DONE_DELAY_MS - NEGOTIATING_DELAY_MS

function CallCard({ node, status }: { node: CallResult; status: SimStatus }) {
  const hasRedFlags = node.redFlags.length > 0
  const isDone = status === "done"
  const isNegotiating = status === "negotiating"
  const wasNegotiated = node.negotiationDelta.finalPrice < node.negotiationDelta.initialPrice

  const animatedPrice = useCountdownPrice(
    isNegotiating && wasNegotiated,
    node.negotiationDelta.initialPrice,
    node.negotiationDelta.finalPrice,
    NEGOTIATION_ANIM_MS
  )

  return (
    <Card
      className={cn(
        isDone && hasRedFlags && "ring-1 ring-destructive/50",
        node.live && "ring-1 ring-brand/50"
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <StatusDot status={status} hasRedFlags={isDone && hasRedFlags} />
          <span className="truncate">{node.counterparty}</span>
          {node.live && (
            <Badge className="shrink-0 bg-brand text-brand-foreground">Live</Badge>
          )}
        </CardTitle>
        <CardDescription>{nodeTypeLabels[node.nodeType]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status === "calling" && <p className="text-muted-foreground">Dialing…</p>}
        {isNegotiating &&
          (wasNegotiated ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">Negotiating rate…</p>
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-sm text-muted-foreground/60 line-through">
                  {formatMoney(node.negotiationDelta.initialPrice, node.currency)}
                </span>
                <span className="text-lg font-semibold tabular-nums text-brand">
                  {formatMoney(animatedPrice, node.currency)}
                </span>
              </div>
              <Badge
                variant="outline"
                className="h-auto w-full justify-start border-warn/40 text-warn whitespace-normal py-1 font-normal"
              >
                {node.negotiationDelta.leverUsed}
              </Badge>
            </div>
          ) : (
            <p className="text-muted-foreground">Negotiating rate…</p>
          ))}
        {isDone && (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="text-lg font-semibold">
                {formatMoney(node.totalPrice, node.currency)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {node.lineItems.map((item) => (
                <Badge
                  key={item.label}
                  variant={item.included ? "secondary" : "outline"}
                  className="font-normal"
                >
                  {item.label}: {formatMoney(item.amount, node.currency)}
                  {!item.included && " (extra)"}
                </Badge>
              ))}
            </div>
            {wasNegotiated && (
              <p className="text-xs text-brand">
                ↓ negotiated from {formatMoney(node.negotiationDelta.initialPrice, node.currency)}
              </p>
            )}
            {hasRedFlags && (
              <div className="space-y-1 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                {node.redFlags.map((flag) => (
                  <p key={flag}>⚠ {flag}</p>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function StatusDot({ status, hasRedFlags }: { status: SimStatus; hasRedFlags: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {status !== "done" && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            status === "calling" ? "bg-muted-foreground" : "bg-warn"
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          status === "calling" && "bg-muted-foreground",
          status === "negotiating" && "bg-warn",
          status === "done" && (hasRedFlags ? "bg-destructive" : "bg-brand")
        )}
      />
    </span>
  )
}
