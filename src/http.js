/** Read bounded bytes even when Content-Length is absent or inaccurate. */
export async function readText(response, limit = 1_800_000) {
  if (Number(response.headers.get('content-length') || 0) > limit) {
    await response.body?.cancel();
    throw Error('响应内容过大');
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '', size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw Error('响应内容过大');
      text += decoder.decode(value, {stream:true});
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
}
