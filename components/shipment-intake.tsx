"use client"

import { useState } from "react"
import { Factory, Truck, Workflow } from "lucide-react"
import type { CompetingQuote, ContainerType, Incoterm, NegotiationMode, ProductSpec } from "@/lib/types"
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
const CONTAINER_TYPES: ContainerType[] = ["20ft", "40ft", "40ft HC", "LCL"]
const COUNTERPARTY_TYPES = ["freight forwarder", "carrier booking desk", "NVOCC"]

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

type QuoteForm = {
  vendor: string
  amountUsd: string
  allIn: "all_in" | "base_plus"
  extras: string
  transitDays: string
  freeDays: string
}

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

  // transport — live call context
  clientName: string
  counterpartyName: string
  counterpartyType: string
  cargoDescription: string
  containerType: ContainerType
  cartonCount: string
  latestArrivalDate: string
  paymentTerms: string
  benchmarkRateUsd: string
  typicalTransitDays: string
  quoteA: QuoteForm
  quoteB: QuoteForm
}

const EMPTY_QUOTE: QuoteForm = {
  vendor: "",
  amountUsd: "",
  allIn: "all_in",
  extras: "",
  transitDays: "",
  freeDays: "",
}

// Live-call context is pre-filled with the demo scenario so a run is one
// click — every field stays editable and flows into the agent verbatim.
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

  clientName: "Northvolt Trading GmbH",
  counterpartyName: "OceanLine Forwarding",
  counterpartyType: "freight forwarder",
  cargoDescription: "",
  containerType: "40ft",
  cartonCount: "",
  latestArrivalDate: "",
  paymentTerms: "30 days net after invoice",
  benchmarkRateUsd: "2800",
  typicalTransitDays: "30–33 days",
  quoteA: {
    vendor: "OceanLine Forwarding",
    amountUsd: "2650",
    allIn: "all_in",
    extras: "",
    transitDays: "32",
    freeDays: "7",
  },
  quoteB: {
    vendor: "TransGlobal Cargo",
    amountUsd: "2400",
    allIn: "base_plus",
    extras: "destination THC USD 280 and documentation USD 95",
    transitDays: "30",
    freeDays: "5",
  },
}

function toCompetingQuote(q: QuoteForm): CompetingQuote | null {
  if (!q.vendor.trim() || !q.amountUsd) return null
  return {
    vendor: q.vendor.trim(),
    amountUsd: Number(q.amountUsd),
    allIn: q.allIn === "all_in",
    extras: q.extras.trim() || undefined,
    transitDays: q.transitDays ? Number(q.transitDays) : undefined,
    freeDays: q.freeDays ? Number(q.freeDays) : undefined,
  }
}

