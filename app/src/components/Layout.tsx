import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { NotificationListener } from "./NotificationListener";
import { useSession } from "../lib/auth-client";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {session && <NotificationListener />}
      <Header />
      <main className="flex-1 container mx-auto px-4 md:px-8 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
};
