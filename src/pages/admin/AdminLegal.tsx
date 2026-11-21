import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { LEGAL_PAGE_META, type LegalSlug } from "@/components/legal/legalPages";
import { MarkdownContent } from "@/components/legal/MarkdownContent";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatSastDate } from "@/lib/dates";
import { getErrorMessage } from "@/lib/utils";

/** Maximum title length; mirrors `LEGAL_TITLE_MAX_LENGTH` on the server. */
const TITLE_MAX_LENGTH = 200;
/** Maximum body length; mirrors `LEGAL_BODY_MAX_LENGTH` on the server. */
const BODY_MAX_LENGTH = 100_000;

type AdminLegalPage = FunctionReturnType<
  typeof api.admin.legal.adminGetLegalPages
>[number];

/** The confirm dialog currently open, if any. */
type PendingAction = "save" | "publish" | "unpublish" | null;

/** Props for {@link LegalPageEditor}. */
interface LegalPageEditorProps {
  page: AdminLegalPage;
}

/**
 * Editor for one legal page: title, markdown body with a live preview, a
 * draft banner while unpublished, Save and a Publish/Unpublish toggle.
 *
 * Saving a published page, and publishing, ask for confirmation because the
 * change is visible to the public immediately.
 *
 * @param props - Component props.
 * @param props.page - The page being edited.
 * @returns The editor.
 */
