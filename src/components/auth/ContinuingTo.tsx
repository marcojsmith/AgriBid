import { MapPin } from "lucide-react";

import { useCallbackLot } from "@/hooks/useCallbackLot";

/**
 * "Continuing to **Lot 3 · New Holland T6070**" with a map-pin icon, shown
 * above the sign-in and sign-up forms when the buyer came from a lot. Renders
 * nothing when the callback is missing, unsafe or not a lot the server knows.
 *
 * @param props - Component props
 * @param props.callbackUrl - The raw `callbackUrl` search parameter
 * @returns The line, or null
 */
export function ContinuingTo({ callbackUrl }: { callbackUrl: string | null }) {
  const callback = useCallbackLot(callbackUrl);
  if (!callback?.lot) return null;
  return (
    <p className="flex items-center gap-2 text-base text-muted-foreground">
      <MapPin aria-hidden="true" className="size-4 shrink-0" />
      <span>
        Continuing to <b className="text-foreground">{callback.label}</b>
      </span>
    </p>
  );
}
