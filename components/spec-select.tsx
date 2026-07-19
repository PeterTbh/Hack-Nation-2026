"use client"

import type { ProductSpec } from "@/lib/types"
import { formatMoney } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShipmentIntake } from "@/components/shipment-intake"

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
        <h1 className="text-2xl font-semibold tracking-tight">Ship something with OpenBid</h1>
        <p className="text-muted-foreground">
          The AI voice agent calls your freight forwarder, negotiates the transport quote live
          between any two cities, and shows you the full landed cost.
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
        <div className="grid gap-3 sm:grid-cols-2">
          {specs.map((spec) => (
            <Card key={spec.id} size="sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium">{spec.productName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-foreground">
                <p className="truncate">
                  {spec.origin} → {spec.destination}
                </p>
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
