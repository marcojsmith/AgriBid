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
const MyBids = lazy(() => import("./pages/dashboard/MyBids"));
const MyListings = lazy(() => import("./pages/dashboard/MyListings"));

/**
 * Global loading fallback for lazy-loaded routes.
 */
const PageLoader = () => (
  <div className="flex h-[60vh] items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

/**
 * Mounts the application's client-side router and declares all application routes.
 *
 * Declared routes:
 * - "/" → Home
 * - "/login" → Login
 * - "/auction/:id" → AuctionDetail
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
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

export default App;