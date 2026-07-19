"use client"

import { useState } from "react"
import type { NegotiationReport, ProductSpec } from "@/lib/types"
import { getReportForSpec, productSpecs } from "@/lib/mockData"
import { SpecSelect } from "@/components/spec-select"
import { LiveCallStep } from "@/components/live-call-step"
import { NegotiatingStep } from "@/components/negotiating-step"
import { ResultsView } from "@/components/results-view"
import { Stepper, type StepKey } from "@/components/stepper"

export default function Home() {
  const [step, setStep] = useState<StepKey>("select")
  const [report, setReport] = useState<NegotiationReport | null>(null)

  function handleStart(spec: ProductSpec) {
    setReport(getReportForSpec(spec))
    setStep("live-call")
  }

  // Returned once the user leaves the live-call step, already enriched with
  // any real negotiated quote merged into the paths.
  function handleLiveContinue(nextReport: NegotiationReport) {
    setReport(nextReport)
    setStep("negotiating")
  }

  function handleNegotiatingComplete() {
    setStep("results")
  }

  function handleRestart() {
    setStep("select")
    setReport(null)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10">
      <div className="flex items-center justify-end gap-4 print:hidden">
        <Stepper current={step} />
      </div>

      {step === "select" && <SpecSelect specs={productSpecs} onStart={handleStart} />}
      {step === "live-call" && report && (
        <LiveCallStep report={report} onContinue={handleLiveContinue} />
      )}
      {step === "negotiating" && report && (
        <NegotiatingStep report={report} onComplete={handleNegotiatingComplete} />
      )}
      {step === "results" && report && <ResultsView report={report} onRestart={handleRestart} />}
    </main>
  )
}
