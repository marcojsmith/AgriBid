// app/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AuctionDetail from "./pages/AuctionDetail";
import Sell from "./pages/Sell";
import AdminDashboard from "./pages/AdminDashboard";
import { Layout } from "./components/Layout";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";

/**
 * Mounts the application's client-side router with declared routes.
 *
 * Routes:
 * - "/" → Home
 * - "/auction/:id" → AuctionDetail
 * - "/sell" → Sell
 * - "/admin" → AdminDashboard (Protected)
 *
 * @returns The root JSX element containing a BrowserRouter with the above routes.
 */
function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auction/:id" element={<AuctionDetail />} />
          <Route path="/sell" element={<Sell />} />
          <Route 
            path="/admin" 
            element={
              <RoleProtectedRoute allowedRole="admin">
                <AdminDashboard />
              </RoleProtectedRoute>
            } 
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
