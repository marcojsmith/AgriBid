export const Header = () => {
  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="font-black text-2xl tracking-tighter text-primary">AGRIBID</div>
        <nav className="hidden md:flex gap-6 text-sm font-bold uppercase tracking-wider">
          <span>Marketplace</span>
          <span>Sell</span>
          <span>Watchlist</span>
        </nav>
      </div>
    </header>
  );
};
