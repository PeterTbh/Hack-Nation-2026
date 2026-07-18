import { cn } from "@/lib/utils"

const STEPS = [
  { key: "select", label: "1. Select Product" },
  { key: "live", label: "2. Live Negotiation" },
  { key: "results", label: "3. Results" },
] as const

export type StepKey = (typeof STEPS)[number]["key"]

export function Stepper({ current }: { current: StepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current)

  return (
    <ol className="flex items-center gap-3 text-sm">
      {STEPS.map((step, i) => {
        const isActive = step.key === current
        const isDone = i < currentIndex
        return (
          <li key={step.key} className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                isActive && "bg-brand text-brand-foreground",
                isDone && "bg-muted text-muted-foreground",
                !isActive && !isDone && "bg-secondary text-muted-foreground"
              )}
            >
              {i + 1}
            </span>
            <span className={cn("hidden sm:inline", isActive ? "font-medium text-foreground" : "text-muted-foreground")}>
              {step.label.replace(/^\d+\.\s/, "")}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border sm:w-10" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}
