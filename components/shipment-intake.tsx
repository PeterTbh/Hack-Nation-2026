"use client"

import { useState } from "react"
import { Factory, Truck, Workflow } from "lucide-react"
import type { Incoterm, NegotiationMode, ProductSpec } from "@/lib/types"
import { modeLabels } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const INCOTERMS: Incoterm[] = ["FOB", "EXW", "DDP"]

const MODE_OPTIONS: {
  mode: NegotiationMode
  icon: typeof Factory
  description: string
}[] = [
  {
    mode: "sourcing",
    icon: Factory,
    description: "Find and negotiate the purchase or production of the product itself.",
  },
  {
    mode: "transport",
    icon: Truck,
    description: "Negotiate shipping the product from a known origin to a destination.",
  },
  {
    mode: "sourcing_transport",
    icon: Workflow,
    description: "Optimize sourcing and shipping together for total landed cost.",
  },
]

type FormState = {
  productName: string
  origin: string
  destination: string
  weightKg: string
  palletCount: string
  cargoValueEur: string
  readyDate: string
  incoterm: Incoterm
  productSpecifications: string
  neededByDate: string
}

const EMPTY_FORM: FormState = {
  productName: "",
  origin: "",
  destination: "",
  weightKg: "",
  palletCount: "",
  cargoValueEur: "",
  readyDate: "",
  incoterm: "FOB",
  productSpecifications: "",
  neededByDate: "",
}

export function ShipmentIntake({ onSubmit }: { onSubmit: (spec: ProductSpec) => void }) {
  const [mode, setMode] = useState<NegotiationMode | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function reset() {
    setMode(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  function handleSubmit() {
    if (!mode) return

    const baseMissing = !form.productName.trim() || !form.weightKg || !form.palletCount || !form.cargoValueEur || !form.readyDate
    const modeMissing =
      mode === "sourcing"
        ? !form.productSpecifications.trim() || !form.neededByDate
        : mode === "transport"
          ? !form.origin.trim() || !form.destination.trim()
          : !form.destination.trim() || !form.productSpecifications.trim()

    if (baseMissing || modeMissing) {
      setError("Please fill in every field before starting the negotiation.")
      return
    }

    const weightKg = Number(form.weightKg)
    const palletCount = Number(form.palletCount)
    const cargoValueEur = Number(form.cargoValueEur)

    if (weightKg <= 0 || palletCount <= 0 || cargoValueEur <= 0) {
      setError("Weight, quantity, and value must be greater than zero.")
      return
    }

    const spec: ProductSpec = {
      id: `custom-${Date.now()}`,
      mode,
      productName: form.productName.trim(),
      weightKg,
      palletCount,
      cargoValueEur,
      readyDate: form.readyDate,
      specialRequirements: [],
      ...(mode === "transport"
        ? { origin: form.origin.trim(), destination: form.destination.trim(), incoterm: form.incoterm }
        : mode === "sourcing"
          ? { productSpecifications: form.productSpecifications.trim(), neededByDate: form.neededByDate }
          : { destination: form.destination.trim(), productSpecifications: form.productSpecifications.trim() }),
    }

    setError(null)
    onSubmit(spec)
    reset()
  }

  return (
    <Card className="border-brand/30">
      <CardHeader>
        <CardTitle className="text-xl">Start a new negotiation</CardTitle>
        <CardDescription>
          {mode
            ? "Just the basics — the agent figures out the rest during the calls."
            : "First, choose what OpenBid should handle for this product."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!mode ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {MODE_OPTIONS.map(({ mode: m, icon: Icon, description }) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-colors hover:border-brand hover:bg-brand/5"
              >
                <Icon className="h-5 w-5 text-brand" />
                <span className="font-medium">{modeLabels[m]}</span>
                <span className="text-xs text-muted-foreground">{description}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              ← Change mode ({modeLabels[mode]} selected)
            </button>

            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="productName">Product name</Label>
                <Input
                  id="productName"
                  value={form.productName}
                  onChange={(e) => update("productName", e.target.value)}
                  placeholder="e.g. Ceramic tile pallets"
                />
              </div>

              {mode === "transport" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="origin">Origin</Label>
                    <Input
                      id="origin"
                      value={form.origin}
                      onChange={(e) => update("origin", e.target.value)}
                      placeholder="City or warehouse"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="destination">Destination</Label>
                    <Input
                      id="destination"
                      value={form.destination}
                      onChange={(e) => update("destination", e.target.value)}
                      placeholder="City or warehouse"
                    />
                  </div>
                </div>
              )}

              {mode === "sourcing_transport" && (
                <div className="space-y-1.5">
                  <div className="grid gap-1.5">
                    <Label htmlFor="destination">Destination</Label>
                    <Input
                      id="destination"
                      value={form.destination}
                      onChange={(e) => update("destination", e.target.value)}
                      placeholder="City or warehouse"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Origin is left open on purpose — OpenBid compares sourcing options and their
                    shipping as one decision.
                  </p>
                </div>
              )}

              {(mode === "sourcing" || mode === "sourcing_transport") && (
                <div className="grid gap-1.5">
                  <Label htmlFor="productSpecifications">Product specifications / requirements</Label>
                  <Input
                    id="productSpecifications"
                    value={form.productSpecifications}
                    onChange={(e) => update("productSpecifications", e.target.value)}
                    placeholder="Materials, certifications, packaging, tolerances…"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="weightKg">Weight (kg)</Label>
                  <Input
                    id="weightKg"
                    type="number"
                    min="0"
                    value={form.weightKg}
                    onChange={(e) => update("weightKg", e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="palletCount">Quantity (pallets)</Label>
                  <Input
                    id="palletCount"
                    type="number"
                    min="0"
                    value={form.palletCount}
                    onChange={(e) => update("palletCount", e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cargoValueEur">
                    {mode === "transport" ? "Cargo value (€)" : "Target budget (€)"}
                  </Label>
                  <Input
                    id="cargoValueEur"
                    type="number"
                    min="0"
                    value={form.cargoValueEur}
                    onChange={(e) => update("cargoValueEur", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="readyDate">
                    {mode === "sourcing" ? "Target ready date" : "Ready date"}
                  </Label>
                  <Input
                    id="readyDate"
                    type="date"
                    value={form.readyDate}
                    onChange={(e) => update("readyDate", e.target.value)}
                  />
                </div>

                {mode === "transport" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="incoterm">Incoterm</Label>
                    <Select value={form.incoterm} onValueChange={(v) => update("incoterm", v as Incoterm)}>
                      <SelectTrigger id="incoterm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INCOTERMS.map((term) => (
                          <SelectItem key={term} value={term}>
                            {term}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {mode === "sourcing" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="neededByDate">Needed-by date</Label>
                    <Input
                      id="neededByDate"
                      type="date"
                      value={form.neededByDate}
                      onChange={(e) => update("neededByDate", e.target.value)}
                    />
                  </div>
                )}
              </div>

              {error && <p className={cn("text-sm text-destructive")}>{error}</p>}

              <div className="flex justify-end">
                <Button size="lg" onClick={handleSubmit}>
                  Start Negotiation
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
