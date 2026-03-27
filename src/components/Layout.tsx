import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  ORGANIZATION_SCHEMA,
} from "@/lib/seo";

import { Header } from "./header/Header";
import { Footer } from "./Footer";
import { NotificationListener } from "./NotificationListener";
import { PresenceListener } from "./PresenceListener";

interface LayoutProps {
  children: ReactNode;
}

/**
 * Main application layout component.
 *
 * @param props - Component props
 * @param props.children - Child components to render in the layout
 * @returns The rendered application layout
 */
export const Layout = ({ children }: LayoutProps) => {
  const { data: session } = useSession();
  const syncUser = useMutation(api.users.syncUser);
  const userId = session?.user?.id;
  const syncUserRef = useRef(syncUser);
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");

  const seoSettings = useQuery(api.admin.getSeoSettings);

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
    <UserProfileProvider>
      {/* Default SEO — individual pages override via their own <Helmet> */}
      <Helmet>
        <title>{DEFAULT_TITLE}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <link rel="canonical" href={SITE_URL} />
        <link rel="alternate" hrefLang="en-ZA" href={SITE_URL} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={DEFAULT_TITLE} />
        <meta property="og:description" content={DEFAULT_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta property="og:locale" content="en_ZA" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">
          {JSON.stringify(ORGANIZATION_SCHEMA)}
        </script>
        {/* Dynamic analytics/verification — configured via Admin > SEO & Analytics */}
        {seoSettings?.searchConsoleVerification && (
          <meta
            name="google-site-verification"
            content={seoSettings.searchConsoleVerification}
          />
        )}
        {seoSettings?.bingVerification && (
          <meta name="msvalidate.01" content={seoSettings.bingVerification} />
        )}
        {seoSettings?.ga4MeasurementId &&
          /^G-[A-Z0-9]{6,}$/i.test(seoSettings.ga4MeasurementId) && (
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${seoSettings.ga4MeasurementId}`}
            />
          )}
        {seoSettings?.ga4MeasurementId &&
          /^G-[A-Z0-9]{6,}$/i.test(seoSettings.ga4MeasurementId) && (
            <script>{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${seoSettings.ga4MeasurementId}');
          `}</script>
          )}
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        {session && (
          <>
            <NotificationListener />
            <PresenceListener />
          </>
        )}
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
    </UserProfileProvider>
  );
};
