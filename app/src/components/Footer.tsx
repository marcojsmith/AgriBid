export const Footer = () => {
  return (
    <footer className="bg-muted/30 border-t py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="font-black text-2xl tracking-tighter text-primary">AGRIBID</div>
            <p className="text-xs text-muted-foreground leading-relaxed uppercase font-bold">
              The national marketplace for heavy machinery. Built for farmers, by farmers.
            </p>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">
          © {new Date().getFullYear()} AGRIBID. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
