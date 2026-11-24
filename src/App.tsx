// app/src/App.tsx
import { lazy, Suspense, type ReactElement } from "react";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

import { Layout } from "./components/Layout";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import { LoadingIndicator } from "./components/LoadingIndicator";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { AdminRoute } from "./components/admin/AdminRoute";

// Lazy-loaded components
const Home = lazy(() => import("./pages/Home"));
const AuctionDetail = lazy(() => import("./pages/AuctionDetail"));
const Sell = lazy(() => import("./pages/Sell"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminModeration = lazy(() => import("./pages/admin/AdminModeration"));
const AdminLots = lazy(() => import("./pages/admin/AdminLots"));
const AdminAuctions = lazy(() => import("./pages/admin/AdminAuctions"));
const AdminAuctionDetail = lazy(
  () => import("./pages/admin/AdminAuctionDetail")
);
const AuctionGallery = lazy(() => import("./pages/AuctionGallery"));
const AuctionContainerDetail = lazy(
  () => import("./pages/AuctionContainerDetail")
);
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
const AdminPerformance = lazy(() => import("./pages/admin/AdminPerformance"));
const FAQ = lazy(() => import("./pages/FAQ"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const AdminLegal = lazy(() => import("./pages/admin/AdminLegal"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const SellerListings = lazy(() => import("./pages/SellerListings"));
const MyBids = lazy(() => import("./pages/dashboard/MyBids"));
const MyListings = lazy(() => import("./pages/dashboard/MyListings"));
const RegisterIndex = lazy(() => import("./pages/register/RegisterIndex"));
const DetailsStep = lazy(() => import("./pages/register/DetailsStep"));
const IdStep = lazy(() => import("./pages/register/IdStep"));
const AddressStep = lazy(() => import("./pages/register/AddressStep"));
const DepositStep = lazy(() => import("./pages/register/DepositStep"));
const RegistrationStatus = lazy(
  () => import("./pages/register/RegistrationStatus")
);
const Support = lazy(() => import("./pages/Support"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Messages = lazy(() => import("./pages/Messages"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Dev-only design-system reference. `import.meta.env.DEV` is a build-time constant,
// so the import (and the page) is removed from production bundles.
const DesignSystem = import.meta.env.DEV
  ? lazy(() => import("./pages/DesignSystem"))
  : null;

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
 * Wraps an element with a RouteErrorBoundary for per-route error isolation.
 *
 * @param element - The route element to wrap
 * @returns The wrapped element
 */
function withBoundary(element: ReactElement): ReactElement {
  return <RouteErrorBoundary>{element}</RouteErrorBoundary>;
}

/**
 * Sends the retired `/kyc` page to `/register`, keeping the query string
 * (for example `?callbackUrl=`).
 *
 * @returns A redirect
 */
function KycRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/register${search}`} replace />;
}

/**
 * Wraps a registration page in the sign-in guard and an error boundary.
 *
 * @param page - The registration page
 * @returns The guarded page
 */
function registerRoute(page: ReactElement): ReactElement {
  return withBoundary(
    <RoleProtectedRoute allowedRole="any">{page}</RoleProtectedRoute>
  );
}

/**
 * Mounts the client-side router and declares application routes within the main layout.
 *
 * Declared routes:
 * - "/" → Home
 * - "/login" → Login
 * - "/auction/:id" → AuctionDetail
 * - "/profile/:userId" → Profile
 * - "/sellers/:userId/listings" → SellerListings (active auctions)
 * - "/sellers/:userId/listings/sold" → SellerListings (past sales)
 * - "/sell" → Sell
 * - "/faq" → FAQ
 * - "/terms", "/privacy", "/paia" → LegalPage (published admin-edited markdown)
 * - "/auctions" → AuctionGallery (public gallery of past/present auctions)
 * - "/auctions/:id" → AuctionContainerDetail (public lot list for one auction)
 * - "/watchlist" → Watchlist (protected, allowedRole="any")
 * - "/dashboard/bids" → MyBids (protected, allowedRole="any")
 * - "/dashboard/listings" → MyListings (protected, allowedRole="any")
 * - "/admin/*" → Admin sub-routes (protected, allowedRole="admin")
 *   - /admin, /admin/dashboard, /admin/moderation
 *   - /admin/marketplace, /admin/lots, /admin/auctions, /admin/auctions/:id, /admin/users
 *   - /admin/finance, /admin/announcements, /admin/support
 *   - /admin/audit, /admin/settings, /admin/seo, /admin/faq, /admin/fees
 *   - /admin/performance, /admin/legal
 * - "/register" → RegisterIndex (protected, allowedRole="any"; redirects to the first unfinished step)
 * - "/register/details", "/register/id", "/register/address", "/register/deposit",
 *   "/register/status" → registration steps (protected, allowedRole="any")
 * - "/kyc" → redirects to "/register", keeping the query string
 * - "/support" → Support (protected, allowedRole="any")
 * - "/notifications" → Notifications (protected, allowedRole="any")
 * - "/messages" → Messages inbox (protected, allowedRole="any")
 * - "/messages/:conversationId" → Messages thread view (protected, allowedRole="any")
 * - "/settings" → Settings (protected, allowedRole="any")
 * - "/design-system" → DesignSystem (development builds only)
 * - "*" → NotFound (catch-all for unknown routes)
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
            <Route
              path="/auction/:id"
              element={withBoundary(<AuctionDetail />)}
            />
            <Route
              path="/profile/:userId"
              element={withBoundary(<Profile />)}
            />
            <Route
              path="/sellers/:userId/listings"
              element={withBoundary(<SellerListings status="active" />)}
            />
            <Route
              path="/sellers/:userId/listings/sold"
              element={withBoundary(<SellerListings status="sold" />)}
            />
            <Route path="/sell" element={withBoundary(<Sell />)} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/terms" element={<LegalPage slug="terms" />} />
            <Route path="/privacy" element={<LegalPage slug="privacy" />} />
            <Route path="/paia" element={<LegalPage slug="paia" />} />
            <Route path="/auctions" element={<AuctionGallery />} />
            <Route
              path="/auctions/:id"
              element={withBoundary(<AuctionContainerDetail />)}
            />
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
              element={withBoundary(
                <RoleProtectedRoute allowedRole="any">
                  <MyBids />
                </RoleProtectedRoute>
              )}
            />
            <Route
              path="/dashboard/listings"
              element={withBoundary(
                <RoleProtectedRoute allowedRole="any">
                  <MyListings />
                </RoleProtectedRoute>
              )}
            />
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/moderation" element={<AdminModeration />} />
              <Route path="/admin/marketplace" element={<AdminMarketplace />} />
              <Route path="/admin/lots" element={<AdminLots />} />
              <Route path="/admin/auctions" element={<AdminAuctions />} />
              <Route
                path="/admin/auctions/:id"
                element={<AdminAuctionDetail />}
              />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/finance" element={<AdminFinance />} />
              <Route
                path="/admin/announcements"
                element={<AdminAnnouncements />}
              />
              <Route path="/admin/support" element={<AdminSupport />} />
              <Route path="/admin/audit" element={<AdminAudit />} />
              <Route
                path="/admin/equipment-catalog"
                element={<AdminEquipmentCatalog />}
              />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route
                path="/admin/error-reports"
                element={<AdminErrorReports />}
              />
              <Route
                path="/admin/error-reporting"
                element={<AdminErrorReportingSettings />}
              />
              <Route path="/admin/seo" element={<AdminSEOSettings />} />
              <Route
                path="/admin/business-info"
                element={<AdminBusinessInfo />}
              />
              <Route path="/admin/faq" element={<AdminFAQ />} />
              <Route path="/admin/legal" element={<AdminLegal />} />
              <Route path="/admin/fees" element={<AdminFees />} />
              <Route path="/admin/performance" element={<AdminPerformance />} />
            </Route>
            <Route path="/kyc" element={<KycRedirect />} />
            <Route
              path="/register"
              element={registerRoute(<RegisterIndex />)}
            />
            <Route
              path="/register/details"
              element={registerRoute(<DetailsStep />)}
            />
            <Route path="/register/id" element={registerRoute(<IdStep />)} />
            <Route
              path="/register/address"
              element={registerRoute(<AddressStep />)}
            />
            <Route
              path="/register/deposit"
              element={registerRoute(<DepositStep />)}
            />
            <Route
              path="/register/status"
              element={registerRoute(<RegistrationStatus />)}
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
              path="/messages"
              element={withBoundary(
                <RoleProtectedRoute allowedRole="any">
                  <Messages />
                </RoleProtectedRoute>
              )}
            />
            <Route
              path="/messages/:conversationId"
              element={withBoundary(
                <RoleProtectedRoute allowedRole="any">
                  <Messages />
                </RoleProtectedRoute>
              )}
            />
            <Route
              path="/settings"
              element={
                <RoleProtectedRoute allowedRole="any">
                  <Settings />
                </RoleProtectedRoute>
              }
            />
            {DesignSystem ? (
              <Route path="/design-system" element={<DesignSystem />} />
            ) : null}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
