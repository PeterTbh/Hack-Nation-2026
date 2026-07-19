"use client"

import { Download } from "lucide-react"
import type { NegotiationReport } from "@/lib/types"
import { formatMoney, nodeTypeLabels } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ExecutiveSummary({ report }: { report: NegotiationReport }) {
  const spec = report.productSpec
  const recommended = report.paths.find((p) => p.id === report.recommendedPathId) ?? report.paths[0]
  const allNodes = report.paths.flatMap((p) => p.nodes)
  const liveNode = allNodes.find((n) => n.live)

  const redFlags = allNodes.flatMap((n) =>
    n.redFlags.map((flag) => ({ counterparty: n.counterparty, flag }))
  )
  const missingFromCalls = allNodes.flatMap((n) =>
    (n.missingInformation ?? []).map((item) => ({ counterparty: n.counterparty, item }))
  )

  const obtained: string[] = [
    `Recommended route: ${recommended.label} at ${formatMoney(recommended.landedCostEur)} landed cost.`,
  ]
  if (liveNode) {
    obtained.push(
      `Live-negotiated ${nodeTypeLabels[liveNode.nodeType].toLowerCase()} quote from ${liveNode.counterparty}: ${formatMoney(liveNode.totalPrice, liveNode.currency)}.`
    )
    if (liveNode.transitDays) obtained.push(`Confirmed transit time: ${liveNode.transitDays} days.`)
    if (liveNode.paymentTerms) obtained.push(`Confirmed payment terms: ${liveNode.paymentTerms}.`)
    if (liveNode.freeDays) obtained.push(`Confirmed free days: ${liveNode.freeDays}.`)
    obtained.push(`Quote is ${liveNode.binding ? "" : "not "}binding.`)
  } else {
    obtained.push("Every figure below is simulated — no live vendor call has been completed for this shipment yet.")
  }

  const missing: string[] = []
  if (!liveNode) {
    missing.push("No live-negotiated quote yet — every number is a simulated estimate, not a confirmed vendor rate.")
  } else {
    if (!liveNode.transitDays) missing.push(`Transit time not confirmed by ${liveNode.counterparty}.`)
    if (!liveNode.paymentTerms) missing.push(`Payment terms not confirmed by ${liveNode.counterparty}.`)
    if (!liveNode.freeDays) missing.push(`Free days not confirmed by ${liveNode.counterparty}.`)
  }
  missing.push(...missingFromCalls.map((m) => `${m.item} (${m.counterparty})`))

  return (
    <Card id="executive-summary" className="print:shadow-none print:ring-0">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Executive Summary</CardTitle>
          <CardDescription>Everything captured — and everything still open — in one page.</CardDescription>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 print:hidden" onClick={() => window.print()}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export as PDF
        </Button>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <section className="space-y-1.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Shipment</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            <dt className="text-muted-foreground">Product</dt>
            <dd>{spec.productName}</dd>
            <dt className="text-muted-foreground">Route</dt>
            <dd>
              {spec.origin} → {spec.destination}
            </dd>
            <dt className="text-muted-foreground">Weight / pallets</dt>
            <dd>
              {spec.weightKg.toLocaleString()} kg · {spec.palletCount} pallets
            </dd>
            <dt className="text-muted-foreground">Cargo value</dt>
            <dd>{formatMoney(spec.cargoValueEur)}</dd>
          </dl>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Recommendation</h3>
          <p>{report.executiveSummary}</p>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Information obtained
          </h3>
          <ul className="list-disc space-y-1 pl-4">
            {obtained.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Missing / not yet confirmed
          </h3>
          {missing.length === 0 ? (
            <p className="text-muted-foreground">Nothing outstanding — all key terms were confirmed.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-4 text-warn">
              {missing.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </section>

        {redFlags.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Red flags</h3>
            <ul className="list-disc space-y-1 pl-4 text-destructive">
              {redFlags.map((r, i) => (
                <li key={i}>
                  {r.flag} ({r.counterparty})
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  )
}
