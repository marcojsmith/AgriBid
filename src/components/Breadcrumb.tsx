// app/src/components/Breadcrumb.tsx
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Helmet } from "react-helmet-async";

import { buildBreadcrumbSchema, buildCanonical } from "@/lib/seo";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  crumbs: BreadcrumbItem[];
}

/**
 * Breadcrumb navigation component with JSON-LD structured data.
 *
 * Renders a visible <nav aria-label="breadcrumb"> with chevron-separated links
 * and injects a schema.org BreadcrumbList JSON-LD block via react-helmet-async.
 *
 * @param props - Component props
 * @param props.crumbs - Ordered breadcrumb items; the last item is the current page (no href)
 * @returns The rendered breadcrumb nav and Helmet with structured data
 */
export const Breadcrumb = ({ crumbs }: BreadcrumbProps) => {
  const schemaItems = crumbs.map((crumb) => ({
    name: crumb.label,
    ...(crumb.href ? { url: buildCanonical(crumb.href) } : {}),
  }));

  return (
    <>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(buildBreadcrumbSchema(schemaItems))}
        </script>
      </Helmet>
      <nav aria-label="breadcrumb" className="mb-6">
        <ol className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <li key={index} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                )}
                {isLast || !crumb.href ? (
                  <span
                    className="font-semibold text-foreground"
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.href}
                    className="hover:text-primary transition-colors font-medium"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
};
