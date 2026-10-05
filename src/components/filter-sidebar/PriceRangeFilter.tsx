import { FilterGroup } from "./FilterGroup";
import { FilterSelect } from "./FilterSelect";
import { MAX_PRICE_OPTIONS, MIN_PRICE_OPTIONS } from "./filterHelpers";

/**
 * Props for the {@link PriceRangeFilter} component.
 */
interface PriceRangeFilterProps {
  /**
   * Lowest price; empty means no lower bound.
   */
  minPrice: string;
  /**
   * Highest price; empty means no upper bound.
   */
  maxPrice: string;
  /**
   * Called with the chosen lower bound, or an empty string to clear it.
   */
  onMinPriceChange: (value: string) => void;
  /**
   * Called with the chosen upper bound, or an empty string to clear it.
   */
  onMaxPriceChange: (value: string) => void;
}

/**
 * Price range filter with fixed rand bands for the lower and upper bound.
 *
 * @param props - Component props.
 * @param props.minPrice - Lowest price.
 * @param props.maxPrice - Highest price.
 * @param props.onMinPriceChange - Called with the chosen lower bound.
 * @param props.onMaxPriceChange - Called with the chosen upper bound.
 * @returns The price range filter.
 */
export function PriceRangeFilter({
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
}: PriceRangeFilterProps) {
  return (
    <FilterGroup
      label="Price Range (ZAR)"
      labelProps={{ id: "price-range-label" }}
    >
      <div className="grid grid-cols-2 gap-2">
        <FilterSelect
          value={minPrice}
          anyLabel="Min"
          placeholder="Min"
          ariaLabel="Minimum price"
          ariaLabelledBy="price-range-label"
          options={MIN_PRICE_OPTIONS}
          onChange={onMinPriceChange}
        />
        <FilterSelect
          value={maxPrice}
          anyLabel="Max"
          placeholder="Max"
          ariaLabel="Maximum price"
          ariaLabelledBy="price-range-label"
          options={MAX_PRICE_OPTIONS}
          onChange={onMaxPriceChange}
        />
      </div>
    </FilterGroup>
  );
}
