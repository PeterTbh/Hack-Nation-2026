"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react"
import { ConversationProvider, useConversation } from "@elevenlabs/react"
import type { ProductSpec } from "@/lib/types"
import {
  parseIntakeFromDataCollection,
  parseIntakeSummary,
  type DataCollectionResults,
  type IntakeTranscriptLine,
} from "@/lib/parse-intake-summary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type CallPhase = "idle" | "connecting" | "active" | "ended" | "error"

interface VoiceIntakeCardProps {
  onResult: (spec: Partial<ProductSpec> | null) => void
  onCallStateChange?: (inProgress: boolean) => void
}

// Wraps arbitrary client-tool call parameters in the same { key: { value } }
// shape as ElevenLabs' Data Collection results, so both mechanisms can reuse
// the one field-mapping function (parseIntakeFromDataCollection).
function toDataCollectionShape(params: Record<string, unknown>): DataCollectionResults {
  const out: DataCollectionResults = {}
  for (const [key, value] of Object.entries(params ?? {})) out[key] = { value }
  return out
}

export function VoiceIntakeCard(props: VoiceIntakeCardProps) {
  return (
    <ConversationProvider>
      <VoiceIntakeCardInner {...props} />
    </ConversationProvider>
  )
}

function VoiceIntakeCardInner({ onResult, onCallStateChange }: VoiceIntakeCardProps) {
  const [phase, setPhase] = useState<CallPhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<IntakeTranscriptLine[]>([])
  const [seconds, setSeconds] = useState(0)
  const [parseState, setParseState] = useState<"pending" | "parsed" | "failed" | null>(null)
  const transcriptRef = useRef<IntakeTranscriptLine[]>([])
  const conversationIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Set the instant the agent calls the submit_shipment_spec tool — the most
  // reliable path, since it doesn't depend on the agent reciting an exact
  // spoken sentence. When set, the transcript/summary fallback in
  // finalizeCall is skipped entirely.
  const toolSpecRef = useRef<Partial<ProductSpec> | null>(null)

  // Mirrors LiveCallCard's finalizeCall: the live stream can miss the agent's
  // final message, so fall back to re-fetching the authoritative transcript.
  async function finalizeCall() {
    if (toolSpecRef.current) return
    const local = parseIntakeSummary(transcriptRef.current)
    if (local) {
      setParseState("parsed")
      onResult(local)
      return
    }

    setParseState("pending")
    const id = conversationIdRef.current
    if (id) {
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise((r) => setTimeout(r, attempt === 0 ? 2500 : 4000))
        try {
          const res = await fetch(`/api/conversations/${id}`)
          if (!res.ok) continue
          const data = await res.json()
          const lines: IntakeTranscriptLine[] = ((data.transcript ?? []) as { role: string; message: string | null }[])
            .filter((t) => t.message)
            .map((t) => ({ role: t.role === "agent" ? "agent" : "user", text: t.message as string }))
          if (lines.length > transcriptRef.current.length) {
            transcriptRef.current = lines
            setTranscript(lines)
          }
          const parsed = parseIntakeSummary(lines)
          if (parsed) {
            setParseState("parsed")
            onResult(parsed)
            return
          }
          const dcResults = data.analysis?.data_collection_results as DataCollectionResults | undefined
          if (dcResults && Object.keys(dcResults).length > 0) {
            const extracted = parseIntakeFromDataCollection(dcResults)
            if (extracted) {
              setParseState("parsed")
              onResult(extracted)
              return
            }
            break // analysis is in and holds no usable spec — stop waiting
          }
        } catch {
          // transient — retry
        }
      }
    }
    setParseState("failed")
    onResult(null)
  }

  const conversation = useConversation({
    // Primary mechanism: the agent calls this tool once it has gathered every
    // field, passing structured parameters directly — no transcript parsing
    // needed. Requires a matching Client Tool named "submit_shipment_spec" to
    // be configured on the agent in the ElevenLabs dashboard (see
    // agent/intake-prompt.md).
    clientTools: {
      submit_shipment_spec: (params: Record<string, unknown>) => {
        const spec = parseIntakeFromDataCollection(toDataCollectionShape(params))
        if (!spec) {
          return "Missing required fields (product, origin, or destination) — please ask again before calling this tool."
        }
        toolSpecRef.current = spec
        setParseState("parsed")
        onResult(spec)
        return "Shipment spec captured."
      },
    },
    onMessage: ({ message, source }) => {
      const line: IntakeTranscriptLine = { role: source === "ai" ? "agent" : "user", text: message }
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
      if (!toolSpecRef.current) void finalizeCall()
    },
    onError: (message) => {
      setError(message)
      setPhase("error")
      onCallStateChange?.(false)
      if (!toolSpecRef.current) onResult(null)
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
    toolSpecRef.current = null
    setTranscript([])
    onCallStateChange?.(true)
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      const res = await fetch("/api/conversation-token?agent=intake")
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Failed to get conversation token")
      conversation.startSession({
        conversationToken: body.token,
        connectionType: "webrtc",
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the call")
      setPhase("error")
      onCallStateChange?.(false)
    }
  }, [conversation, onCallStateChange])

  return (
    <Card className="border-brand/40">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base font-medium">
          <span className="flex items-center gap-2">
            <PhaseDot phase={phase} isSpeaking={conversation.isSpeaking} />
            Voice intake
          </span>
          {phase === "active" && (
            <span className="text-sm font-normal tabular-nums text-muted-foreground">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Describe the shipment out loud — the assistant asks one question at a time and fills the
          form below for you to review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {phase === "active" && (
          <Badge variant="outline" className="border-brand/40 text-brand">
            {conversation.isSpeaking ? "Assistant is speaking…" : "Assistant is listening…"}
          </Badge>
        )}

        {transcript.length > 0 && (
          <div ref={scrollRef} className="max-h-56 space-y-2 overflow-y-auto rounded-md bg-muted/50 p-3">
            {transcript.map((line, i) => (
              <p key={i} className={cn("text-xs", line.role === "agent" ? "text-foreground" : "text-muted-foreground")}>
                <span className="font-medium">{line.role === "agent" ? "Assistant" : "You"}:</span>{" "}
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
            {parseState === "parsed" && "Spec captured — review the fields below before starting."}
            {parseState === "pending" && "Call ended — extracting the spec from the transcript…"}
            {parseState === "failed" &&
              "Couldn't extract a complete spec from that call — fill in or correct the fields below manually."}
          </p>
        )}
        {error && <p className="text-xs text-destructive">⚠ {error}</p>}

        <div className="flex items-center gap-2">
          {phase === "idle" || phase === "ended" || phase === "error" ? (
            <Button size="sm" onClick={startCall}>
              <Phone className="mr-1.5 h-3.5 w-3.5" />
              {phase === "idle" ? "Start voice intake" : "Try again"}
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
