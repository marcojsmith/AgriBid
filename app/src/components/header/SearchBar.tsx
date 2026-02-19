// app/src/components/header/SearchBar.tsx
import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  onSearch?: () => void;
  className?: string;
  id?: string;
}

/**
 * Render a search form with an input and leading search icon that navigates to the root path
 * including the entered query as the `q` query parameter when submitted.
 *
 * When a non-empty query is submitted the input is cleared and the optional `onSearch` callback
 * is invoked.
 *
 * @param onSearch - Optional callback invoked after a successful search submission
 * @param className - Optional additional CSS classes applied to the root form element
 * @param id - Optional id for the input element (default: `"search"`)
 */
export function SearchBar({ onSearch, className, id = "search" }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      onSearch?.();
    }
  };

  return (
    <form
      onSubmit={handleSearch}
      className={cn("relative", className)}
    >
      <label htmlFor={id} className="sr-only">
        Search equipment
      </label>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        id={id}
        type="search"
        placeholder="Search equipment..."
        className="pl-10 h-10 bg-muted/50 border-2 rounded-xl focus-visible:ring-primary focus-visible:border-primary font-medium"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </form>
  );
}