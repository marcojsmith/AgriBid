import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Renders a styled input element with merged classes and forwarded props.
 *
 * @param root0 - Component props.
 * @param root0.className - Optional additional CSS classes merged with the input's default styles.
 * @param root0.type - The HTML input type attribute (e.g., `"text"`, `"file"`, `"password"`).
 * @returns A JSX input element with computed classes, a `data-slot="input"` attribute, and all provided props forwarded.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-9 max-md:h-11 w-full min-w-0 rounded-md border bg-background px-3 py-1 text-base transition-colors file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
