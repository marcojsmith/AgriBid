import { cn } from "@/lib/utils";

interface WhatsAppButtonProps {
  /** The `https://wa.me/...` link to open. */
  href: string;
  /** Accessible name. The button shows the logo only. */
  label?: string;
  className?: string;
}

/**
 * The WhatsApp logo glyph (green disc, white handset). Decorative: the
 * surrounding control carries the accessible name.
 *
 * @param props - Component props
 * @param props.className - Extra classes (set the size)
 * @returns The inline SVG
 */
export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("size-[26px] shrink-0", className)}
    >
      <path
        fill="#25D366"
        d="M12 2a10 10 0 0 0-8.600 15L2 22l5.200-1.400A10 10 0 1 0 12 2Z"
      />
      <path
        fill="#fff"
        d="M8.800 7.200c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.400-.3.300-1 1-1 2.400s1 2.800 1.200 3c.1.200 2 3.200 5 4.400 2.500 1 3 .8 3.500.7.600-.1 1.700-.7 1.900-1.400.2-.7.2-1.200.2-1.400-.1-.1-.3-.2-.6-.3l-1.800-.9c-.2-.1-.4-.1-.6.1l-.8 1c-.1.200-.3.200-.6.100-.3-.1-1.200-.4-2.300-1.400-.8-.8-1.400-1.700-1.500-2-.2-.3 0-.4.1-.6l.4-.5c.1-.1.200-.3.300-.4.100-.2 0-.3 0-.5Z"
      />
    </svg>
  );
}

/**
 * The WhatsApp contact button: the green logo in a 44px square with a 1px
 * border and 6px radius, opening a chat. Logo only, with an `aria-label`,
 * never a text label. The green logo means "contact us" and nothing else.
 *
 * @param props - Component props
 * @param props.href - The wa.me link
 * @param props.label - Accessible name (default "WhatsApp us")
 * @param props.className - Extra classes merged onto the link
 * @returns The button link
 */
export function WhatsAppButton({
  href,
  label = "WhatsApp us",
  className,
}: WhatsAppButtonProps) {
  return (
    <a
      data-slot="whatsapp-button"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-card",
        className
      )}
    >
      <WhatsAppGlyph />
    </a>
  );
}
