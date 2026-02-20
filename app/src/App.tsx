// app/src/App.tsx
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import { LoadingIndicator } from "./components/ui/LoadingIndicator";

// Lazy-loaded components
const Home = lazy(() => import("./pages/Home"));
const AuctionDetail = lazy(() => import("./pages/AuctionDetail"));
const Sell = lazy(() => import("./pages/Sell"));
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
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const MyBids = lazy(() => import("./pages/dashboard/MyBids"));
const MyListings = lazy(() => import("./pages/dashboard/MyListings"));
const KYC = lazy(() => import("./pages/KYC"));
const Support = lazy(() => import("./pages/Support"));
const Notifications = lazy(() => import("./pages/Notifications"));

/**
 * Global loading fallback for lazy-loaded routes.
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
 * - "/watchlist" → Watchlist (protected, allowedRole="any")
 * - "/dashboard/bids" → MyBids (protected, allowedRole="any")
 * - "/dashboard/listings" → MyListings (protected, allowedRole="any")
 * - "/admin" → AdminModeration (protected, allowedRole="admin")
 * - "/admin/dashboard" → AdminModeration (protected, allowedRole="admin")
 * - "/admin/moderation" → AdminModeration (protected, allowedRole="admin")
 * - "/admin/marketplace" → AdminMarketplace (protected, allowedRole="admin")
 * - "/admin/auctions" → AdminAuctions (protected, allowedRole="admin")
 * - "/admin/users" → AdminUsers (protected, allowedRole="admin")
 * - "/admin/finance" → AdminFinance (protected, allowedRole="admin")
 * - "/admin/announcements" → AdminAnnouncements (protected, allowedRole="admin")
 * - "/admin/support" → AdminSupport (protected, allowedRole="admin")
 * - "/admin/audit" → AdminAudit (protected, allowedRole="admin")
 * - "/admin/settings" → AdminSettings (protected, allowedRole="admin")
 * - "/kyc" → KYC (protected, allowedRole="any")
 * - "/support" → Support (protected, allowedRole="any")
 * - "/notifications" → Notifications (protected, allowedRole="any")
 *
 * @returns The root JSX element containing the BrowserRouter, layout and route definitions
 */
function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auction/:id" element={<AuctionDetail />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/sell" element={<Sell />} />
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
                  <AdminModeration />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminModeration />
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
              path="/admin/settings"
              element={
                <RoleProtectedRoute allowedRole="admin">
                  <AdminSettings />
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
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

export default App;