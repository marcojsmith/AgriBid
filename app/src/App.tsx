// app/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AuctionDetail from "./pages/AuctionDetail";
import Sell from "./pages/Sell";
import { Layout } from "./components/Layout";

/**
 * Mounts the application's client-side router with declared routes.
 *
 * Routes:
 * - "/" → Home
 * - "/auction/:id" → AuctionDetail
 * - "/sell" → Sell
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
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
