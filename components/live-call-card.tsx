"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react"
import { ConversationProvider, useConversation } from "@elevenlabs/react"
import type { CallResult, ProductSpec } from "@/lib/types"
import { buildDynamicVariables } from "@/lib/elevenlabs"
import {
  parseFromDataCollection,
  parseQuoteSummary,
  type DataCollectionResults,
  type TranscriptLine,
} from "@/lib/parse-quote-summary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type CallPhase = "idle" | "connecting" | "active" | "ended" | "error"

interface LiveCallCardProps {
  spec: ProductSpec
  onResult: (result: CallResult | null, transcript: TranscriptLine[]) => void
  onCallStateChange?: (inProgress: boolean) => void
}

export function LiveCallCard(props: LiveCallCardProps) {
  return (
    <ConversationProvider>
      <LiveCallCardInner {...props} />
    </ConversationProvider>
  )
}

function LiveCallCardInner({ spec, onResult, onCallStateChange }: LiveCallCardProps) {
  const [phase, setPhase] = useState<CallPhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [seconds, setSeconds] = useState(0)
  const [parseState, setParseState] = useState<"pending" | "parsed" | "failed" | null>(null)
  const transcriptRef = useRef<TranscriptLine[]>([])
  const conversationIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // The live stream can miss the agent's final message (or the agent can end
  // the call right as it speaks the summary), so if the local transcript has
  // no QUOTE SUMMARY we re-fetch the authoritative transcript from ElevenLabs
  // — it takes a few seconds to become available after the call ends.
  async function finalizeCall() {
    const fallbackName = spec.counterpartyName ?? "Vendor"
    const local = parseQuoteSummary(transcriptRef.current, fallbackName)
    if (local) {
      setParseState("parsed")
      onResult(local, transcriptRef.current)
      return
    }

    setParseState("pending")
    const id = conversationIdRef.current
    if (id) {
      // Two fallback layers, both from the ElevenLabs API: (1) the
      // authoritative transcript may contain a summary the live stream
      // missed; (2) post-call data collection extracts the quote fields from
      // the whole conversation even when no summary was ever spoken. The
      // analysis can take ~10-20s after call end, so keep polling.
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise((r) => setTimeout(r, attempt === 0 ? 2500 : 4000))
        try {
          const res = await fetch(`/api/conversations/${id}`)
          if (!res.ok) continue
          const data = await res.json()
          const lines: TranscriptLine[] = ((data.transcript ?? []) as { role: string; message: string | null }[])
            .filter((t) => t.message)
            .map((t) => ({ role: t.role === "agent" ? "agent" : "vendor", text: t.message as string }))
          if (lines.length > transcriptRef.current.length) {
            transcriptRef.current = lines
            setTranscript(lines)
          }
          const parsed = parseQuoteSummary(lines, fallbackName)
          if (parsed) {
            setParseState("parsed")
            onResult(parsed, lines)
            return
          }
          const dcResults = data.analysis?.data_collection_results as DataCollectionResults | undefined
          if (dcResults && Object.keys(dcResults).length > 0) {
            const extracted = parseFromDataCollection(dcResults, fallbackName)
            if (extracted) {
              setParseState("parsed")
              onResult(extracted, transcriptRef.current)
              return
            }
            break // analysis is in and holds no usable quote — stop waiting
          }
        } catch {
          // transient — retry
        }
      }
    }
    setParseState("failed")
    onResult(null, transcriptRef.current)
  }

  const conversation = useConversation({
    onMessage: ({ message, source }) => {
      const line: TranscriptLine = { role: source === "ai" ? "agent" : "vendor", text: message }
      transcriptRef.current = [...transcriptRef.current, line]
      setTranscript(transcriptRef.current)
    },
    onConnect: ({ conversationId }) => {
      conversationIdRef.current = conversationId
      setPhase("active")
    },
    onDisconnect: () => {
      setPhase("ended")
      onCallStateChange?.(false)
      void finalizeCall()
    },
    onError: (message) => {
      setError(message)
      setPhase("error")
      onCallStateChange?.(false)
    },
  })

  useEffect(() => {
    if (phase !== "active") return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [transcript])

  const startCall = useCallback(async () => {
    setError(null)
    setPhase("connecting")
    setSeconds(0)
    setParseState(null)
    transcriptRef.current = []
    conversationIdRef.current = null
    setTranscript([])
    onCallStateChange?.(true)
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      const res = await fetch(`/api/conversation-token?mode=${spec.mode}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Failed to get conversation token")
      conversation.startSession({
        conversationToken: body.token,
        connectionType: "webrtc",
        dynamicVariables: buildDynamicVariables(spec),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the call")
      setPhase("error")
      onCallStateChange?.(false)
    }
  }, [conversation, spec, onCallStateChange])


  return (
    <Card className="border-brand/40">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base font-medium">
          <span className="flex items-center gap-2">
            <PhaseDot phase={phase} isSpeaking={conversation.isSpeaking} />
            Live call — {spec.counterpartyName ?? "Vendor"}
          </span>
          {phase === "active" && (
            <span className="text-sm font-normal tabular-nums text-muted-foreground">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Emma negotiates ocean freight with {spec.counterpartyType ?? "the vendor"} — you answer
          through your microphone as the vendor&apos;s booking desk.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {phase === "active" && (
          <Badge variant="outline" className="border-brand/40 text-brand">
            {conversation.isSpeaking ? "Emma is speaking…" : "Emma is listening…"}
          </Badge>
        )}

        {transcript.length > 0 && (
          <div ref={scrollRef} className="max-h-56 space-y-2 overflow-y-auto rounded-md bg-muted/50 p-3">
            {transcript.map((line, i) => (
              <p key={i} className={cn("text-xs", line.role === "agent" ? "text-foreground" : "text-muted-foreground")}>
                <span className="font-medium">{line.role === "agent" ? "Emma" : spec.counterpartyName ?? "Vendor"}:</span>{" "}
                {line.text}
              </p>
            ))}
          </div>
        )}

        {phase === "ended" && parseState && (
          <p
            className={cn(
              "text-xs",
              parseState === "parsed" ? "text-brand" : parseState === "pending" ? "text-muted-foreground" : "text-warn"
            )}
          >
            {parseState === "parsed" && "Call complete — quote summary captured and parsed into the results."}
            {parseState === "pending" && "Call ended — extracting the quote from the transcript (takes ~10-20s)…"}
            {parseState === "failed" &&
              "Call ended without a QUOTE SUMMARY — no structured quote could be extracted. You can call again."}
          </p>
        )}
        {error && <p className="text-xs text-destructive">⚠ {error}</p>}

        <div className="flex items-center gap-2">
          {phase === "idle" || phase === "ended" || phase === "error" ? (
            <Button size="sm" onClick={startCall}>
              <Phone className="mr-1.5 h-3.5 w-3.5" />
              {phase === "idle" ? "Start call" : "Call again"}
            </Button>
          ) : (
            <>
              <Button size="sm" variant="destructive" onClick={() => conversation.endSession()} disabled={phase === "connecting"}>
                <PhoneOff className="mr-1.5 h-3.5 w-3.5" />
                {phase === "connecting" ? "Connecting…" : "End call"}
              </Button>
              {phase === "active" && (
                <Button size="sm" variant="outline" onClick={() => conversation.setMuted(!conversation.isMuted)}>
                  {conversation.isMuted ? (
                    <>
                      <MicOff className="mr-1.5 h-3.5 w-3.5" /> Unmute
                    </>
                  ) : (
                    <>
                      <Mic className="mr-1.5 h-3.5 w-3.5" /> Mute
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function PhaseDot({ phase, isSpeaking }: { phase: CallPhase; isSpeaking: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {(phase === "connecting" || (phase === "active" && isSpeaking)) && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
      )}
      <span
        className={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          phase === "idle" && "bg-muted-foreground",
          phase === "connecting" && "bg-warn",
          phase === "active" && "bg-brand",
          phase === "ended" && "bg-brand",
          phase === "error" && "bg-destructive"
        )}
      />
    </span>
  )
}
