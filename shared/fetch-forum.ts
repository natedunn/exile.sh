export async function fetchForum(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "exile.sh/1.0 (news feed; contact: hello@natedunn.net)",
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`Patch forum returned ${response.status}`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Empty forum response")
  const decoder = new TextDecoder()
  let size = 0
  let html = ""
  try {
    let chunk = await reader.read()
    while (!chunk.done) {
      const value = chunk.value
      size += value.byteLength
      if (size > 4_000_000) throw new Error("Forum response exceeds 4 MB")
      html += decoder.decode(value, { stream: true })
      chunk = await reader.read()
    }
    return html + decoder.decode()
  } finally {
    await reader.cancel()
  }
}
