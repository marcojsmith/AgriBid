// app/src/App.tsx
import { lazy, Suspense, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";

import { useSession } from "@/lib/auth-client";

import { Layout } from "./components/Layout";
import { LoadingIndicator } from "./components/LoadingIndicator";
import { RegisterSW } from "./components/RegisterSW";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import { clearBadge } from "./lib/pushNotifications";
import type { PushSubscriptionData } from "./lib/pushNotifications";

// Lazy-loaded components
const Home = lazy(() => import("./pages/Home"));
const AuctionDetail = lazy(() => import("./pages/AuctionDetail"));
const Sell = lazy(() => import("./pages/Sell"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminModeration = lazy(() => import("./pages/admin/AdminModeration"));
const AdminAuctions = lazy(() => import("./pages/admin/AdminAuctions"));
const AdminMarketplace = lazy(() => import("./pages/admin/AdminMarketplace"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminFinance = lazy(() => import("./pages/admin/AdminFinance"));
const AdminAnnouncements = lazy(
  () => import("./pages/admin/AdminAnnouncements")
);
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
const AdminEquipmentCatalog = lazy(
  () => import("./pages/admin/AdminEquipmentCatalog")
);
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminErrorReportingSettings = lazy(
  () => import("./pages/admin/AdminErrorReportingSettings")
);
const AdminErrorReports = lazy(() => import("./pages/admin/AdminErrorReports"));
const AdminSEOSettings = lazy(() => import("./pages/admin/AdminSEOSettings"));
const AdminBusinessInfo = lazy(() => import("./pages/admin/AdminBusinessInfo"));
const AdminFAQ = lazy(() => import("./pages/admin/AdminFAQ"));
const AdminFees = lazy(() => import("./pages/admin/AdminFees"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const MyBids = lazy(() => import("./pages/dashboard/MyBids"));
const MyListings = lazy(() => import("./pages/dashboard/MyListings"));
const KYC = lazy(() => import("./pages/KYC"));
const Support = lazy(() => import("./pages/Support"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));

/**
 * Global loading fallback for lazy-loaded routes.
 * @returns A loading spinner centered in the viewport
 */
const PageLoader = () => (
  <div className="flex h-[60vh] items-center justify-center bg-background">
    <LoadingIndicator />
  </div>
);

/**
 * Mounts the client-side router and declares application routes within the main layout.
 *
 * Declared routes:
 * - "/" → Home
 * - "/login" → Login
 * - "/auction/:id" → AuctionDetail
 * - "/profile/:userId" → Profile
 * - "/sell" → Sell
 * - "/faq" → FAQ
 * - "/watchlist" → Watchlist (protected, allowedRole="any")
 * - "/dashboard/bids" → MyBids (protected, allowedRole="any")
 * - "/dashboard/listings" → MyListings (protected, allowedRole="any")
 * - "/admin/*" → Admin sub-routes (protected, allowedRole="admin")
 *   - /admin, /admin/dashboard, /admin/moderation
 *   - /admin/marketplace, /admin/auctions, /admin/users
 *   - /admin/finance, /admin/announcements, /admin/support
 *   - /admin/audit, /admin/settings, /admin/seo, /admin/faq, /admin/fees
 * - "/kyc" → KYC (protected, allowedRole="any")
 * - "/support" → Support (protected, allowedRole="any")
 * - "/notifications" → Notifications (protected, allowedRole="any")
 * - "/settings" → Settings (protected, allowedRole="any")
 *
 * @returns The root JSX element containing the BrowserRouter, layout and route definitions
 */
function App() {
  const { data: session } = useSession();
  const updatePushSub = useMutation(api.users.updatePushSubscription);

  // Clear PWA badge on mount and when the app regains visibility
  useEffect(() => {
    void clearBadge();
    const handler = () => {
      if (document.visibilityState === "visible") void clearBadge();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // Listen for push subscription changes from the service worker
  const handleSWMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") {
        if (!session) return;
        const sub = event.data.subscription as PushSubscriptionData | undefined;
        if (sub?.endpoint && sub?.keys) {
          void updatePushSub({
            pushNotificationsEnabled: true,
            pushSubscription: {
              endpoint: sub.endpoint,
              expirationTime: sub.expirationTime,
              keys: sub.keys,
            },
          });
        }
      }
    },
    [session, updatePushSub]
  );

  useEffect(() => {
    navigator.serviceWorker?.addEventListener("message", handleSWMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
    };
  }, [handleSWMessage]);

  return (
    <BrowserRouter>
      <RegisterSW />
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auction/:id" element={<AuctionDetail />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/sell" element={<Sell />} />
            <Route path="/faq" element={<FAQ />} />
            <Route
              path="/watchlist"
              element={
                <RoleProtectedRoute allowedRole="any">
                  <Watchlist />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/bids"
              element={
                <RoleProtectedRoute allowedRole="any">
                  <MyBids />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard/listings"
              element={
                <RoleProtectedRoute allowedRole="any">
                  <MyListings />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/moderation"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminModeration />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/marketplace"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminMarketplace />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/auctions"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminAuctions />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminUsers />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/finance"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminFinance />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/announcements"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminAnnouncements />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/support"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminSupport />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminAudit />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/equipment-catalog"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminEquipmentCatalog />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminSettings />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/error-reports"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminErrorReports />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/error-reporting"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminErrorReportingSettings />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/seo"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminSEOSettings />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/business-info"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminBusinessInfo />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/faq"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminFAQ />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/fees"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminFees />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/kyc"
              element={
                <RoleProtectedRoute allowedRole="any">
                  <KYC />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <RoleProtectedRoute allowedRole="any">
                  <Support />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <RoleProtectedRoute allowedRole="any">
                  <Notifications />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <RoleProtectedRoute allowedRole="any">
                  <Settings />
                </RoleProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
