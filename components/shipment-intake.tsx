"use client"

import { useState } from "react"
import type { CompetingQuote, ProductSpec } from "@/lib/types"
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

// Fixed for this demo — the agent ("Emma") always calls the same freight
// forwarder persona, so who to call isn't a user decision.
const FIXED_COUNTERPARTY_NAME = "OceanLine Forwarding"
const FIXED_COUNTERPARTY_TYPE = "freight forwarder"
const FIXED_INCOTERM = "FOB" as const

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

  // live call context
  clientName: string
  cargoDescription: string
  latestArrivalDate: string
  paymentTerms: string
  benchmarkRateUsd: string
  typicalTransitDays: string
  quoteA: QuoteForm
  quoteB: QuoteForm
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

  clientName: "Northvolt Trading GmbH",
  cargoDescription: "",
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
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateQuote(which: "quoteA" | "quoteB", key: keyof QuoteForm, value: string) {
    setForm((prev) => ({ ...prev, [which]: { ...prev[which], [key]: value } }))
  }

  function handleSubmit() {
    const missing =
      !form.productName.trim() ||
      !form.origin.trim() ||
      !form.destination.trim() ||
      !form.weightKg ||
      !form.palletCount ||
      !form.cargoValueEur ||
      !form.readyDate ||
      !form.clientName.trim()

    if (missing) {
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
      productName: form.productName.trim(),
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      weightKg,
      palletCount,
      cargoValueEur,
      readyDate: form.readyDate,
      incoterm: FIXED_INCOTERM,
      specialRequirements: [],
      clientName: form.clientName.trim(),
      counterpartyName: FIXED_COUNTERPARTY_NAME,
      counterpartyType: FIXED_COUNTERPARTY_TYPE,
      cargoDescription: form.cargoDescription.trim() || `${form.productName.trim()}, non-hazardous`,
      latestArrivalDate: form.latestArrivalDate || undefined,
      paymentTerms: form.paymentTerms.trim() || undefined,
      benchmarkRateUsd: form.benchmarkRateUsd ? Number(form.benchmarkRateUsd) : undefined,
      typicalTransitDays: form.typicalTransitDays.trim() || undefined,
      competingQuotes: [toCompetingQuote(form.quoteA), toCompetingQuote(form.quoteB)].filter(
        (q): q is CompetingQuote => q !== null
      ),
    }

    setError(null)
    onSubmit(spec)
    setForm(EMPTY_FORM)
  }

  return (
    <Card className="border-brand/30">
      <CardHeader>
        <CardTitle className="text-xl">Start a new negotiation</CardTitle>
        <CardDescription>
          The voice agent opens a real call with this exact context — every number below is what it
          may honestly use.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="origin">Origin city</Label>
              <Input
                id="origin"
                value={form.origin}
                onChange={(e) => update("origin", e.target.value)}
                placeholder="Shenzhen, China"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="destination">Destination city</Label>
              <Input
                id="destination"
                value={form.destination}
                onChange={(e) => update("destination", e.target.value)}
                placeholder="Hamburg, Germany"
              />
            </div>
          </div>

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
              <Label htmlFor="cargoValueEur">Cargo value (€)</Label>
              <Input
                id="cargoValueEur"
                type="number"
                min="0"
                value={form.cargoValueEur}
                onChange={(e) => update("cargoValueEur", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="readyDate">Cargo-ready date</Label>
            <Input
              id="readyDate"
              type="date"
              value={form.readyDate}
              onChange={(e) => update("readyDate", e.target.value)}
            />
          </div>

          <TransportCallContext form={form} update={update} updateQuote={updateQuote} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button size="lg" onClick={handleSubmit}>
              Start Negotiation
            </Button>
          </div>
        </div>
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

      <div className="grid grid-cols-2 gap-4">
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
