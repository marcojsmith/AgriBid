import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

/**
 * Registers the service worker and shows toasts for offline-ready
 * and update-available events.
 *
 * @returns null (no visible UI)
 */
export function RegisterSW() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) {
        console.log("Service worker registered:", r.scope);
      }
    },
    onRegisterError(error: Error) {
      console.error("Service worker registration failed:", error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success("App is ready to work offline", {
        duration: 5000,
      });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast("A new version is available", {
        action: {
          label: "Reload",
          onClick: () => {
            void updateServiceWorker(true);
            setNeedRefresh(false);
          },
        },
        onDismiss: () => {
          setNeedRefresh(false);
        },
        duration: Infinity,
      });
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
