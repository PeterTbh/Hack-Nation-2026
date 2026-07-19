// Parses a loosely-structured competing quote — pasted from an email, a
// chat, or just typed in free form — into the same fields the manual
// Competing Quote row asks for. This is the manual-entry counterpart to how
// the live call's spoken QUOTE SUMMARY gets parsed into structured fields:
// the user pastes the number they already have instead of retyping it five
// times into five separate boxes.

export interface ParsedCompetingQuote {
  vendor?: string
  amountUsd?: string
  allIn?: "all_in" | "base_plus"
  extras?: string
  transitDays?: string
  freeDays?: string
}

export function parseCompetingQuoteText(text: string): ParsedCompetingQuote | null {
  const input = text.trim()
  if (!input) return null

  const result: ParsedCompetingQuote = {}

  const amountMatch = input.match(
    /(?:USD|US\$|\$)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:USD|US\$|dollars?)/i
  )
  const rawAmount = amountMatch?.[1] ?? amountMatch?.[2]
  if (rawAmount) result.amountUsd = rawAmount.replace(/,/g, "")

  const hasExtras = /\bplus\b|\bexcl(?:uding|\.)?\b/i.test(input)
  const isAllIn = /all[\s-]?in/i.test(input)
  if (hasExtras) result.allIn = "base_plus"
  else if (isAllIn) result.allIn = "all_in"

  const extrasMatch = input.match(/plus\s+(.+?)(?:,\s*\d+\s*days?|,\s*\d+\s*free|\.|$)/i)
  if (extrasMatch) result.extras = extrasMatch[1].trim()

  const transitMatch =
    input.match(/(\d+)\s*days?\s*(?:transit|in transit)/i) ??
    input.match(/transit(?:\s*time)?(?:\s*of)?\s*(\d+)\s*days?/i)
  if (transitMatch) result.transitDays = transitMatch[1]

  const freeDaysMatch = input.match(/(\d+)\s*free\s*days?/i)
  if (freeDaysMatch) result.freeDays = freeDaysMatch[1]

  const vendorMatch = input.match(/^([A-Z][A-Za-z0-9&.\-\s]{1,40}?)\s+(?:quoted|offered|gave|sent|provided|came in at)/i)
  if (vendorMatch) result.vendor = vendorMatch[1].trim()

  // Nothing usable found — don't silently "succeed" with an empty object.
  if (!result.amountUsd) return null
  return result
}
