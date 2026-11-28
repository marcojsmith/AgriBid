import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

interface SettingsRowProps {
  /** The small label above the value ("Registration"). */
  label: string;
  /** The value, 17px ("You can bid"). */
  value: ReactNode;
  /** Makes the whole row a link with a chevron. */
  to?: string;
  /** A link on the right instead of the chevron ("Replace"). Only without `to`. */
  action?: ReactNode;
}

/**
 * One row of an Account section: a 14px label over a 17px value, a divider
 * under it and a 56px minimum height. With `to` the whole row is a link and
 * shows a chevron; without it the row is plain text (the email, the ID number,
 * or details that are locked), optionally with an `action` link on the right.
 *
 * @param props - Component props
 * @param props.label - The label
 * @param props.value - The value
 * @param props.to - Link target
 * @param props.action - A link at the right edge
 * @returns The list item
 */
export function SettingsRow({ label, value, to, action }: SettingsRowProps) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-muted-foreground">
          {label}
        </span>
        <span className="block text-[17px] leading-snug break-words">
          {value}
        </span>
      </span>
      {to ? (
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      ) : null}
    </>
  );
  return (
    <li className="border-b border-border">
      {to ? (
        <Link
          to={to}
          className="flex min-h-14 items-center gap-3 rounded-sm py-2"
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-h-14 items-center gap-3 py-2">
          {body}
          {action}
        </div>
      )}
    </li>
  );
}

interface AccountSectionProps {
  /** The Lora heading ("Selling"). Also the name of the region. */
  title: string;
  /** Anchor id, for the desktop section list. */
  id: string;
  children: ReactNode;
  className?: string;
}

/**
 * A titled block of Account rows. Sections are flat: a top divider, a 24px
 * Lora heading and a list, never a card.
 *
 * @param props - Component props
 * @param props.title - Heading
 * @param props.id - Section id (the heading is `${id}-heading`)
 * @param props.children - The rows and any link below them
 * @param props.className - Extra classes
 * @returns The section
 */
export function AccountSection({
  title,
  id,
  children,
  className,
}: AccountSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn("scroll-mt-20 border-t border-border pt-5", className)}
    >
      <h2
        id={`${id}-heading`}
        className="font-display text-2xl leading-tight font-semibold"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * A plain list of rows with no markers.
 *
 * @param props - Component props
 * @param props.children - The rows
 * @returns The list
 */
export function RowList({ children }: { children: ReactNode }) {
  return <ul className="mt-2 list-none p-0">{children}</ul>;
}

interface SubPageProps {
  title: string;
  /** Where the back link goes; default Account. */
  backTo?: string;
  backLabel?: string;
  children: ReactNode;
}

/**
 * The shell of an Account sub-page: a "‹ Account" back link, the 28px Lora
 * title and a column no wider than 480px.
 *
 * @param props - Component props
 * @param props.title - Page title
 * @param props.backTo - Back link target
 * @param props.backLabel - Back link text
 * @param props.children - The page
 * @returns The page shell
 */
export function SubPage({
  title,
  backTo = "/account",
  backLabel = "Account",
  children,
}: SubPageProps) {
  return (
    <div className="mx-auto w-full max-w-[480px]">
      <Link
        to={backTo}
        className="inline-flex min-h-11 items-center gap-1 text-base font-semibold"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {backLabel}
      </Link>
      <h1 className="mt-2 font-display text-[28px] leading-tight font-semibold">
        {title}
      </h1>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}
