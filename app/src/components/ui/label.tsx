"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Styled wrapper around Radix UI's LabelPrimitive.Root that applies default layout, typography, and disabled-state classes.
 *
 * Forwards all other props to the underlying LabelPrimitive.Root.
 *
 * @param className - Additional CSS classes to merge with the component's default classes
 * @returns The rendered LabelPrimitive.Root element with default styling and any provided classes applied
 */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }