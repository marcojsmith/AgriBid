import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { SectionHeader } from "@/components/ds/SectionHeader";

const STEPS = [
  {
    title: "Register and get FICA-verified",
    body: "Once, in about 5 minutes. You need your ID and proof of address.",
  },
  {
    title: "Inspect before you bid",
    body: "Photos, an AgriBid condition report, or book a viewing on the farm.",
  },
  {
    title: "Win, pay and collect",
    body: "Pay by EFT within 48 hours and collect within 7 days.",
  },
] as const;

/**
 * "How AgriBid works": three numbered steps and a link to the auction rules.
 * A flat band separated by borders, not cards.
 *
 * @returns The how-it-works section
 */
export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-title"
      data-slot="how-it-works"
      className="border-y border-border bg-muted/40"
    >
      <div className="container mx-auto space-y-5 px-4 py-8 md:py-10">
        <SectionHeader
          id="how-it-works-title"
          title="How AgriBid works"
          controls={
            <Link
              to="/faq"
              className="inline-flex min-h-11 items-center gap-1 rounded-sm font-semibold text-primary hover:underline md:min-h-8"
            >
              Read the auction rules
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          }
        />
        <ol className="grid gap-5 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="num flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary-soft font-semibold text-primary"
              >
                {index + 1}
              </span>
              <div className="space-y-1">
                <h3 className="text-base leading-snug">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
