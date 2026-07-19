"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { NegotiationMode, NegotiationReport, SupplyChainPath } from "@/lib/types"
import { formatMoney, nodeTypeLabels } from "@/lib/format"
import { LandedCostBreakdown } from "@/components/landed-cost-breakdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export function ResultsView({
  report,
  onRestart,
}: {
  report: NegotiationReport
  onRestart: () => void
}) {
  const sortedPaths = [...report.paths].sort((a, b) => a.landedCostEur - b.landedCostEur)
  const chartData = sortedPaths.map((p) => ({
    name: p.label,
    cost: p.landedCostEur,
    recommended: p.id === report.recommendedPathId,
  }))
  const recommendedPath = report.paths.find((p) => p.id === report.recommendedPathId) ?? sortedPaths[0]
  const mode = report.productSpec.mode
  const isTransport = mode === "transport"

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Recommended supply chain</h1>
        <p className="max-w-2xl text-muted-foreground">{report.executiveSummary}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isTransport ? "Landed cost by path" : "Total cost by option"}</CardTitle>
          <CardDescription>
            {isTransport
              ? `Cargo value (${formatMoney(report.productSpec.cargoValueEur)}) plus all logistics fees — itemized per node below.`
              : "Every negotiated node, itemized per option below — nothing folded into a hidden sum."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tickFormatter={(v: number) => formatMoney(v)}
                  width={95}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.recommended ? "var(--brand)" : "var(--muted-foreground)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isTransport ? "How the landed cost is built" : "How the total cost is built"}</CardTitle>
          <CardDescription>
            {`${recommendedPath.label} (recommended) — every node's negotiated total, summed transparently.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LandedCostBreakdown path={recommendedPath} cargoValueEur={report.productSpec.cargoValueEur} mode={mode} />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Route</TableHead>
              {isTransport && <TableHead className="text-right">Logistics cost</TableHead>}
              <TableHead className="text-right">{isTransport ? "Landed cost" : "Total cost"}</TableHead>
              <TableHead>Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPaths.map((path, i) => {
              const isRecommended = path.id === report.recommendedPathId
              const logisticsCost = path.landedCostEur - report.productSpec.cargoValueEur
              return (
                <TableRow key={path.id} className={cn(isRecommended && "bg-brand/5")}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 whitespace-normal">
                      {path.label}
                      {isRecommended && (
                        <Badge className="bg-brand text-brand-foreground">Recommended</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    {path.nodes.map((n) => nodeTypeLabels[n.nodeType]).join(" → ")}
                  </TableCell>
                  {isTransport && <TableCell className="text-right">{formatMoney(logisticsCost)}</TableCell>}
                  <TableCell className="text-right font-semibold">
                    {formatMoney(path.landedCostEur)}
                  </TableCell>
                  <TableCell>
                    <EvidenceDialog path={path} cargoValueEur={report.productSpec.cargoValueEur} mode={mode} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onRestart}>
          Start over
        </Button>
      </div>
    </div>
  )
}

function EvidenceDialog({
  path,
  cargoValueEur,
  mode,
}: {
  path: SupplyChainPath
  cargoValueEur: number
  mode: NegotiationMode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          View evidence
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{path.label}</DialogTitle>
          <DialogDescription>How the landed cost is built, plus per-node fees and transcripts.</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-muted/50 p-3">
          <LandedCostBreakdown path={path} cargoValueEur={cargoValueEur} mode={mode} />
        </div>

        <div className="space-y-5">
          {path.nodes.map((node) => {
            const wasNegotiated = node.negotiationDelta.finalPrice < node.negotiationDelta.initialPrice
            return (
              <div key={node.id} className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-medium">
                      {node.counterparty}
                      {node.live && (
                        <Badge className="bg-brand text-brand-foreground">Live negotiated</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{nodeTypeLabels[node.nodeType]}</p>
                  </div>
                  <p className="shrink-0 font-semibold">{formatMoney(node.totalPrice, node.currency)}</p>
                </div>
                {node.live && (
                  <p className="text-xs text-muted-foreground">
                    {[
                      node.transitDays ? `Transit ${node.transitDays} days` : null,
                      node.nextSailing ? `Next sailing ${node.nextSailing}` : null,
                      node.freeDays ? `Free days: ${node.freeDays}` : null,
                      node.paymentTerms ? `Payment: ${node.paymentTerms}` : null,
                      `Binding: ${node.binding ? "yes" : "no"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {node.missingInformation && node.missingInformation.length > 0 && (
                  <div className="space-y-1 rounded-md bg-warn/10 p-2 text-xs text-warn">
                    {node.missingInformation.map((item) => (
                      <p key={item}>? Missing: {item}</p>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {node.lineItems.map((item) => (
                    <Badge key={item.label} variant={item.included ? "secondary" : "outline"} className="font-normal">
                      {item.label}: {formatMoney(item.amount, node.currency)}
                    </Badge>
                  ))}
                </div>
                {wasNegotiated && (
                  <p className="text-xs text-brand">
                    Negotiated {formatMoney(node.negotiationDelta.initialPrice, node.currency)} →{" "}
                    {formatMoney(node.negotiationDelta.finalPrice, node.currency)} —{" "}
                    {node.negotiationDelta.leverUsed}
                  </p>
                )}
                {node.redFlags.length > 0 && (
                  <div className="space-y-1 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                    {node.redFlags.map((flag) => (
                      <p key={flag}>⚠ {flag}</p>
                    ))}
                  </div>
                )}
                {node.transcriptQuotes.length > 0 && (
                  <div className="space-y-1 rounded-md bg-muted p-2 text-xs italic text-muted-foreground">
                    {node.transcriptQuotes.map((q, idx) => (
                      <p key={idx}>{q}</p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
