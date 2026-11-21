import { ChevronDown } from "lucide-react";

import {
  AuctionEventCard,
  type AuctionEvent,
} from "@/components/auction/AuctionEventCard";
import { SectionHeader } from "@/components/ds/SectionHeader";
import { SegmentedControl } from "@/components/ds/SegmentedControl";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { eventGridPlan, type HomeSort, type HomeView } from "@/lib/homeEvents";

const VIEW_OPTIONS = [
  { value: "live", label: "Live & upcoming" },
  { value: "soon", label: "Closing soon" },
  { value: "results", label: "Results" },
] as const;

/**
 * Explains why a view has no events.
 *
 * @param view - The current view
 * @returns The empty-state message
 */
function emptyMessage(view: HomeView): string {
  switch (view) {
    case "live":
      return "No auctions are live or scheduled right now. Check back soon.";
    case "soon":
      return "No sales close in the next 24 hours.";
    case "results":
      return "Results appear here once a sale closes.";
  }
}

interface EventsSectionProps {
  /** Events to show, already filtered and sorted for `view`. */
  events: readonly AuctionEvent[];
  view: HomeView;
  sort: HomeSort;
  /** Pagination status of the query behind the current view. */
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  onViewChange: (view: HomeView) => void;
  onSortChange: (sort: HomeSort) => void;
  onLoadMore: () => void;
  /** Shown under the list when more sales exist than were loaded. */
  capNotice?: string;
}

/**
 * Placeholder cards shown while the first page of events loads.
 *
 * @returns Three pulsing card outlines
 */
function EventCardSkeletons() {
  return (
    <div
      role="status"
      aria-label="Loading auctions"
      className={eventGridPlan(3).gridClass}
    >
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          data-testid="event-card-skeleton"
          className="animate-pulse overflow-hidden rounded-md border border-border bg-card"
        >
          <div className="aspect-video bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-3/4 rounded-sm bg-muted" />
            <div className="h-4 w-full rounded-sm bg-muted" />
            <div className="h-4 w-1/2 rounded-sm bg-muted" />
            <div className="h-11 w-full rounded-md bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The Home event list: a section header with the view switch (Live & upcoming,
 * Closing soon, Results) and a sort control, then the event cards in a grid
 * that never ends in a gap, with the loading, empty and load-more states.
 *
 * @param props - Component props
 * @param props.events - Events to show, already filtered and sorted
 * @param props.view - Current view
 * @param props.sort - Current sort order
 * @param props.status - Pagination status of the query behind the view
 * @param props.onViewChange - Called when another view is chosen
 * @param props.onSortChange - Called when another sort order is chosen
 * @param props.onLoadMore - Called when "Load more auctions" is pressed
 * @param props.capNotice - Note shown under the list when it is cut off
 * @returns The events section
 */
export function EventsSection({
  events,
  view,
  sort,
  status,
  onViewChange,
  onSortChange,
  onLoadMore,
  capNotice,
}: EventsSectionProps) {
  const plan = eventGridPlan(events.length);
  const hasMore = status === "CanLoadMore" || status === "LoadingMore";

  return (
    <section
      aria-labelledby="home-auctions-title"
      aria-busy={status === "LoadingFirstPage"}
      data-slot="home-events"
      className="container mx-auto space-y-4 px-4 py-6 md:space-y-5 md:py-9"
    >
      <SectionHeader
        id="home-auctions-title"
        title="Auctions"
        className="md:items-center"
        controls={
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              ariaLabel="Show auctions"
              options={VIEW_OPTIONS}
              value={view}
              onChange={onViewChange}
              className="max-w-full"
            />
            {view !== "results" ? (
              <label className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                Sort
                <select
                  value={sort}
                  onChange={(e) => {
                    onSortChange(
                      e.target.value === "newest" ? "newest" : "soonest"
                    );
                  }}
                  className="h-11 rounded-md border border-input bg-card px-2 text-sm font-semibold text-foreground md:h-9"
                >
                  <option value="soonest">Closing soonest</option>
                  <option value="newest">Newest first</option>
                </select>
              </label>
            ) : null}
          </div>
        }
      />

      {status === "LoadingFirstPage" ? (
        <EventCardSkeletons />
      ) : events.length === 0 && !hasMore ? (
        <div
          data-testid="events-empty"
          className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border p-5 text-muted-foreground"
        >
          <p>{emptyMessage(view)}</p>
          {view === "soon" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onViewChange("live");
              }}
            >
              Show live &amp; upcoming
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {events.length > 0 ? (
            <div className={plan.gridClass}>
              {events.map((event, index) => (
                <AuctionEventCard
                  key={event._id}
                  event={event}
                  featured={index === 0 && plan.featuredFirst}
                  className={index === 0 ? plan.firstClass : undefined}
                />
              ))}
            </div>
          ) : null}
          {capNotice ? (
            <p className="text-center text-sm text-muted-foreground">
              {capNotice}
            </p>
          ) : null}
          {status === "CanLoadMore" ? (
            <div className="flex justify-center pt-2">
              <Button
                onClick={onLoadMore}
                variant="outline"
                className="gap-2 px-10"
              >
                Load more auctions
                <ChevronDown aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ) : null}
          {status === "LoadingMore" ? (
            <div className="flex justify-center py-6">
              <LoadingIndicator />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
