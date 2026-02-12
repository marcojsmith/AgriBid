// app/src/components/CountdownTimer.tsx
import { useState, useEffect } from "react";

interface CountdownTimerProps {
  endTime: number;
}

export const CountdownTimer = ({ endTime }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const calculateTime = () => {
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setTimeLeft(parts.join(" "));
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  const isLowTime = endTime - Date.now() < 3600000; // Less than 1 hour

  return (
    <span className={`font-mono font-bold ${isLowTime && timeLeft !== "Ended" ? "text-red-600 animate-pulse" : "text-primary"}`}>
      {timeLeft}
    </span>
  );
};
