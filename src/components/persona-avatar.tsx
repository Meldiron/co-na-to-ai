import { Blobatar } from "@blobatar/react"
import "blobatar/motion.css"

type Props = { id: string; size: number; animate?: "hover" | "always"; className?: string }

export function PersonaAvatar({ id, size, animate, className }: Props) {
  return animate ? (
    <Blobatar name={id} size={size} background="square" animate={animate} className={className} aria-hidden />
  ) : (
    <Blobatar name={id} size={size} background="square" className={className} alt="" />
  )
}
