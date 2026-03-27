import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Helmet } from "react-helmet-async";
import { HelpCircle } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { buildTitle, buildCanonical } from "@/lib/seo";

/**
 * Publicly accessible FAQ page.
 * Displays all published FAQ items fetched from Convex, with FAQPage JSON-LD for rich results.
 *
 * @returns The FAQ page component.
 */
export default function FAQ() {
  const faqs = useQuery(api.faq.getPublishedFaqs);

  const pageTitle = buildTitle("FAQ");
  const canonical = buildCanonical("/faq");

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: (faqs ?? []).map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <Helmet>
        <title>{pageTitle}</title>
        <meta
          name="description"
          content="Frequently asked questions about AgriBid — bidding, KYC verification, listings, payments, and more."
        />
        <link rel="canonical" href={canonical} />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <div className="space-y-2">
        <h1 className="text-4xl font-black uppercase tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-muted-foreground font-medium uppercase text-sm tracking-wide">
          Answers to common questions about AgriBid.
        </p>
      </div>

      {faqs === undefined ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingIndicator />
        </div>
      ) : faqs.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 border-2 border-dashed rounded-3xl">
          <HelpCircle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-xs font-black uppercase text-muted-foreground">
            No FAQ items published yet.
          </p>
        </div>
      ) : (
        <Card className="border-2 p-6">
          <Accordion type="single" collapsible className="space-y-1">
            {faqs.map((item) => (
              <AccordionItem
                key={item._id}
                value={item._id}
                className="border-b last:border-0"
              >
                <AccordionTrigger className="text-sm font-bold text-left hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      )}
    </div>
  );
}
