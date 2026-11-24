import { useState } from "react";
import {
  Check,
  FileText,
  Fingerprint,
  Globe,
  IdCard,
  MapPin,
  Phone,
  UserCheck,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { DetailItem } from "@/components/admin/DetailItem";
import { useDocumentPreview } from "@/hooks/useDocumentPreview";
import type {
  RegistrationReview,
  ReviewDocument,
} from "@/hooks/admin/useUserManagement";
import { formatRand } from "@/lib/currency";

/** Longest rejection reason the server accepts. */
const MAX_REASON_LENGTH = 300;

/** Buyer-facing names of the document kinds (same as the buyer notification). */
const KIND_LABELS: Record<ReviewDocument["kind"], string> = {
  id_front: "ID front",
  id_back: "ID back",
  passport_photo: "Passport photo page",
  proof_of_address: "Proof of address",
};

/** Pill text and tone for each document status. */
const STATUS_PILLS: Record<
  ReviewDocument["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  approved: { label: "Approved", className: "bg-success/15 text-success" },
  rejected: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive",
  },
};

/**
 * Formats a timestamp as a short date.
 *
 * @param timestamp - Milliseconds since the epoch
 * @returns The date, e.g. "24 Nov 2026"
 */
function formatDay(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Formats a file size.
 *
 * @param bytes - Size in bytes
 * @returns For example "240 KB" or "1.2 MB"
 */
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024)
    return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Props for {@link DocumentReviewCard}. */
interface DocumentReviewCardProps {
  /** The document under review. */
  doc: ReviewDocument;
  /** Disables the actions while a decision is being saved. */
  busy: boolean;
  /** Saves a decision; resolves true when it was saved. */
  onReview: (
    doc: ReviewDocument,
    decision: "approve" | "reject",
    reason?: string
  ) => Promise<boolean>;
}

/**
 * One document: preview (through the auth-checked route), file facts, status,
 * and the approve and reject actions.
 *
 * @param props - Component props
 * @param props.doc - The document under review
 * @param props.busy - Disables the actions while a decision is being saved
 * @param props.onReview - Saves a decision
 * @returns The document card
 */
