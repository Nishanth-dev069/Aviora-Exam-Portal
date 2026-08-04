/**
 * Computes a hex-encoded SHA-256 hash of the given string.
 * Used to hash device session UUIDs before storage in active_sessions.
 * The plaintext UUID is never stored — only this hash.
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

