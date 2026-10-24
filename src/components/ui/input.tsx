import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-none border-2 border-ink-soft/70 bg-paper px-4 text-base font-medium text-ink caret-red transition-[border-color,box-shadow] outline-none placeholder:font-normal placeholder:text-ink-soft/80 focus-visible:border-ring focus-visible:shadow-[inset_0_0_0_1px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-red file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  )
}

export { Input }
