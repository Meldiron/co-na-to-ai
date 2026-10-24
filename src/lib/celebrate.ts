const COLORS = ["#11457e", "#d7141a", "#ffffff"]

export async function celebrate(): Promise<void> {
  const { default: confetti } = await import("canvas-confetti")
  const burst: confetti.Options = { particleCount: 110, spread: 75, startVelocity: 60, ticks: 260, colors: COLORS, shapes: ["square"], disableForReducedMotion: true }
  void confetti({ ...burst, angle: 60, origin: { x: 0, y: 0.8 } })
  void confetti({ ...burst, angle: 120, origin: { x: 1, y: 0.8 } })
}
