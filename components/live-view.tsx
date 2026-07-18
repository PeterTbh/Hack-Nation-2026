"use client"

import { useEffect, useState } from "react"
import type { CallResult, NegotiationReport } from "@/lib/types"
import { formatMoney, nodeTypeLabels } from "@/lib/format"
import { useCountdownPrice } from "@/hooks/use-countdown-price"
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

export function LiveView({
  report,
  onComplete,
}: {
  report: NegotiationReport
  onComplete: () => void
}) {
  const nodes = report.paths.flatMap((p) => p.nodes)
  const stages = useSimulatedCalls(nodes.map((n) => n.id))
  const allDone = stages.every((s) => s === "done")
  const doneCount = stages.filter((s) => s === "done").length

  const scopeLabel =
    report.productSpec.mode === "sourcing"
      ? "candidate suppliers"
      : report.productSpec.mode === "sourcing_transport"
        ? "candidate sourcing + transport combinations"
        : "candidate supply chain paths"

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Live negotiation calls</h1>
        <p className="text-muted-foreground">
          Calling every provider across {report.paths.length} {scopeLabel} for{" "}
          {report.productSpec.productName} — {doneCount}/{nodes.length} calls complete.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {nodes.map((node, i) => (
          <CallCard key={node.id} node={node} status={stages[i]} />
        ))}
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
    <Card className={cn(isDone && hasRedFlags && "ring-1 ring-destructive/50")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <StatusDot status={status} hasRedFlags={isDone && hasRedFlags} />
          {node.counterparty}
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
