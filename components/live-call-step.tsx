"use client"

import { useState } from "react"
import type { CallResult, NegotiationReport } from "@/lib/types"
import { mergeLiveResult } from "@/lib/merge-live-result"
import { LiveCallCard } from "@/components/live-call-card"
import { LiveResultSummary } from "@/components/live-result-summary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LiveCallStep({
  report,
  onContinue,
}: {
  report: NegotiationReport
  onContinue: (report: NegotiationReport) => void
}) {
  const spec = report.productSpec
  const liveCapable = !!spec.counterpartyName
  const [callInProgress, setCallInProgress] = useState(false)
  const [hasStartedCall, setHasStartedCall] = useState(false)
  const [ended, setEnded] = useState(false)
  const [result, setResult] = useState<CallResult | null>(null)
  const [manualPrice, setManualPrice] = useState("")

  // True in the gap between the call disconnecting and finalizeCall's async
  // transcript/summary extraction resolving (can take up to ~20s) — without
  // this the button reads "Skip", inviting the user to bail right before the
  // summary would have appeared.
  const waitingForSummary = hasStartedCall && !callInProgress && !ended

  function handleCallStateChange(inProgress: boolean) {
    setCallInProgress(inProgress)
    if (inProgress) setHasStartedCall(true)
  }

  function handleContinue() {
    onContinue(result ? mergeLiveResult(report, result) : report)
  }

  // Testing shortcut: type a price instead of running the call each time.
  // Feeds into the exact same mergeLiveResult pipeline as a real parsed
  // result, so it anchors the Negotiating/Results numbers identically —
  // useful for iterating on those numbers without redoing the negotiation.
  function handleSimulate() {
    const amount = Number(manualPrice)
    if (!Number.isFinite(amount) || amount <= 0) return

    const simulated: CallResult = {
      id: `manual-${Date.now()}`,
      nodeType: "ocean_freight",
      counterparty: spec.counterpartyName ?? "Simulated Vendor",
      status: "done",
      outcome: "quote",
      totalPrice: amount,
      currency: "USD",
      lineItems: [{ label: "Base freight rate", amount, included: true }],
      validityDays: 14,
      binding: false,
      redFlags: [],
      negotiationDelta: { initialPrice: amount, finalPrice: amount, leverUsed: "Manually entered for simulation" },
      transcriptQuotes: [],
      live: true,
    }
    setResult(simulated)
    setEnded(true)
  }

  const simulateBlock = (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-4">
      <p className="text-xs font-medium text-muted-foreground">Testing shortcut — skip the call</p>
      <p className="text-xs text-muted-foreground">
        Enter a realistic all-in price (USD) instead of running the negotiation — it anchors the
        Negotiating and Results numbers exactly like a real live-negotiated price would.
      </p>
      <div className="flex items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="manualPrice" className="sr-only">
            Simulated price (USD)
          </Label>
          <Input
            id="manualPrice"
            type="number"
            min="0"
            placeholder="e.g. 2500"
            value={manualPrice}
            onChange={(e) => setManualPrice(e.target.value)}
            className="w-40"
          />
        </div>
        <Button type="button" variant="outline" onClick={handleSimulate} disabled={!manualPrice.trim()}>
          Use this price
        </Button>
      </div>
    </div>
  )

  if (!liveCapable) {
    return (
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Live demo</h1>
          <p className="text-muted-foreground">
            No live call is configured for this shipment — continuing straight to the simulated
            negotiation.
          </p>
        </div>

        {simulateBlock}
        {ended && <LiveResultSummary result={result} />}

        <div className="flex justify-end">
          <Button size="lg" onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Live demo — talk to the agent</h1>
        <p className="text-muted-foreground">
          Emma calls {spec.counterpartyName} to negotiate the transport leg ({spec.origin} →{" "}
          {spec.destination}) for {spec.productName}. Answer through your microphone as the
          vendor&apos;s booking desk.
        </p>
      </div>

      <LiveCallCard
        spec={spec}
        onCallStateChange={handleCallStateChange}
        onResult={(r) => {
          setResult(r)
          setEnded(true)
        }}
      />

      {simulateBlock}

      {ended && <LiveResultSummary result={result} />}

      <div className="flex justify-end">
        <Button size="lg" disabled={callInProgress || waitingForSummary} onClick={handleContinue}>
          {ended
            ? "Continue to negotiation"
            : callInProgress
              ? "Live call in progress…"
              : waitingForSummary
                ? "Extracting quote from the call…"
                : "Skip to simulated negotiation"}
        </Button>
      </div>
    </div>
  )
}
