import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Muted help under the input, e.g. "13 digits.". Replaced by `error`. */
  hint?: string;
  /** Error text. Replaces the hint, is announced, and marks the input invalid. */
  error?: string;
  /** A boxed segment on the left of the input, e.g. "+27", with a divider. */
  prefix?: ReactNode;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  maxLength?: number;
  className?: string;
}

/**
 * A labelled text input for the registration forms: 15px/600 label, a 52px
 * `rounded-md` input with a `border` token border, an optional prefix segment,
 * and a 14px muted hint or a destructive error (`role="alert"`,
 * `aria-invalid`, `aria-describedby`).
 *
 * @param props - Component props
 * @param props.id - The input id (also the base of the hint and error ids)
 * @param props.label - The visible label
 * @param props.value - The controlled value
 * @param props.onChange - Called with the new text
 * @param props.hint - Muted help text
 * @param props.error - Error text; replaces the hint
 * @param props.prefix - A segment shown before the input
 * @param props.inputMode - The virtual keyboard to show
 * @param props.autoComplete - The autocomplete token
 * @param props.maxLength - Maximum characters
 * @param props.className - Extra classes merged onto the root element
 * @returns The field
 */
export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  prefix,
  inputMode,
  autoComplete,
  maxLength,
  className,
}: TextFieldProps) {
  const helpId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div data-slot="text-field" className={cn("mb-3.5", className)}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      <div
        className={cn(
          "flex h-[52px] items-center gap-2 rounded-md border bg-card px-3.5 focus-within:ring-2 focus-within:ring-ring",
          error ? "border-destructive" : "border-foreground"
        )}
      >
        {prefix ? (
          <span
            id={`${id}-prefix`}
            className="border-r border-border pr-2.5 text-[17px] text-muted-foreground"
          >
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [prefix ? `${id}-prefix` : null, helpId]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className="num h-full min-w-0 flex-1 border-0 bg-transparent text-[17px] font-medium text-foreground outline-none"
        />
      </div>
      {error ? (
        <p
          id={helpId}
          role="alert"
          className="mt-1 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={helpId} className="mt-1 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
