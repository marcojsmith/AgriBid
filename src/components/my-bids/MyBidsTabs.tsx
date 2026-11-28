import { useRef, type KeyboardEvent } from "react";

import {
  MY_BIDS_TABS,
  panelId,
  tabCount,
  tabId,
  tabLabel,
  type MyBidsTab,
  type TabCounts,
} from "@/lib/myBids";
import { cn } from "@/lib/utils";

interface MyBidsTabsProps {
  value: MyBidsTab;
  onChange: (tab: MyBidsTab) => void;
  /** The number under each label. */
  counts: TabCounts;
  className?: string;
}

/**
 * The four My bids tabs (Bidding, Won, Lost, Watching) with the count under
 * each label. A proper tablist: the selected tab is the one tab stop, the
 * arrow keys, Home and End move between tabs, and each tab names its panel.
 * 48px tall, with a 2px underline on the selected tab.
 *
 * @param props - Component props
 * @param props.value - The selected tab
 * @param props.onChange - Called with the newly selected tab
 * @param props.counts - Counts per tab
 * @param props.className - Extra classes merged onto the list
 * @returns The tab list
 */
export function MyBidsTabs({
  value,
  onChange,
  counts,
  className,
}: MyBidsTabsProps) {
  const refs = useRef(new Map<MyBidsTab, HTMLButtonElement>());

  const select = (tab: MyBidsTab) => {
    onChange(tab);
    refs.current.get(tab)?.focus();
  };

  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const last = MY_BIDS_TABS.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    const tab = MY_BIDS_TABS.at(next);
    if (tab) select(tab);
  };

  return (
    <div
      role="tablist"
      aria-label="My bids"
      data-slot="my-bids-tabs"
      className={cn(
        "grid grid-cols-4 border-b border-border lg:max-w-[520px]",
        className
      )}
    >
      {MY_BIDS_TABS.map((tab, index) => {
        const selected = tab === value;
        return (
          <button
            key={tab}
            ref={(el) => {
              if (el) refs.current.set(tab, el);
              else refs.current.delete(tab);
            }}
            type="button"
            role="tab"
            id={tabId(tab)}
            aria-selected={selected}
            aria-controls={selected ? panelId(tab) : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(tab);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
            className={cn(
              "-mb-px flex min-h-12 flex-col items-center justify-center border-b-2 px-1 text-[15px] leading-tight",
              selected
                ? "border-primary font-semibold text-foreground"
                : "border-transparent font-medium text-muted-foreground"
            )}
          >
            {tabLabel(tab)}
            <span className="num text-[13px] font-medium">
              {tabCount(counts, tab)}
              <span className="sr-only"> lots</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
