import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { BrandingProvider } from "@/contexts/BrandingProvider";
import { useBranding } from "@/hooks/useBranding";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  buildCanonical,
} from "@/lib/seo";

import { Header } from "./header/Header";
import { Footer } from "./Footer";
import { NotificationListener } from "./NotificationListener";
import { PresenceListener } from "./PresenceListener";

interface LayoutProps {
  children: ReactNode;
}

/**
 * Renders Helmet tags that depend on the dynamic branding context.
 * Must be rendered inside BrandingProvider.
 *
 * @param props - Component props
 * @param props.location - Current router location for canonical URLs
 * @param props.businessInfo - Business info for JSON-LD schema
 * @param props.seoSettings - SEO settings for verification tags
 * @returns Helmet element with dynamic SEO tags
 */
const LayoutHelmet = ({
  location,
  businessInfo,
  seoSettings,
}: {
  location: ReturnType<typeof useLocation>;
  businessInfo: ReturnType<typeof useQuery<typeof api.admin.getBusinessInfo>>;
  seoSettings: ReturnType<typeof useQuery<typeof api.admin.getSeoSettings>>;
}) => {
  const branding = useBranding();

  return (
    <Helmet>
      <title>{DEFAULT_TITLE}</title>
      <meta name="description" content={DEFAULT_DESCRIPTION} />
      <link rel="canonical" href={buildCanonical(location.pathname)} />
      <link rel="alternate" hrefLang="en-ZA" href={SITE_URL} />
      <meta property="og:site_name" content={branding?.appName ?? SITE_NAME} />
      <meta property="og:title" content={DEFAULT_TITLE} />
      <meta property="og:description" content={DEFAULT_DESCRIPTION} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={buildCanonical(location.pathname)} />
      <meta property="og:image" content={DEFAULT_OG_IMAGE} />
      <meta property="og:locale" content="en_ZA" />
      <meta name="twitter:card" content="summary_large_image" />
      {businessInfo?.businessName && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: businessInfo.businessName ?? SITE_NAME,
            url: businessInfo.website ?? SITE_URL,
            logo: businessInfo.logoUrl ?? `${SITE_URL}/logo.png`,
            description:
              businessInfo.businessDescription ?? DEFAULT_DESCRIPTION,
            address: {
              "@type": "PostalAddress",
              streetAddress: businessInfo.streetAddress ?? "123 Harvest Road",
              addressLocality:
                businessInfo.addressLocality ?? "Agricultural Hub",
              addressCountry: businessInfo.addressCountry ?? "ZA",
              postalCode: businessInfo.postalCode ?? "4500",
            },
            contactPoint: {
              "@type": "ContactPoint",
              telephone: businessInfo.telephone ?? "+27-11-555-0123",
              email: businessInfo.email ?? undefined,
              contactType: "customer service",
            },
            sameAs: businessInfo.sameAs ?? [],
          })}
        </script>
      )}
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
            gtag('config', ${JSON.stringify(seoSettings.ga4MeasurementId)});
          `}</script>
        )}
    </Helmet>
  );
};

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
  const businessInfo = useQuery(api.admin.getBusinessInfo);

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
      <BrandingProvider>
        <LayoutHelmet
          location={location}
          businessInfo={businessInfo}
          seoSettings={seoSettings}
        />
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
      </BrandingProvider>
    </UserProfileProvider>
  );
};
