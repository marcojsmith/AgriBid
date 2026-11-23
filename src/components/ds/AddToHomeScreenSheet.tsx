import { Plus, Share } from "lucide-react";

import { BottomSheet } from "@/components/ds/BottomSheet";
import { NumberedSteps } from "@/components/ds/NumberedSteps";
import { Button } from "@/components/ui/button";

interface AddToHomeScreenSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The "Get reminders on iPhone" guide: iOS Safari only allows web push for a
 * site on the Home Screen, so a visitor in a plain Safari tab who taps Remind
 * me sees three steps (Share, Add to Home Screen, then open the app and tap
 * Remind me again) before any notification prompt.
 *
 * @param props - Component props
 * @param props.open - Whether the sheet is open
 * @param props.onOpenChange - Called when the sheet asks to open or close
 * @returns The sheet
 */
export function AddToHomeScreenSheet({
  open,
  onOpenChange,
}: AddToHomeScreenSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Get reminders on iPhone"
      actions={
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Close
        </Button>
      }
    >
      <NumberedSteps
        className="divide-y divide-border [&>li]:py-3"
        steps={[
          <>
            Tap{" "}
            <Share
              aria-hidden="true"
              className="inline size-[18px] align-text-bottom text-[#0a84ff]"
            />{" "}
            <b>Share</b> in Safari&apos;s bottom bar
          </>,
          <>
            Tap <b>Add to Home Screen</b>{" "}
            <Plus
              aria-hidden="true"
              className="inline size-[18px] rounded-[3px] border border-[#0a84ff] align-text-bottom text-[#0a84ff]"
            />
          </>,
          <>
            Open AgriBid from your Home Screen, then tap <b>Remind me</b> again
          </>,
        ]}
      />
    </BottomSheet>
  );
}
