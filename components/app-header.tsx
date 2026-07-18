"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export function AppHeader() {
  const [lightOk, setLightOk] = useState(true)
  const [darkOk, setDarkOk] = useState(true)

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-6 py-4">
        {!lightOk && !darkOk ? (
          <span className="text-lg font-semibold tracking-tight">OpenBid</span>
        ) : (
          <>
            {lightOk && (
              <img
                src="/logos/openbid-logo.png"
                alt="OpenBid"
                className={cn("h-8 w-auto", darkOk && "dark:hidden")}
                onError={() => setLightOk(false)}
              />
            )}
            {darkOk && (
              <img
                src="/logos/openbid-logo-dark.png"
                alt={lightOk ? "" : "OpenBid"}
                aria-hidden={lightOk}
                className={cn("hidden h-8 w-auto", lightOk ? "dark:block" : "block")}
                onError={() => setDarkOk(false)}
              />
            )}
          </>
        )}
      </div>
    </header>
  )
}
