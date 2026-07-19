// Mints a short-lived WebRTC conversation token for the ElevenLabs agent
// matching the requested negotiation mode. Runs server-side only so the
// API key never reaches the browser.

import type { NegotiationMode } from "@/lib/types"

const AGENT_ID_BY_MODE: Record<NegotiationMode, string | undefined> = {
  transport: process.env.ELEVENLABS_AGENT_ID_TRANSPORT,
  sourcing: process.env.ELEVENLABS_AGENT_ID_SOURCING,
  sourcing_transport: process.env.ELEVENLABS_AGENT_ID_SOURCING_TRANSPORT,
}

export async function GET(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey || apiKey === "PASTE_YOUR_KEY_HERE") {
    return Response.json(
      { error: "ELEVENLABS_API_KEY is not configured in .env.local" },
      { status: 500 }
    )
  }

  const mode = (new URL(request.url).searchParams.get("mode") ?? "transport") as NegotiationMode
  const agentId = AGENT_ID_BY_MODE[mode]
  if (!agentId) {
    return Response.json(
      { error: `No agent configured for mode "${mode}" — set the matching ELEVENLABS_AGENT_ID_* env var` },
      { status: 500 }
    )
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
    { headers: { "xi-api-key": apiKey }, cache: "no-store" }
  )

  if (!res.ok) {
    const detail = await res.text()
    return Response.json(
      { error: `ElevenLabs token request failed (${res.status})`, detail },
      { status: res.status }
    )
  }

  const { token } = await res.json()
  return Response.json({ token })
}
