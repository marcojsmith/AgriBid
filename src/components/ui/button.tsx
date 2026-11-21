import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-btn text-btn-foreground hover:bg-btn/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Below md the default, sm, lg and icon sizes are 44px tall (tap target).
        default: "h-11 px-4 py-2 has-[>svg]:px-3 md:h-9",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 md:h-8",
        lg: "h-11 rounded-md px-6 has-[>svg]:px-4 md:h-10",
        touch: "h-11 px-4 py-2 has-[>svg]:px-3",
        icon: "size-11 md:size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Render a styled button whose classes are determined by `variant` and `size`, and which can render as a Radix Slot when needed.
 *
 * @param className - Additional CSS classes to merge with the computed variant and size classes.
 * @param variant - Visual variant to apply (e.g., "default", "destructive", "outline", "secondary", "ghost", "link").
 * @param size - Size token to apply (e.g., "default", "sm", "lg", "touch", "xs", "icon", "icon-sm", "icon-lg", "icon-xs").
 * @param asChild - If true, render `Slot.Root` instead of a native `button` so the caller can supply a custom element.
 * @returns A button-like React element with `data-variant` and `data-size` attributes and classes from `buttonVariants`.
 */
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      type,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot.Root : "button";

    return (
      <Comp
        data-slot="button"
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
