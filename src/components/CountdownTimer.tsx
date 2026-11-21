import { Countdown } from "@/components/ds/Countdown";

interface CountdownTimerProps {
  endTime?: number | null;
  className?: string;
}

/**
 * Countdown for an auction or lot. Kept for existing callers; it delegates to
 * the design-system `Countdown` (neutral, amber under 1h, red under 2 min,
 * tabular figures). New code should import `Countdown` from `@/components/ds`.
 *
 * @param props - Component props.
 * @param props.endTime - The end time of the countdown (ms since epoch).
 * @param props.className - The CSS class name for the component.
 * @returns The rendered countdown timer.
 */
export const CountdownTimer = ({ endTime, className }: CountdownTimerProps) => (
  <Countdown endTime={endTime} className={className} />
);