function DocumentReviewCard({ doc, busy, onReview }: DocumentReviewCardProps) {
  const preview = useDocumentPreview({
    ...doc,
    contentType: doc.contentType ?? "application/octet-stream",
  });
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const label = KIND_LABELS[doc.kind];
  const pill = STATUS_PILLS[doc.status];
  const reasonId = `reject-reason-${doc.id}`;

  const confirmReject = async (): Promise<void> => {
    const saved = await onReview(doc, "reject", reason);
    if (saved) {
      setRejecting(false);
      setReason("");
    }
  };

  return (
    <li className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {doc.fileName} · {formatSize(doc.fileSize)}
          </p>
        </div>
        <Badge variant="outline" className={pill.className}>
          {pill.label}
        </Badge>
      </div>

      <div>
        {preview.loading && (
          <p className="flex h-10 items-center gap-2 text-xs text-muted-foreground">
            <LoadingIndicator size="sm" /> Loading {label}…
          </p>
        )}
        {!preview.loading &&
          (preview.error !== undefined || preview.href === undefined) && (
            <p role="alert" className="text-xs text-destructive">
              {label}: {preview.error ?? "Couldn't load that document."}
            </p>
          )}
        {!preview.loading && preview.href !== undefined && preview.isPdf && (
          <Button asChild variant="outline" size="sm">
            <a href={preview.href} target="_blank" rel="noopener noreferrer">
              <FileText className="mr-2 h-4 w-4" /> Open {label} PDF
            </a>
          </Button>
        )}
        {!preview.loading &&
          preview.href !== undefined &&
          !preview.isPdf &&
          preview.src !== undefined && (
            <a
              href={preview.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${label} full size`}
            >
              <img
                src={preview.src}
                alt={label}
                className="max-h-56 w-full rounded-lg border object-contain"
              />
            </a>
          )}
      </div>

      {doc.status === "rejected" && doc.rejectionReason && (
        <p className="text-xs text-destructive">
          Rejected
          {doc.reviewedAt !== undefined &&
            ` on ${formatDay(doc.reviewedAt)}`}: {doc.rejectionReason}
        </p>
      )}
      {doc.status === "approved" && doc.reviewedAt !== undefined && (
        <p className="text-xs text-muted-foreground">
          Approved on {formatDay(doc.reviewedAt)}
        </p>
      )}

      {rejecting ? (
        <div className="space-y-2">
          <Label htmlFor={reasonId} className="text-xs font-medium">
            Reason for rejecting {label}
          </Label>
          <Textarea
            id={reasonId}
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            placeholder="Tell the buyer what to fix, e.g. the photo is blurry."
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
          <p className="text-right text-xs text-muted-foreground">
            {reason.length}/{MAX_REASON_LENGTH}
          </p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={busy || reason.trim() === ""}
              onClick={() => {
                void confirmReject();
              }}
            >
              Confirm reject {label}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setRejecting(false);
                setReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-success text-success-foreground hover:bg-success/90"
            disabled={busy || doc.status === "approved"}
            aria-label={`Approve ${label}`}
            onClick={() => {
              void onReview(doc, "approve");
            }}
          >
            <Check className="mr-1 h-4 w-4" /> Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            aria-label={`Reject ${label}`}
            onClick={() => {
              setRejecting(true);
            }}
          >
            <X className="mr-1 h-4 w-4" /> Reject
          </Button>
        </div>
      )}
    </li>
  );
}

/** Props for {@link RegistrationReviewPanel}. */
interface RegistrationReviewPanelProps {
  /** The registration under review. */
  registration: RegistrationReview;
  /** Whether the full ID or passport number is shown. */
  showFullId: boolean;
  /** Toggles the full ID or passport number. */
  setShowFullId: (show: boolean) => void;
  /** Disables the actions while a decision is being saved. */
  busy: boolean;
  /** Saves a document decision; resolves true when it was saved. */
  onReviewDocument: DocumentReviewCardProps["onReview"];
}

/**
 * The admin's per-document registration review: details first, then one card
 * per document, then the deposit status.
 *
 * @param props - Component props
 * @param props.registration - The registration under review
 * @param props.showFullId - Whether the full ID or passport number is shown
 * @param props.setShowFullId - Toggles the full number
 * @param props.busy - Disables the actions while a decision is being saved
 * @param props.onReviewDocument - Saves a document decision
 * @returns The review panel
 */
export function RegistrationReviewPanel({
  registration,
  showFullId,
  setShowFullId,
  busy,
  onReviewDocument,
}: RegistrationReviewPanelProps) {
  const { details, documents, deposit } = registration;
  const number =
    details.idType === "passport" ? details.passportNumber : details.idNumber;
  const address = [details.streetAddress, details.town, details.postalCode]
    .filter(Boolean)
    .join(", ");
  const shownNumber = (() => {
    if (!number) return "Not provided";
    return showFullId ? number : `****${number.slice(-4)}`;
  })();

  return (
    <div className="space-y-6 py-4">
      <section aria-label="Details" className="space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground">Details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem
            label="Full name"
            value={details.fullName ?? "—"}
            icon={<UserCheck className="h-4 w-4" />}
          />
          <DetailItem
            label="ID type"
            value={
              details.idType === "passport" ? "Passport" : "South African ID"
            }
            icon={<IdCard className="h-4 w-4" />}
          />
          <div className="flex items-end gap-2">
            <DetailItem
              label={
                details.idType === "passport" ? "Passport number" : "ID number"
              }
              value={shownNumber}
              icon={<Fingerprint className="h-4 w-4" />}
            />
            {number && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  setShowFullId(!showFullId);
                }}
              >
                {showFullId ? "Hide" : "Reveal"}
              </Button>
            )}
          </div>
          {details.idType === "passport" && (
            <DetailItem
              label="Country of issue"
              value={details.countryOfIssue ?? "—"}
              icon={<Globe className="h-4 w-4" />}
            />
          )}
          <DetailItem
            label="Phone"
            value={details.phoneNumber ?? "—"}
            icon={<Phone className="h-4 w-4" />}
          />
          <DetailItem
            label="Address"
            value={address === "" ? "—" : address}
            icon={<MapPin className="h-4 w-4" />}
          />
        </div>
      </section>

      <section aria-label="Documents" className="space-y-4">
        <h3 className="text-xs font-medium text-muted-foreground">Documents</h3>
        {documents.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            No documents uploaded.
          </p>
        ) : (
          <ul className="space-y-4">
            {documents.map((doc) => (
              <DocumentReviewCard
                key={doc.id}
                doc={doc}
                busy={busy}
                onReview={onReviewDocument}
              />
            ))}
          </ul>
        )}
      </section>

      {deposit && (
        <section aria-label="Deposit" className="space-y-1 border-t pt-4">
          <h3 className="text-xs font-medium text-muted-foreground">Deposit</h3>
          <p className="font-mono text-sm">{deposit.reference}</p>
          <p className="text-xs text-muted-foreground">
            {formatRand(deposit.amount)} · {deposit.status.replace("_", " ")}
          </p>
        </section>
      )}
    </div>
  );
}
