// app/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AuctionDetail from "./pages/AuctionDetail";

/**
 * Renders the application's router with routes for the home page and auction detail page.
 *
 * @returns The root JSX element containing a BrowserRouter with routes: "/" → Home and "/auction/:id" → AuctionDetail.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auction/:id" element={<AuctionDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;