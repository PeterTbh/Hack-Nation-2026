import type { NodeType } from "@/lib/types"

export function formatMoney(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export const nodeTypeLabels: Record<NodeType, string> = {
  inland_trucking: "Inland Trucking",
  ocean_freight: "Door-to-Door Freight",
  air_freight: "Air Freight",
  customs_brokerage: "Customs Brokerage",
  warehousing: "Warehousing",
  last_mile_delivery: "Last-Mile Delivery",
}
