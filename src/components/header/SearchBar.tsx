// app/src/components/header/SearchBar.tsx
import { Search } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  onSearch?: () => void;
  className?: string;
  id?: string;
  /** Focus the field when it mounts (used when the phone search panel opens). */
  autoFocus?: boolean;
}

/**
 * Render a search form with an input and leading search icon.
 *
 * Navigates to the root path (or, on a sale page, that sale) including the entered query as the `q` query parameter when submitted.
 * When a non-empty query is submitted the input is cleared and the optional `onSearch` callback is invoked.
 *
 * @param props - Component props
 * @param props.onSearch - Optional callback invoked after a successful search submission
 * @param props.className - Optional additional CSS classes
 * @param props.id - Optional id for the input element
 * @param props.autoFocus - Focus the input on mount
 * @returns The rendered search bar
 */
export function SearchBar({
  onSearch,
  className,
  id = "search",
  autoFocus = false,
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // On a sale page the header search filters that sale's lots.
  const target = /^\/auctions\/[^/]+$/.test(pathname) ? pathname : "/";

  const handleSearch = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      void navigate(`${target}?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      onSearch?.();
    }
  };

  return (
    <form
      onSubmit={handleSearch}
      role="search"
      className={cn("relative", className)}
    >
      <label htmlFor={id} className="sr-only">
        Search make, model or category
      </label>
      <Search
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
      />
      <Input
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Search make, model or category"
        className="pl-10 h-11 md:h-10 bg-card border rounded-md focus-visible:ring-primary focus-visible:border-primary"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
        }}
      />
    </form>
  );
}
