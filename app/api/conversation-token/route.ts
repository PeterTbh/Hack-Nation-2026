// Mints a short-lived WebRTC conversation token for the ElevenLabs shipping
// negotiator agent. Runs server-side only so the API key never reaches the
// browser.

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey || apiKey === "PASTE_YOUR_KEY_HERE") {
    return Response.json(
      { error: "ELEVENLABS_API_KEY is not configured in .env.local" },
      { status: 500 }
    )
  }

  const agentId = process.env.ELEVENLABS_AGENT_ID_TRANSPORT
  if (!agentId) {
    return Response.json(
      { error: "ELEVENLABS_AGENT_ID_TRANSPORT is not configured in .env.local" },
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