export function ShipmentIntake({ onSubmit }: { onSubmit: (spec: ProductSpec) => void }) {
  const [mode, setMode] = useState<NegotiationMode | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateQuote(which: "quoteA" | "quoteB", key: keyof QuoteForm, value: string) {
    setForm((prev) => ({ ...prev, [which]: { ...prev[which], [key]: value } }))
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
          ? !form.origin.trim() || !form.destination.trim() || !form.clientName.trim() || !form.counterpartyName.trim()
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
        ? {
            origin: form.origin.trim(),
            destination: form.destination.trim(),
            incoterm: form.incoterm,
            clientName: form.clientName.trim(),
            counterpartyName: form.counterpartyName.trim(),
            counterpartyType: form.counterpartyType,
            cargoDescription: form.cargoDescription.trim() || `${form.productName.trim()}, non-hazardous`,
            containerType: form.containerType,
            cartonCount: form.cartonCount ? Number(form.cartonCount) : undefined,
            latestArrivalDate: form.latestArrivalDate || undefined,
            paymentTerms: form.paymentTerms.trim() || undefined,
            benchmarkRateUsd: form.benchmarkRateUsd ? Number(form.benchmarkRateUsd) : undefined,
            typicalTransitDays: form.typicalTransitDays.trim() || undefined,
            competingQuotes: [toCompetingQuote(form.quoteA), toCompetingQuote(form.quoteB)].filter(
              (q): q is CompetingQuote => q !== null
            ),
          }
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
            ? mode === "transport"
              ? "The voice agent opens a real call with this exact context — every number below is what it may honestly use."
              : "Just the basics — the agent figures out the rest during the calls."
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
                  placeholder="e.g. Stainless-steel drinking bottles"
                />
              </div>

              {mode === "transport" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="origin">Origin port</Label>
                    <Input
                      id="origin"
                      value={form.origin}
                      onChange={(e) => update("origin", e.target.value)}
                      placeholder="Port of Shenzhen (Yantian), China"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="destination">Destination port</Label>
                    <Input
                      id="destination"
                      value={form.destination}
                      onChange={(e) => update("destination", e.target.value)}
                      placeholder="Port of Hamburg, Germany"
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
                    {mode === "sourcing" ? "Target ready date" : "Cargo-ready date"}
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

              {mode === "transport" && (
                <TransportCallContext form={form} update={update} updateQuote={updateQuote} />
              )}

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

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-0.5 border-t pt-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function TransportCallContext({
  form,
  update,
  updateQuote,
}: {
  form: FormState
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  updateQuote: (which: "quoteA" | "quoteB", key: keyof QuoteForm, value: string) => void
}) {
  return (
    <div className="grid gap-4">
      <SectionHeading
        title="Shipment details for the call"
        hint="Represented exactly as entered — the agent never invents or exaggerates specs."
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="clientName">Your company (calling on behalf of)</Label>
          <Input
            id="clientName"
            value={form.clientName}
            onChange={(e) => update("clientName", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cargoDescription">Cargo description</Label>
          <Input
            id="cargoDescription"
            value={form.cargoDescription}
            onChange={(e) => update("cargoDescription", e.target.value)}
            placeholder="consumer goods, stainless-steel bottles, non-hazardous"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="containerType">Container</Label>
          <Select value={form.containerType} onValueChange={(v) => update("containerType", v as ContainerType)}>
            <SelectTrigger id="containerType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTAINER_TYPES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "LCL" ? "LCL (shared)" : `${c} FCL`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cartonCount">Cartons (approx.)</Label>
          <Input
            id="cartonCount"
            type="number"
            min="0"
            value={form.cartonCount}
            onChange={(e) => update("cartonCount", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="latestArrivalDate">Latest arrival</Label>
          <Input
            id="latestArrivalDate"
            type="date"
            value={form.latestArrivalDate}
            onChange={(e) => update("latestArrivalDate", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paymentTerms">Payment terms</Label>
          <Input
            id="paymentTerms"
            value={form.paymentTerms}
            onChange={(e) => update("paymentTerms", e.target.value)}
          />
        </div>
      </div>

      <SectionHeading
        title="Who to call"
        hint="The vendor the agent negotiates with on the live call."
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="counterpartyName">Vendor name</Label>
          <Input
            id="counterpartyName"
            value={form.counterpartyName}
            onChange={(e) => update("counterpartyName", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="counterpartyType">Vendor type</Label>
          <Select value={form.counterpartyType} onValueChange={(v) => update("counterpartyType", v)}>
            <SelectTrigger id="counterpartyType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTERPARTY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SectionHeading
        title="Market context — the agent's only legal ammunition"
        hint="Honesty rules: the agent may only cite the benchmark and competing quotes entered here, verbatim. Leave quotes blank to negotiate without them."
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="benchmarkRateUsd">Benchmark all-in rate (USD)</Label>
          <Input
            id="benchmarkRateUsd"
            type="number"
            min="0"
            value={form.benchmarkRateUsd}
            onChange={(e) => update("benchmarkRateUsd", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Quotes 30%+ below this get red-flagged, not celebrated.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="typicalTransitDays">Typical transit time</Label>
          <Input
            id="typicalTransitDays"
            value={form.typicalTransitDays}
            onChange={(e) => update("typicalTransitDays", e.target.value)}
            placeholder="e.g. 30–33 days"
          />
        </div>
      </div>

      <CompetingQuoteRow label="Competing quote A" which="quoteA" quote={form.quoteA} updateQuote={updateQuote} />
      <CompetingQuoteRow label="Competing quote B" which="quoteB" quote={form.quoteB} updateQuote={updateQuote} />
    </div>
  )
}

function CompetingQuoteRow({
  label,
  which,
  quote,
  updateQuote,
}: {
  label: string
  which: "quoteA" | "quoteB"
  quote: QuoteForm
  updateQuote: (which: "quoteA" | "quoteB", key: keyof QuoteForm, value: string) => void
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor={`${which}-vendor`}>Vendor</Label>
          <Input
            id={`${which}-vendor`}
            value={quote.vendor}
            onChange={(e) => updateQuote(which, "vendor", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${which}-amount`}>Rate (USD)</Label>
          <Input
            id={`${which}-amount`}
            type="number"
            min="0"
            value={quote.amountUsd}
            onChange={(e) => updateQuote(which, "amountUsd", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${which}-allin`}>Rate type</Label>
          <Select value={quote.allIn} onValueChange={(v) => updateQuote(which, "allIn", v)}>
            <SelectTrigger id={`${which}-allin`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_in">All-in</SelectItem>
              <SelectItem value="base_plus">Base + extras</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${which}-transit`}>Transit (days)</Label>
          <Input
            id={`${which}-transit`}
            type="number"
            min="0"
            value={quote.transitDays}
            onChange={(e) => updateQuote(which, "transitDays", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${which}-free`}>Free days</Label>
          <Input
            id={`${which}-free`}
            type="number"
            min="0"
            value={quote.freeDays}
            onChange={(e) => updateQuote(which, "freeDays", e.target.value)}
          />
        </div>
      </div>
      {quote.allIn === "base_plus" && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${which}-extras`}>Extras billed on top</Label>
          <Input
            id={`${which}-extras`}
            value={quote.extras}
            onChange={(e) => updateQuote(which, "extras", e.target.value)}
            placeholder="e.g. destination THC USD 280 and documentation USD 95"
          />
        </div>
      )}
    </div>
  )
}
