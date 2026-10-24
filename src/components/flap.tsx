import { useEffect, useState, type CSSProperties } from "react"
import { cn } from "@/lib/utils"

const FLIP_MS = 130

type FlapProps = {
  text: string
  tone?: "dim"
  align?: "center" | "end"
  delay?: number
  className?: string
}

export function Flap({ text, tone, align, delay = 0, className }: FlapProps) {
  const [shown, setShown] = useState(text)
  const [next, setNext] = useState<string | null>(null)

  useEffect(() => {
    if (text === shown) return
    setNext(text)
    const timer = setTimeout(() => {
      setShown(text)
      setNext(null)
    }, delay + FLIP_MS * 2 + 40)
    return () => clearTimeout(timer)
  }, [text, shown, delay])

  const style = { "--flip": `${FLIP_MS}ms`, "--flap-delay": `${delay}ms` } as CSSProperties

  return (
    <span className={cn("flap", className)} data-tone={tone} data-align={align} style={style}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="flap-half flap-top">
        {next ?? shown}
      </span>
      <span aria-hidden className="flap-half flap-bottom">
        {shown}
      </span>
      {next !== null && (
        <>
          <span aria-hidden className="flap-half flap-top flap-fall">
            {shown}
          </span>
          <span aria-hidden className="flap-half flap-bottom flap-rise">
            {next}
          </span>
        </>
      )}
    </span>
  )
}
