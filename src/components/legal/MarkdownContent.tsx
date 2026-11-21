import Markdown, { type Components } from "react-markdown";

import { cn } from "@/lib/utils";

/**
 * Element mapping onto the design-system typography: Lora headings
 * (`font-display`), a 15px body and spacing on the 4px rhythm.
 */
const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h2 className="font-display mt-10 mb-4 text-[28px] font-semibold leading-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="font-display mt-10 mb-3 text-[22px] font-semibold leading-snug text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display mt-8 mb-2 text-[17px] font-semibold text-foreground">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-6 mb-2 text-[15px] font-semibold text-foreground">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h4 className="mt-6 mb-2 text-[15px] font-semibold text-foreground">
      {children}
    </h4>
  ),
  h6: ({ children }) => (
    <h4 className="mt-6 mb-2 text-[15px] font-semibold text-foreground">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-4 text-[15px] leading-7 text-foreground">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 list-disc space-y-1 pl-6 text-[15px] leading-7 text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-decimal space-y-1 pl-6 text-[15px] leading-7 text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-4 rounded border-l-4 border-border bg-muted/40 px-4 py-3 text-[15px] leading-7 text-muted-foreground [&>p]:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  a: ({ href, children }) => {
    const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        className="rounded-sm text-primary underline underline-offset-2 hover:text-primary/80"
        {...(isExternal
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {children}
      </a>
    );
  },
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded bg-muted p-4 font-mono text-[13px] leading-6">
      {children}
    </pre>
  ),
};

/** Props for {@link MarkdownContent}. */
interface MarkdownContentProps {
  /** Markdown source. Admin-authored, but still treated as untrusted. */
  markdown: string;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Render admin-authored markdown safely, in the design-system typography.
 *
 * Safety is by construction: raw HTML in the source is never parsed into
 * elements (no `rehype-raw`, and `skipHtml` drops it entirely), images are
 * disallowed, and `react-markdown`'s default URL transform stays in place, so
 * `javascript:`, `data:` and other unsafe protocols are stripped from links.
 * Do not add `rehype-raw` or a custom `urlTransform` here.
 *
 * Source `h1` is rendered as an `h2` because the page title is the one `h1`.
 *
 * @param props - Component props.
 * @param props.markdown - Markdown source.
 * @param props.className - Extra classes for the wrapper.
 * @returns The rendered content, capped at a readable ~70ch measure.
 */
export function MarkdownContent({ markdown, className }: MarkdownContentProps) {
  return (
    <div className={cn("max-w-[70ch]", className)}>
      <Markdown
        components={COMPONENTS}
        skipHtml
        disallowedElements={["img"]}
        unwrapDisallowed
      >
        {markdown}
      </Markdown>
    </div>
  );
}
