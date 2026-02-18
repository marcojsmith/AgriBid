// app/src/App.tsx
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";

// Lazy-loaded components
const Home = lazy(() => import("./pages/Home"));
const AuctionDetail = lazy(() => import("./pages/AuctionDetail"));
const Sell = lazy(() => import("./pages/Sell"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const MyBids = lazy(() => import("./pages/dashboard/MyBids"));
const MyListings = lazy(() => import("./pages/dashboard/MyListings"));
const KYC = lazy(() => import("./pages/KYC"));
const Support = lazy(() => import("./pages/Support"));

/**
 * Global loading fallback for lazy-loaded routes.
 */
const PageLoader = () => (
  <div className="flex h-[60vh] items-center justify-center bg-background" role="status">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" aria-hidden="true"></div>
    <span className="sr-only">Loading page...</span>
  </div>
);

/**
 * Mounts the application's client-side router and declares all application routes.
 *
 * Declared routes:
 * - "/" → Home
 * - "/login" → Login
 * - "/auction/:id" → AuctionDetail
 * - "/profile/:userId" → Profile
 * - "/sell" → Sell
 * - "/watchlist" → Watchlist (protected)
 * - "/dashboard/bids" → MyBids (protected)
 * - "/dashboard/listings" → MyListings (protected)
 * - "/admin" → AdminDashboard (protected, admin only)
 *
 * @returns The root JSX element containing the application's BrowserRouter, layout, and route definitions
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
                  <AdminDashboard />
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
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
