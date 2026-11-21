import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { MarkdownContent } from "@/components/legal/MarkdownContent";
import { LEGAL_PAGE_META, type LegalSlug } from "@/components/legal/legalPages";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSastDay } from "@/lib/dates";
import { buildCanonical, buildTitle } from "@/lib/seo";

/** Props for {@link LegalPage}. */
interface LegalPageProps {
  /** Which legal page to show. */
  slug: LegalSlug;
}

/**
 * Public legal page (Terms, Privacy or PAIA manual) rendered from admin-edited
 * markdown. The server only returns published pages; an unpublished or missing
 * page shows a "not published yet" notice and is marked `noindex`.
 *
 * @param props - Component props.
 * @param props.slug - Which legal page to show.
 * @returns The legal page.
 */
export default function LegalPage({ slug }: LegalPageProps) {
  const page = useQuery(api.legal.getLegalPage, { slug });
  const meta = LEGAL_PAGE_META.find((m) => m.slug === slug);
  const fallbackTitle = meta?.title ?? "Legal";
  const canonical = buildCanonical(meta?.path ?? `/${slug}`);

  if (page === undefined) {
    return (
      <div
        className="mx-auto max-w-3xl space-y-4 px-4 py-8 md:py-12"
        role="status"
        aria-label="Loading page"
      >
        <Helmet>
          <title>{buildTitle(fallbackTitle)}</title>
        </Helmet>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-8 h-6 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (page === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <Helmet>
          <title>{buildTitle(fallbackTitle)}</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <h1 className="text-4xl font-semibold">{fallbackTitle}</h1>
        <p className="mt-4 text-[15px] text-muted-foreground">
          This page is not published yet.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-sm text-[15px] font-medium text-primary underline underline-offset-2"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Helmet>
        <title>{buildTitle(page.title)}</title>
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonical} />
      </Helmet>
      <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Last updated {formatSastDay(page.updatedAt)}
      </p>
      <MarkdownContent markdown={page.body} className="mt-8" />
    </article>
  );
}
