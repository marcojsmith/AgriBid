import * as React from "react";
import { XIcon } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Renders the root Dialog element with a `data-slot="dialog"` attribute and forwards all received props.
 *
 * @returns A dialog root element with `data-slot="dialog"` and the provided props applied.
 */
function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

/**
 * Render a trigger element for toggling the dialog.
 *
 * Renders a Radix Dialog Trigger element with data-slot="dialog-trigger" and forwards received props.
 *
 * @returns A React element that acts as the dialog trigger
 */
function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/**
 * Renders a Radix Dialog Portal element and marks it with `data-slot="dialog-portal"`.
 *
 * Note: The `data-slot` attribute will be ignored as Radix's Portal doesn't render a wrapper element.
 *
 * @returns The portal element used to mount dialog content, forwarding all received props to the underlying Radix primitive.
 */
function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

/**
 * Renders the dialog's close control and forwards all received props to the underlying Close primitive.
 *
 * @param props - Props forwarded to the underlying Close primitive element
 * @returns A React element representing the dialog close control
 */
function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/**
 * Renders the dialog backdrop overlay with standardized backdrop styling and open/close animations.
 *
 * The returned element is the Radix Dialog overlay with data-slot="dialog-overlay" and combined classes for positioning, z-index, a semi-opaque black backdrop, and state-based animations.
 *
 * @returns The overlay element used as the dialog backdrop.
 */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Renders the dialog's content inside a portal with an overlay and an optional close control.
 *
 * @param showCloseIcon - When `true`, includes a close control (an X button) in the top-right of the content; when `false`, omits the close control.
 * @returns The dialog content element including its portal and overlay, with children rendered inside and the close control included conditionally.
 */
function DialogContent({
  className,
  children,
  showCloseIcon = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseIcon?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseIcon && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/**
 * Container for dialog header content.
 *
 * Renders a div with consistent header layout classes and a `data-slot="dialog-header"` attribute; forwards remaining div props.
 *
 * @param className - Additional CSS classes to merge with the component's default header classes
 * @returns The header container element for dialog content
 */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

/**
 * Layout container for dialog footer actions that can optionally render a close button.
 *
 * @param showFooterClose - When `true`, renders a "Close" button that triggers the dialog to close.
 * @param children - Elements to display inside the footer (e.g., action buttons).
 * @returns The rendered footer element containing `children` and, if enabled, a close control.
 */
function DialogFooter({
  className,
  showFooterClose = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showFooterClose?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showFooterClose && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

/**
 * Title element for the dialog.
 *
 * Renders a Radix Dialog Title with consistent typography classes and a `data-slot="dialog-title"` attribute.
 *
 * @returns The rendered dialog title element with applied classes and attributes.
 */
function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

/**
 * Dialog description element used to display descriptive text within a dialog.
 *
 * @returns A React element that displays descriptive text styled for dialogs, with a `data-slot="dialog-description"` attribute.
 */
function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
