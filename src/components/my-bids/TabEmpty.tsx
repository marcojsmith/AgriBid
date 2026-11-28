import { Eye } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

interface TabEmptyProps {
  title: string;
  text?: string;
  /** Show the "Browse auctions" button. */
  browse?: boolean;
  /** Primary (filled) instead of outline button, for a new buyer. */
  primary?: boolean;
}

/**
 * An empty state: a soft eye icon, a Lora title, one line and, when asked,
 * "Browse auctions". Used for a new buyer with nothing anywhere (filled
 * button) and for a single empty tab (outline button).
 *
 * @param props - Component props
 * @param props.title - The heading ("No bids yet")
 * @param props.text - One supporting line
 * @param props.browse - Whether to show "Browse auctions"
 * @param props.primary - Fill the button
 * @returns The empty state
 */
export function TabEmpty({ title, text, browse, primary }: TabEmptyProps) {
  return (
    <div
      data-slot="my-bids-empty"
      className="mx-auto flex max-w-md flex-col items-center px-2 py-12 text-center"
    >
      <span
        aria-hidden="true"
        className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary"
      >
        <Eye className="size-6" />
      </span>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {text ? (
        <p className="mt-1 text-[15px] text-muted-foreground">{text}</p>
      ) : null}
      {browse ? (
        <Button
          asChild
          variant={primary ? "default" : "outline"}
          className="mt-6 w-full"
        >
          <Link to="/auctions">Browse auctions</Link>
        </Button>
      ) : null}
    </div>
  );
}
