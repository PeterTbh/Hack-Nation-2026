// Fetches the authoritative transcript + analysis of a finished conversation
// from ElevenLabs. Used as a fallback/enrichment source after a live call;
// the primary quote parsing happens client-side on the streamed transcript.

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey || apiKey === "PASTE_YOUR_KEY_HERE") {
    return Response.json(
      { error: "ELEVENLABS_API_KEY is not configured in .env.local" },
      { status: 500 }
    )
  }

  const { id } = await ctx.params
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${id}`, {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text()
    return Response.json(
      { error: `ElevenLabs conversation fetch failed (${res.status})`, detail },
      { status: res.status }
    )
  }

  return Response.json(await res.json())
}
