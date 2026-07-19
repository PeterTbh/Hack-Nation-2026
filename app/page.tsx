"use client"

import { useState } from "react"
import type { NegotiationReport, ProductSpec } from "@/lib/types"
import { getReportForSpec, productSpecs } from "@/lib/mockData"
import { SpecSelect } from "@/components/spec-select"
import { LiveView } from "@/components/live-view"
import { ResultsView } from "@/components/results-view"
import { Stepper, type StepKey } from "@/components/stepper"

export default function Home() {
  const [step, setStep] = useState<StepKey>("select")
  const [report, setReport] = useState<NegotiationReport | null>(null)

  function handleStart(spec: ProductSpec) {
    setReport(getReportForSpec(spec))
    setStep("live")
  }

  // The live view returns the report enriched with any real negotiated
  // quote (live ElevenLabs call) merged into the paths.
  function handleLiveComplete(finalReport: NegotiationReport) {
    setReport(finalReport)
    setStep("results")
  }

  function handleRestart() {
    setStep("select")
    setReport(null)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10">
      <div className="flex items-center justify-end gap-4">
        <Stepper current={step} />
      </div>

      {step === "select" && <SpecSelect specs={productSpecs} onStart={handleStart} />}
      {step === "live" && report && <LiveView report={report} onComplete={handleLiveComplete} />}
      {step === "results" && report && <ResultsView report={report} onRestart={handleRestart} />}
    </main>
  )
}
