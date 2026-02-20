import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { NotificationListener } from "./NotificationListener";
import { useSession } from "../lib/auth-client";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { data: session } = useSession();
  const syncUser = useMutation(api.users.syncUser);
  const userId = session?.user?.id;
  const syncUserRef = useRef(syncUser);
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");

  // Intentional empty dependency array: this effect runs on every render
  // to keep syncUserRef.current updated with the latest syncUser function reference,
  // avoiding stale closures in other effects while keeping dependencies clean.
  useEffect(() => {
    syncUserRef.current = syncUser;
     
  });

  useEffect(() => {
    if (userId) {
      syncUserRef.current().catch((error) => {
        console.error("Failed to sync user:", error);
      });
    }
  }, [userId]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {session && <NotificationListener />}
      <Header />
      <main
        className={cn(
          "flex-1",
          !isAdminPage && "container mx-auto px-4 md:px-8 py-4 md:py-8"
        )}
      >
        {children}
      </main>
      {!isAdminPage && <Footer />}
    </div>
  );
};
