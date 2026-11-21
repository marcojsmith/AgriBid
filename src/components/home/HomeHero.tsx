import { Link } from "react-router-dom";
import { Clock, FileText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

interface HomeHeroProps {
  /**
   * Photo of the first live sale's lead lot. When missing the hero shows the
   * plain hero colour; no stock photo is used.
   */
  imageUrl?: string;
}

const PROOF_POINTS = [
  { icon: ShieldCheck, label: "FICA-verified sellers" },
  { icon: FileText, label: "Condition-reported lots" },
  { icon: Clock, label: "Anti-sniping soft close" },
] as const;

/**
 * The Home hero: the value proposition, the two entry actions and a strip of
 * trust points over the lead photo of the first live sale.
 *
 * The photo is decorative (`alt=""`) and loads eagerly because it is above the
 * fold. A gradient from the hero token keeps the text readable on any photo.
 *
 * @param props - Component props
 * @param props.imageUrl - Lead photo of the first live sale, if any
 * @returns The hero section
 */
export function HomeHero({ imageUrl }: HomeHeroProps) {
  return (
    <section
      aria-labelledby="home-hero-title"
      data-slot="home-hero"
      className="relative overflow-hidden bg-hero text-hero-foreground"
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 size-full object-cover object-[60%_45%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-b from-hero/30 via-hero/90 via-45% to-hero/95 md:bg-linear-to-r md:from-hero/95 md:from-40% md:via-hero/55 md:via-70% md:to-transparent"
          />
        </>
      ) : null}
      <div className="container relative mx-auto flex flex-col gap-3 px-4 py-4 md:gap-3.5 md:py-8">
        <h1
          id="home-hero-title"
          className="max-w-[24ch] text-2xl leading-[1.15] md:max-w-[34ch] md:text-4xl"
        >
          South Africa&rsquo;s online auction floor for serious farm machinery
        </h1>
        <p className="max-w-[48ch] text-sm text-hero-foreground/90 md:text-[17px]">
          Verified sellers. Inspected equipment. Every bid on the record.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            className="bg-hero-foreground px-3 text-[13px] text-hero hover:bg-hero-foreground/90 md:px-4 md:text-sm"
          >
            <Link to="/auctions">Browse live auctions</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-hero-foreground/50 bg-transparent px-3 text-[13px] text-hero-foreground hover:bg-hero-foreground/10 hover:text-hero-foreground md:px-4 md:text-sm"
          >
            <Link to="/sell">Sell your equipment</Link>
          </Button>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-medium md:text-sm">
          {PROOF_POINTS.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-1.5">
              <Icon aria-hidden="true" className="size-4 text-hero-muted" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