function LegalPageEditor({ page }: LegalPageEditorProps) {
  const updateLegalPage = useMutation(api.admin.legal.updateLegalPage);
  const setPublished = useMutation(api.admin.legal.setLegalPagePublished);

  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [isBusy, setIsBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const meta = LEGAL_PAGE_META.find((m) => m.slug === page.slug);
  // The server trims the title, so compare trimmed to avoid a permanent dirty state.
  const isDirty = title.trim() !== page.title || body !== page.body;
  const titleOk = title.trim().length > 0;

  const save = async () => {
    setIsBusy(true);
    try {
      await updateLegalPage({
        slug: page.slug,
        title,
        body,
        expectedUpdatedAt: page.updatedAt,
      });
      toast.success("Legal page saved");
      setPending(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save legal page"));
    } finally {
      setIsBusy(false);
    }
  };

  const changePublished = async (isPublished: boolean) => {
    setIsBusy(true);
    try {
      await setPublished({ slug: page.slug, isPublished });
      toast.success(isPublished ? "Page published" : "Page unpublished");
      setPending(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to change publish state"));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveClick = () => {
    if (page.isPublished) setPending("save");
    else void save();
  };

  const handlePublishClick = () => {
    setPending(page.isPublished ? "unpublish" : "publish");
  };

  return (
    <div className="space-y-6">
      {page.isPublished ? (
        <Alert>
          <AlertTitle>Published</AlertTitle>
          <AlertDescription>
            Live at <span className="font-mono">{meta?.path}</span>. Saved
            changes go live immediately.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>Draft, needs legal review</AlertTitle>
          <AlertDescription>
            This page is not published. Complete the bracketed notes with text
            reviewed by a legal practitioner before publishing it.
          </AlertDescription>
        </Alert>
      )}

      <p className="text-[13px] text-muted-foreground">
        Last updated {formatSastDate(page.updatedAt)} by {page.updatedByName}.
        {page.publishedAt !== undefined &&
          ` Last published ${formatSastDate(page.publishedAt)}.`}
      </p>

      <div className="space-y-2">
        <Label htmlFor={`legal-title-${page.slug}`}>Title</Label>
        <Input
          id={`legal-title-${page.slug}`}
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`legal-body-${page.slug}`}>Body (markdown)</Label>
          <Textarea
            id={`legal-body-${page.slug}`}
            value={body}
            maxLength={BODY_MAX_LENGTH}
            onChange={(e) => {
              setBody(e.target.value);
            }}
            className="min-h-[420px] font-mono text-[13px]"
          />
          <p className="text-[13px] text-muted-foreground">
            {body.length.toLocaleString("en-ZA")} /{" "}
            {BODY_MAX_LENGTH.toLocaleString("en-ZA")} characters. Raw HTML and
            images are not rendered.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Preview</p>
          <div
            data-testid={`legal-preview-${page.slug}`}
            className="max-h-[560px] overflow-y-auto rounded-md border border-border p-4"
          >
            <h2 className="font-display mb-4 text-[28px] font-semibold">
              {title}
            </h2>
            <MarkdownContent markdown={body} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button
          onClick={handleSaveClick}
          disabled={isBusy || !isDirty || !titleOk}
        >
          {isBusy && pending === null ? "Saving…" : "Save"}
        </Button>
        <Button
          variant={page.isPublished ? "outline" : "default"}
          onClick={handlePublishClick}
          disabled={isBusy || (!page.isPublished && isDirty)}
        >
          {page.isPublished ? "Unpublish" : "Publish"}
        </Button>
        {!page.isPublished && isDirty && (
          <span className="text-[13px] text-muted-foreground">
            Save your changes before publishing.
          </span>
        )}
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !isBusy) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === "publish" && `Publish ${page.title}?`}
              {pending === "unpublish" && `Unpublish ${page.title}?`}
              {pending === "save" && "Save changes to a live page?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === "publish" &&
                "The page becomes public at once and is linked from the site footer. Make sure the text has been reviewed by a legal practitioner."}
              {pending === "unpublish" &&
                "The page is taken down at once and its footer link is removed. The text is kept."}
              {pending === "save" &&
                "This page is published, so this change goes live immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isBusy}
              onClick={(e) => {
                e.preventDefault();
                if (pending === "publish") void changePublished(true);
                else if (pending === "unpublish") void changePublished(false);
                else void save();
              }}
            >
              {pending === "publish" && "Publish"}
              {pending === "unpublish" && "Unpublish"}
              {pending === "save" && "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Admin page for the Terms, Privacy policy and PAIA manual: one tab per page,
 * each with an editor, live preview and publish control.
 *
 * @returns The Legal pages admin page.
 */
export default function AdminLegal() {
  const pages = useQuery(api.admin.legal.adminGetLegalPages);
  const createDrafts = useMutation(
    api.admin.legal.createMissingLegalPageDrafts
  );
  const [isCreating, setIsCreating] = useState(false);
  const [tab, setTab] = useState<LegalSlug>("terms");

  const layoutProps = {
    title: "Legal pages",
    subtitle: "Terms, Privacy Policy & PAIA Manual",
  };

  if (pages === undefined) {
    return (
      <AdminLayout {...layoutProps}>
        <div className="flex h-64 items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await createDrafts({});
      toast.success("Starter drafts created");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create drafts"));
    } finally {
      setIsCreating(false);
    }
  };

  const bySlug = new Map(pages.map((p) => [p.slug, p]));

  return (
    <AdminLayout {...layoutProps}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        {pages.length < LEGAL_PAGE_META.length && (
          <Alert>
            <AlertTitle>Starter drafts missing</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                Some legal pages have not been created yet. Creating them adds
                unpublished starter drafts and never changes existing pages.
              </p>
              <Button
                size="sm"
                onClick={() => void handleCreate()}
                disabled={isCreating}
              >
                {isCreating ? "Creating…" : "Create starter drafts"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as LegalSlug);
          }}
        >
          <TabsList>
            {LEGAL_PAGE_META.map((m) => (
              <TabsTrigger key={m.slug} value={m.slug} className="gap-2">
                {m.label}
                {bySlug.get(m.slug)?.isPublished && (
                  <Badge variant="secondary" className="text-[11px]">
                    Live
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {LEGAL_PAGE_META.map((m) => {
            const page = bySlug.get(m.slug);
            return (
              <TabsContent key={m.slug} value={m.slug} className="mt-6">
                {page ? (
                  <LegalPageEditor key={m.slug} page={page} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {m.title} has not been created yet.
                  </p>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
