"use client"

import type { ProductSpec } from "@/lib/types"
import { formatMoney, modeLabels } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShipmentIntake } from "@/components/shipment-intake"

function routeSummary(spec: ProductSpec): string {
  if (spec.mode === "transport") return `${spec.origin} → ${spec.destination}`
  if (spec.mode === "sourcing_transport") return `Open origin → ${spec.destination}`
  return spec.productSpecifications ?? "Sourcing only"
}

export function SpecSelect({
  specs,
  onStart,
}: {
  specs: ProductSpec[]
  onStart: (spec: ProductSpec) => void
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a shipment to negotiate</h1>
        <p className="text-muted-foreground">
          The AI voice agent will call every provider in the supply chain, negotiate quotes, and
          recommend the cheapest end-to-end landed cost.
        </p>
      </div>

      <ShipmentIntake onSubmit={onStart} />

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Quick start — example shipments</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {specs.map((spec) => (
            <Card key={spec.id} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
                  <span className="truncate">{spec.productName}</span>
                  <Badge variant="outline" className="shrink-0 font-normal">
                    {modeLabels[spec.mode]}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-foreground">
                <p className="truncate">{routeSummary(spec)}</p>
                <div className="flex items-center justify-between">
                  <span>{formatMoney(spec.cargoValueEur)}</span>
                  <Button size="sm" variant="secondary" onClick={() => onStart(spec)}>
                    Use example
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
