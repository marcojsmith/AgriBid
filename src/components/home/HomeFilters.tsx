import { useState, type SyntheticEvent } from "react";
import { ChevronDown, Search } from "lucide-react";

import { BottomSheet } from "@/components/ds/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRand } from "@/lib/currency";
import { cn } from "@/lib/utils";

/** One selectable chip with its count. */
export interface FacetOption {
  key: string;
  label: string;
  count: number;
}

/** The price filter: either bound can be unset. */
export interface PriceFilter {
  min?: number;
  max?: number;
}

interface HomeFiltersProps {
  /** Lots in the open sales, shown on the "All" chip. */
  total: number;
  categories: readonly FacetOption[];
  makes: readonly FacetOption[];
  /** Lowest and highest current price, or null to hide the Price chip. */
  priceRange: { min: number; max: number } | null;
  category: string | null;
  make: string | null;
  price: PriceFilter;
  onCategory: (key: string | null) => void;
  onMake: (key: string | null) => void;
  onPrice: (price: PriceFilter) => void;
  /** Submits the search box (navigates to the lot results). */
  onSearch: (query: string) => void;
  className?: string;
}

const CHIP =
  "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border px-3.5 text-[15px] whitespace-nowrap transition-colors";

/**
 * One filter chip. The selected chip is filled; the count is quieter.
 *
 * @param props - Component props
 * @param props.option - The label and count
 * @param props.option.label - The chip text
 * @param props.option.count - The count after the text, if any
 * @param props.selected - Whether the chip is on
 * @param props.onClick - Called on tap
 * @returns The chip button
 */
function Chip({
  option,
  selected,
  onClick,
}: {
  option: { label: string; count?: number };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        CHIP,
        selected
          ? "border-primary bg-primary font-semibold text-primary-foreground"
          : "border-border bg-card hover:bg-accent"
      )}
    >
      {option.label}{" "}
      {option.count === undefined ? null : (
        <span className={cn("num", selected ? "" : "text-muted-foreground")}>
          {option.count}
        </span>
      )}
    </button>
  );
}

/**
 * Home's search box and filters: search, category chips with counts, a Price
 * chip that opens a bottom sheet, and a makes row. Filters with no options are
 * hidden (no categories, no makes, or a single price). Counts come from the
 * data and stay put while a filter is on.
 *
 * @param props - Component props
 * @param props.total - Lots in the open sales
 * @param props.categories - Category chips
 * @param props.makes - Make chips
 * @param props.priceRange - Price bounds, or null to hide the Price chip
 * @param props.category - Selected category key
 * @param props.make - Selected make key
 * @param props.price - Selected price range
 * @param props.onCategory - Called with a key, or null for "All"
 * @param props.onMake - Called with a key, or null to clear
 * @param props.onPrice - Called with the new range
 * @param props.onSearch - Called with the search text on submit
 * @param props.className - Extra classes merged onto the root element
 * @returns The filter block
 */
export function HomeFilters({
  total,
  categories,
  makes,
  priceRange,
  category,
  make,
  price,
  onCategory,
  onMake,
  onPrice,
  onSearch,
  className,
}: HomeFiltersProps) {
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const showPrice = priceRange !== null && priceRange.min < priceRange.max;
  const priceOn = price.min !== undefined || price.max !== undefined;

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const text = query.trim();
    if (text) onSearch(text);
  };

  const parse = (text: string): number | undefined => {
    const value = Number(text.replace(/\s/g, ""));
    return text.trim() !== "" && Number.isFinite(value) && value >= 0
      ? value
      : undefined;
  };

  const apply = () => {
    onPrice({ min: parse(minText), max: parse(maxText) });
    setSheetOpen(false);
  };
  const clear = () => {
    setMinText("");
    setMaxText("");
    onPrice({});
    setSheetOpen(false);
  };

  return (
    <div data-slot="home-filters" className={cn("space-y-3", className)}>
      <form onSubmit={submit} role="search" className="relative">
        <label htmlFor="home-search" className="sr-only">
          Search make or model
        </label>
        <Search
          aria-hidden="true"
          className="absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="home-search"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Search make or model"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          className="h-12 bg-card pl-10 text-base"
        />
      </form>

      <div
        role="group"
        aria-label="Categories"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:px-0"
      >
        <Chip
          option={{ label: "All", count: total }}
          selected={category === null}
          onClick={() => {
            onCategory(null);
          }}
        />
        {categories.map((option) => (
          <Chip
            key={option.key}
            option={option}
            selected={category === option.key}
            onClick={() => {
              onCategory(category === option.key ? null : option.key);
            }}
          />
        ))}
        {showPrice ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-pressed={priceOn}
            onClick={() => {
              setSheetOpen(true);
            }}
            className={cn(
              CHIP,
              priceOn
                ? "border-primary bg-primary font-semibold text-primary-foreground"
                : "border-border bg-card hover:bg-accent"
            )}
          >
            Price
            <ChevronDown aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      {makes.length > 0 ? (
        <div
          role="group"
          aria-label="Makes"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:px-0"
        >
          {makes.map((option) => (
            <Chip
              key={option.key}
              option={option}
              selected={make === option.key}
              onClick={() => {
                onMake(make === option.key ? null : option.key);
              }}
            />
          ))}
        </div>
      ) : null}

      {showPrice ? (
        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Price"
          actions={
            <>
              <Button variant="outline" className="flex-1" onClick={clear}>
                Clear
              </Button>
              <Button className="flex-1" onClick={apply}>
                Show lots
              </Button>
            </>
          }
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Current bids run from {formatRand(priceRange.min)} to{" "}
            {formatRand(priceRange.max)}.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm font-medium">
              From (R)
              <Input
                inputMode="numeric"
                value={minText}
                placeholder={String(priceRange.min)}
                onChange={(event) => {
                  setMinText(event.target.value);
                }}
                className="h-12 text-base"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              To (R)
              <Input
                inputMode="numeric"
                value={maxText}
                placeholder={String(priceRange.max)}
                onChange={(event) => {
                  setMaxText(event.target.value);
                }}
                className="h-12 text-base"
              />
            </label>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}
