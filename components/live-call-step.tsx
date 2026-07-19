"use client"

import { useState } from "react"
import type { CallResult, NegotiationReport } from "@/lib/types"
import { mergeLiveResult } from "@/lib/merge-live-result"
import { LiveCallCard } from "@/components/live-call-card"
import { LiveResultSummary } from "@/components/live-result-summary"
import { Button } from "@/components/ui/button"

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
