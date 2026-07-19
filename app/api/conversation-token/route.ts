// Mints a short-lived WebRTC conversation token for one of the ElevenLabs
// agents (the transport negotiator or the intake secretary). Runs server-side
// only so the API key never reaches the browser.

type AgentKey = "transport" | "intake"

const AGENT_ENV_VAR: Record<AgentKey, string> = {
  transport: "ELEVENLABS_AGENT_ID_TRANSPORT",
  intake: "ELEVENLABS_AGENT_ID_INTAKE",
}

export async function GET(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey || apiKey === "PASTE_YOUR_KEY_HERE") {
    return Response.json(
      { error: "ELEVENLABS_API_KEY is not configured in .env.local" },
      { status: 500 }
    )
  }

  const agentParam = (new URL(request.url).searchParams.get("agent") ?? "transport") as AgentKey
  const envVar = AGENT_ENV_VAR[agentParam]
  if (!envVar) {
    return Response.json({ error: `Unknown agent "${agentParam}"` }, { status: 400 })
  }

  const agentId = process.env[envVar]
  if (!agentId) {
    return Response.json({ error: `${envVar} is not configured in .env.local` }, { status: 500 })
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
