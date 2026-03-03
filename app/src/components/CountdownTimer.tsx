// app/src/components/CountdownTimer.tsx
import { useState, useEffect } from "react";

interface CountdownTimerProps {
  endTime?: number | null;
  className?: string;
}

export const CountdownTimer = ({ endTime, className }: CountdownTimerProps) => {
  const [remainingMs, setRemainingMs] = useState<number>(
    () => (endTime ?? 0) - Date.now()
  );

  useEffect(() => {
    if (endTime === undefined || endTime === null) {
      return;
    }

    const calculateTime = () => {
      setRemainingMs(endTime - Date.now());
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  if (endTime === undefined || endTime === null) {
    return (
      <span
        className={`font-mono font-bold text-muted-foreground ${className || ""}`}
      >
        TBD
      </span>
    );
  }

  const isLowTime = remainingMs > 0 && remainingMs < 3600000; // Less than 1 hour

  if (remainingMs <= 0) {
    return (
      <span className={`font-mono font-bold text-primary ${className || ""}`}>
        Ended
      </span>
    );
  }

  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  const timeLeft = parts.join(" ");

  const stateColorClass = isLowTime
    ? "text-red-600 animate-pulse"
    : "text-primary";

  return (
    <span
      className={`font-mono font-bold ${stateColorClass} ${className || ""}`}
    >
      {timeLeft}
    </span>
  );
};
