import { useContext, useState } from "react";

import { Button } from "@/components/ui/button";
import { SignOutOverride, useSignOut } from "@/hooks/useSignOut";

/**
 * The button itself: full width, disabled while signing out.
 *
 * @param props - Component props
 * @param props.signOut - Signs the user out
 * @returns The button
 */
function SignOutView({ signOut }: { signOut: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="mt-8 w-full"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut().finally(() => {
          setBusy(false);
        });
      }}
    >
      Sign out
    </Button>
  );
}

/**
 * The Clerk-backed button (the hook needs `ClerkProvider`).
 *
 * @returns The button
 */
function ClerkSignOutButton() {
  return <SignOutView signOut={useSignOut()} />;
}

/**
 * The full-width "Sign out" button at the bottom of Account.
 *
 * @returns The button
 */
export function SignOutButton() {
  const override = useContext(SignOutOverride);
  return override ? <SignOutView signOut={override} /> : <ClerkSignOutButton />;
}
