// Persists live-negotiated quotes per route (localStorage) so a later call
// on the same lane can hand them to the agent as real competing quotes —
// the only numbers Emma's honesty rules allow her to cite. This is what
// makes a second call "more informed": she negotiates against what the
// first call actually produced instead of only the user-entered context.

import type { CallResult, CompetingQuote, ProductSpec } from "@/lib/types"
import { USD_TO_EUR } from "@/lib/merge-live-result"

const STORAGE_KEY = "openbid-prior-quotes"
const MAX_PER_ROUTE = 3

interface StoredQuote {
  route: string
  vendor: string
  amountUsd: number
  capturedAt: number // epoch ms
}

function routeKey(spec: Pick<ProductSpec, "origin" | "destination">): string {
  return `${spec.origin.trim().toLowerCase()}→${spec.destination.trim().toLowerCase()}`
}

function readAll(): StoredQuote[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as StoredQuote[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePriorQuote(spec: ProductSpec, result: CallResult): void {
  if (typeof window === "undefined") return
  if (result.outcome !== "quote" || result.totalPrice <= 0) return
  const amountUsd =
    result.currency === "EUR" ? Math.round(result.totalPrice / USD_TO_EUR) : result.totalPrice
  const route = routeKey(spec)
  // Newest quote per vendor wins; keep only the most recent few per route.
  const rest = readAll().filter((q) => !(q.route === route && q.vendor === result.counterparty))
  const forRoute = rest.filter((q) => q.route === route).slice(-(MAX_PER_ROUTE - 1))
  const others = rest.filter((q) => q.route !== route)
  const next: StoredQuote[] = [
    ...others,
    ...forRoute,
    { route, vendor: result.counterparty, amountUsd, capturedAt: Date.now() },
  ]
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage full/blocked — the demo just proceeds without memory
  }
}

// Quotes previously negotiated on this route, as competing quotes for the
// next call. The vendor label carries the provenance so Emma can honestly
// say where the number comes from.
export function loadPriorQuotes(spec: ProductSpec): CompetingQuote[] {
  const route = routeKey(spec)
  return readAll()
    .filter((q) => q.route === route)
    .map((q) => ({
      vendor: `${q.vendor} (quoted to us directly on an earlier call)`,
      amountUsd: q.amountUsd,
      allIn: true,
    }))
}

// Merges stored prior quotes into the spec's competing quotes without
// duplicating vendors the user already entered manually.
export function withPriorQuotes(spec: ProductSpec): ProductSpec {
  const prior = loadPriorQuotes(spec)
  if (prior.length === 0) return spec
  const existing = new Set((spec.competingQuotes ?? []).map((q) => q.vendor.toLowerCase()))
  const fresh = prior.filter((q) => !existing.has(q.vendor.toLowerCase()))
  if (fresh.length === 0) return spec
  return { ...spec, competingQuotes: [...(spec.competingQuotes ?? []), ...fresh].slice(0, 4) }
}
