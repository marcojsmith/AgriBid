// app/src/components/CountdownTimer.tsx
import { useState, useEffect } from "react";

interface CountdownTimerProps {
  endTime: number;
}

export const CountdownTimer = ({ endTime }: CountdownTimerProps) => {
  const [remainingMs, setRemainingMs] = useState<number>(
    () => endTime - Date.now(),
  );

  useEffect(() => {
    const calculateTime = () => {
      setRemainingMs(endTime - Date.now());
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  const isLowTime = remainingMs > 0 && remainingMs < 3600000; // Less than 1 hour

  if (remainingMs <= 0) {
    return <span className="font-mono font-bold text-primary">Ended</span>;
  }

  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  const timeLeft = parts.join(" ");

  return (
    <span
      className={`font-mono font-bold ${isLowTime ? "text-red-600 animate-pulse" : "text-primary"}`}
    >
      {timeLeft}
    </span>
  );
};
