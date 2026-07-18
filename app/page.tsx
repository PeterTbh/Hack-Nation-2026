"use client"

import { useState } from "react"
import type { ProductSpec } from "@/lib/types"
import { getReportForSpec, productSpecs } from "@/lib/mockData"
import { SpecSelect } from "@/components/spec-select"
import { LiveView } from "@/components/live-view"
import { ResultsView } from "@/components/results-view"
import { Stepper, type StepKey } from "@/components/stepper"

export default function Home() {
  const [step, setStep] = useState<StepKey>("select")
  const [spec, setSpec] = useState<ProductSpec | null>(null)

  const report = spec ? getReportForSpec(spec) : undefined

  function handleStart(nextSpec: ProductSpec) {
    setSpec(nextSpec)
    setStep("live")
  }

  function handleRestart() {
    setStep("select")
    setSpec(null)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10">
      <div className="flex items-center justify-end gap-4">
        <Stepper current={step} />
      </div>

      {step === "select" && <SpecSelect specs={productSpecs} onStart={handleStart} />}
      {step === "live" && report && (
        <LiveView report={report} onComplete={() => setStep("results")} />
      )}
      {step === "results" && report && <ResultsView report={report} onRestart={handleRestart} />}
    </main>
  )
}
