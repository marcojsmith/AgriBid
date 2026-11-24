import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { DepositLines } from "@/components/ds/DepositLines";
import { RegProgress } from "@/components/ds/RegProgress";
import { useCallbackLot } from "@/hooks/useCallbackLot";
import { formatSastDate } from "@/lib/dates";

interface RegisterLayoutProps {
  /** The safe `callbackUrl`, or null. */
  callbackUrl: string | null;
  /** The page heading, e.g. "Your details". */
  title: string;
  /** The line under the heading. */
  intro?: string;
  /** The progress indicator; omit on the status page. */
  progress?: { step: number; total: 3 | 4; label: string };
  /** The deposit setting; the side card shows the deposit lines only when set. */
  deposit?: { amount: number; refundDays: number };
  children: ReactNode;
}

/**
 * The shell shared by every registration page: a back link ("Lot 3 · New
 * Holland T6070", or "Auctions" without a callback), the progress bar,
 * heading and intro, then the page. A single column up to 480px on a phone;
 * from `lg` a second column holds a "Registering to bid on" card with the lot
 * photo, title, number and close time, and the deposit lines when the deposit
 * is on. The app layout supplies the header and footer.
 *
 * @param props - Component props
 * @param props.callbackUrl - The safe return URL, or null
 * @param props.title - The page heading
 * @param props.intro - The line under the heading
 * @param props.progress - Step, total and label
 * @param props.deposit - Deposit amount and refund window, when on
 * @param props.children - The page content
 * @returns The page shell
 */
export function RegisterLayout({
  callbackUrl,
  title,
  intro,
  progress,
  deposit,
  children,
}: RegisterLayoutProps) {
  const callback = useCallbackLot(callbackUrl);
  const back = callback ?? { href: "/", label: "Auctions" };
  const lot = callback?.lot;

  return (
    <div className="mx-auto w-full max-w-[480px] lg:grid lg:max-w-[1000px] lg:grid-cols-[minmax(0,600px)_minmax(0,320px)] lg:justify-between lg:gap-16">
      <div>
        <Link
          to={back.href}
          className="inline-flex min-h-11 items-center gap-1 text-base font-semibold"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
        {progress ? <RegProgress {...progress} /> : null}
        <h1 className="mt-2 font-display text-[28px] leading-tight font-semibold">
          {title}
        </h1>
        {intro ? (
          <p className="mt-1 mb-4 text-base text-muted-foreground">{intro}</p>
        ) : null}
        <div className={intro ? undefined : "mt-4"}>{children}</div>
      </div>

      {lot ? (
        <aside
          aria-label="Registering to bid on"
          className="mt-14 hidden self-start rounded-md border border-border bg-card p-4 lg:block"
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Registering to bid on
          </p>
          <div className="flex gap-3">
            {lot.photoUrl ? (
              <img
                src={lot.photoUrl}
                alt=""
                className="h-16 w-[88px] flex-none rounded-lg object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <b className="block text-base">{lot.title}</b>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {[
                  lot.lotNumber === undefined
                    ? null
                    : `Lot ${String(lot.lotNumber)}`,
                  lot.closesAt === undefined
                    ? null
                    : formatSastDate(lot.closesAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </div>
          {deposit ? (
            <DepositLines
              amount={deposit.amount}
              refundDays={deposit.refundDays}
              className="mt-4"
            />
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
