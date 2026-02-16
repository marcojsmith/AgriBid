import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { X, Filter, RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";

interface FilterSidebarProps {
  onClose?: () => void;
}

export const FilterSidebar = ({ onClose }: FilterSidebarProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeMakes = useQuery(api.auctions.getActiveMakes) || [];

  // Local state for debounced inputs
  const [localFilters, setLocalFilters] = useState({
    make: searchParams.get("make") || "",
    minYear: searchParams.get("minYear") || "",
    maxYear: searchParams.get("maxYear") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    maxHours: searchParams.get("maxHours") || "",
  });

  // Sync local state when URL params change (e.g. on Reset)
  useEffect(() => {
    setLocalFilters({
      make: searchParams.get("make") || "",
      minYear: searchParams.get("minYear") || "",
      maxYear: searchParams.get("maxYear") || "",
      minPrice: searchParams.get("minPrice") || "",
      maxPrice: searchParams.get("maxPrice") || "",
      maxHours: searchParams.get("maxHours") || "",
    });
  }, [searchParams]);

  const updateParam = (key: string, value: string) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(localFilters).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    setSearchParams(newParams);
    if (onClose) onClose();
  };

  const clearFilters = () => {
    const q = searchParams.get("q");
    const newParams = new URLSearchParams();
    if (q) newParams.set("q", q);
    setSearchParams(newParams);
    if (onClose) onClose();
  };

  const hasFilters = Object.values(localFilters).some(v => v !== "");

  return (
    <div className="flex flex-col h-full bg-card border-2 rounded-3xl overflow-hidden shadow-xl shadow-primary/5 animate-in slide-in-from-left-4 duration-300">
      <div className="p-6 border-b flex justify-between items-center bg-muted/30">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="font-black uppercase tracking-tight text-sm">Filter Equipment</h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Manufacturer Filter */}
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Manufacturer</label>
          <select 
            value={localFilters.make}
            onChange={(e) => updateParam("make", e.target.value)}
            className="w-full h-12 rounded-xl border-2 bg-background px-3 font-bold text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
          >
            <option value="">All Manufacturers</option>
            {activeMakes.map(make => (
              <option key={make} value={make}>{make}</option>
            ))}
          </select>
        </div>

        {/* Year Range */}
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Year Model</label>
          <div className="grid grid-cols-2 gap-3">
            <Input 
              type="number" 
              placeholder="From" 
              min={1900}
              value={localFilters.minYear}
              onChange={(e) => updateParam("minYear", e.target.value)}
              className="h-12 font-bold rounded-xl border-2"
            />
            <Input 
              type="number" 
              placeholder="To" 
              min={1900}
              value={localFilters.maxYear}
              onChange={(e) => updateParam("maxYear", e.target.value)}
              className="h-12 font-bold rounded-xl border-2"
            />
          </div>
        </div>

        {/* Price Range */}
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Price Range (ZAR)</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">R</span>
              <Input 
                type="number" 
                placeholder="Min" 
                value={localFilters.minPrice}
                onChange={(e) => updateParam("minPrice", e.target.value)}
                className="h-12 pl-7 font-bold rounded-xl border-2"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">R</span>
              <Input 
                type="number" 
                placeholder="Max" 
                value={localFilters.maxPrice}
                onChange={(e) => updateParam("maxPrice", e.target.value)}
                className="h-12 pl-7 font-bold rounded-xl border-2"
              />
            </div>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Max Operating Hours</label>
          <div className="relative">
            <Input 
              type="number" 
              placeholder="e.g. 5000" 
              value={localFilters.maxHours}
              onChange={(e) => updateParam("maxHours", e.target.value)}
              className="h-12 pr-12 font-bold rounded-xl border-2"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-black uppercase">HRS</span>
          </div>
        </div>
      </div>

      <div className="p-6 border-t bg-muted/10 grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          onClick={clearFilters}
          className="h-12 rounded-xl font-black uppercase tracking-tight border-2 gap-2"
          disabled={!hasFilters}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Button 
          onClick={applyFilters}
          className="h-12 rounded-xl font-black uppercase tracking-tight shadow-lg shadow-primary/20"
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
};
