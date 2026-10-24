import type { PuzzleSecret } from "./types.ts"

const SALT = "ptali-jsme-se-100-ai"

function keyFor(date: string): Uint8Array {
  return new TextEncoder().encode(`${SALT}:${date}`)
}

function xor(bytes: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length]
  return out
}

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function encodeSecret(secret: PuzzleSecret, date: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify(secret))
  return toBase64(xor(bytes, keyFor(date)))
}

export function decodeSecret(encoded: string, date: string): PuzzleSecret {
  const bytes = xor(fromBase64(encoded), keyFor(date))
  return JSON.parse(new TextDecoder().decode(bytes)) as PuzzleSecret
}
