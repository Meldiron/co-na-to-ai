export type GameRef = { kind: "daily" | "custom"; id: string }

export function refKey(ref: GameRef): string {
  return ref.kind === "custom" ? `vlastni:${ref.id}` : ref.id
}
