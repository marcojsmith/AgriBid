import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDay } from "@/lib/myBids";

interface CollectionCardProps {
  lotId: Id<"lots">;
}

/**
 * Where and when to collect a paid lot: the collect-by date, the seller's
 * collection address and phone. The server releases them only once an admin
 * has confirmed the payment, so this is mounted for paid lots only and shows
 * nothing for any other answer.
 *
 * @param props - Component props
 * @param props.lotId - The paid lot
 * @returns The card, a skeleton while loading, or nothing
 */
export function CollectionCard({ lotId }: CollectionCardProps) {
  const details = useQuery(api.lotPayments.getMyCollectionDetails, { lotId });
  if (details === undefined) {
    return <Skeleton className="h-32 w-full rounded-md" />;
  }
  if (details === null) return null;
  const rows: { label: string; value: string; href?: string }[] = [
    { label: "Collect by", value: formatShortDay(details.collectBy) },
    ...(details.collectionAddress
      ? [{ label: "Address", value: details.collectionAddress }]
      : []),
    ...(details.sellerPhone
      ? [
          {
            label: "Seller phone",
            value: details.sellerPhone,
            href: `tel:${details.sellerPhone.replace(/[^\d+]/g, "")}`,
          },
        ]
      : []),
  ];
  return (
    <section
      aria-label="Collection details"
      className="rounded-md border border-border p-4"
    >
      <h4 className="font-display text-lg font-semibold">Collection details</h4>
      <dl className="mt-2 divide-y divide-border border-t border-border text-[15px]">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-4 py-2">
            <dt className="w-28 shrink-0 text-muted-foreground">{row.label}</dt>
            <dd className="font-medium">
              {row.href ? (
                <a
                  href={row.href}
                  className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                >
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
