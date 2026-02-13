import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Renders the alert dialog root element with a data-slot attribute and forwards all props.
 *
 * @param props - Props to apply to the alert dialog root; all are forwarded to the underlying element.
 * @returns A React element rendering the alert dialog root with `data-slot="alert-dialog"`.
 */
function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

/**
 * Renders the alert dialog trigger element and sets data-slot="alert-dialog-trigger".
 *
 * @param props - Props forwarded to the underlying trigger element.
 * @returns The alert dialog trigger element.
 */
function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

/**
 * Renders a portal for alert-dialog content and sets data-slot="alert-dialog-portal" for styling hooks.
 *
 * @returns A React element that mounts its children into a portal for the alert dialog.
 */
function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

/**
 * Renders the dimmed, animated backdrop for the alert dialog.
 *
 * @param className - Additional CSS classes merged with the component's default backdrop styles.
 * @param props - Additional props forwarded to Radix Overlay.
 * @returns The overlay element rendered behind the alert dialog content.
 */
function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders the alert dialog's content area inside a portal with its backdrop overlay.
 *
 * The content element is centered, animated on open/close, and supports two size presets that affect max width and responsive layout.
 *
 * @param className - Additional CSS class names to apply to the content container
 * @param size - Size preset for the content layout; `"default"` uses the normal max width, `"sm"` uses a smaller max width
 * @returns The alert dialog content element (wrapped in a portal and paired with the overlay)
 */
function AlertDialogContent({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
  size?: "default" | "sm"
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-lg",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

/**
 * Renders the alert dialog header and applies layout and slot attributes used for styling.
 *
 * @param className - Optional additional CSS classes to extend or override header styles.
 * @param props - Additional attributes and event handlers forwarded to the underlying `div`.
 * @returns The header element to place inside the alert dialog content.
 */
function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders the alert dialog footer container with responsive layout and a data-slot attribute.
 *
 * @param className - Additional class names merged into the footer's default classes.
 * @param props - Other HTML div props forwarded to the footer element.
 * @returns The alert dialog footer element with responsive layout and data-slot="alert-dialog-footer".
 */
function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders the alert dialog title element with slot metadata and default styling.
 *
 * Applies a data-slot of "alert-dialog-title" and merges any provided `className`
 * with the component's default title styles to ensure consistent layout inside the dialog.
 *
 * @returns The rendered AlertDialog title element
 */
function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "text-lg font-semibold sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders the AlertDialog description element with consistent styling and a data-slot attribute for targeting.
 *
 * @returns The rendered dialog description element.
 */
function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

/**
 * Renders a styled container for media (icon or visual) inside the alert dialog.
 *
 * @param className - Additional CSS classes to merge with the component's default styles.
 * @returns The composed div element serving as the alert dialog's media slot.
 */
function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "bg-muted mb-2 inline-flex size-16 items-center justify-center rounded-md sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders a styled action button wired to the alert dialog's action control.
 *
 * @param className - Optional additional CSS class names applied to the action.
 * @param variant - Visual variant of the Button.
 * @param size - Size of the Button.
 * @returns A React element representing the alert dialog action.
 */
function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Action
        data-slot="alert-dialog-action"
        className={cn(className)}
        {...props}
      />
    </Button>
  )
}

/**
 * Renders a themed cancel action for an alert dialog.
 *
 * Renders a Button (as child) that acts as the AlertDialog cancel control and attaches `data-slot="alert-dialog-cancel"`.
 *
 * @param variant - Button visual variant; defaults to `"outline"`.
 * @param size - Button size; defaults to `"default"`.
 * @returns The cancel button element for use inside an AlertDialog.
 */
function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Cancel
        data-slot="alert-dialog-cancel"
        className={cn(className)}
        {...props}
      />
    </Button>
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}