/**
 * Registration copy and routing: pure mappings from the `getMyRegistration`
 * data to the step a buyer belongs on, the progress label, the status page
 * rows, banners and notes. Keeping them here keeps the pages thin and lets
 * every wording rule be unit-tested.
 */

import type { FunctionReturnType } from "convex/server";
import type { api } from "convex/_generated/api";

import type { RegDocKind } from "../../convex/lib/registration";
import { formatRand } from "./currency";
import { formatSastDate } from "./dates";

/** The signed-in buyer's registration, as `getMyRegistration` returns it. */
export type Registration = NonNullable<
  FunctionReturnType<typeof api.registration.getMyRegistration>
>;

/** A step of the registration flow. */
export type RegStep = "details" | "id" | "address" | "deposit";

/** Where a link on the status page goes. */
export interface StatusAction {
  label: string;
  step: RegStep;
  /** Open the step in replace mode (the rejected document's slot is empty). */
  replace?: boolean;
}

/** One row of the status page. */
export interface StatusRowData {
  key: string;
  title: string;
  sub: string;
  tone: "ok" | "pending" | "bad" | "neutral";
  action?: StatusAction;
}

/** A banner on the status page. */
export interface StatusBanner {
  kind: "ok" | "warn" | "info";
  text: string;
}

/** A rejected document with the reviewer's reason. */
export interface RejectedDocument {
  kind: RegDocKind;
  title: string;
  reason: string;
  reviewedAt: number | undefined;
}

const ID_KINDS: Record<"sa_id" | "passport", RegDocKind[]> = {
  sa_id: ["id_front", "id_back"],
  passport: ["passport_photo"],
};

const KIND_TITLES: Record<RegDocKind, string> = {
  id_front: "ID front",
  id_back: "ID back",
  passport_photo: "Passport photo page",
  proof_of_address: "Proof of address",
};

/**
 * Accepts only a same-origin relative path: one leading "/", no second "/" or
 * "\", no backslash, whitespace or control character anywhere (browsers strip
 * tabs and newlines, so "/\t/evil.com" would become "//evil.com"), and a URL
 * parse that stays on the same host.
 *
 * @param url - The candidate callback URL
 * @returns The path, or null when it is not safe
 */
export function safeCallbackPath(
  url: string | null | undefined
): string | null {
  if (!url?.startsWith("/")) return null;
  if (url.startsWith("//")) return null;
  for (const char of url) {
    const code = char.charCodeAt(0);
    if (char === "\\" || code <= 0x20 || code === 0x7f) return null;
  }
  try {
    const parsed = new URL(url, "https://agribid.invalid");
    if (parsed.origin !== "https://agribid.invalid") return null;
  } catch {
    return null;
  }
  return url;
}

/**
 * Builds a registration path, carrying the callback URL (and replace mode).
 *
 * @param step - The step, or "" for the index
 * @param options - Query options
 * @param options.callbackUrl - The page to return to, already safe or null
 * @param options.replace - Open the step in replace mode
 * @returns For example `/register/id?callbackUrl=%2Fauction%2Fabc`
 */
export function registerPath(
  step: RegStep | "status" | "",
  options: { callbackUrl?: string | null; replace?: boolean } = {}
): string {
  const params = new URLSearchParams();
  const callback = safeCallbackPath(options.callbackUrl);
  if (callback) params.set("callbackUrl", callback);
  if (options.replace) params.set("replace", "1");
  const query = params.toString();
  return `/register${step === "" ? "" : `/${step}`}${query ? `?${query}` : ""}`;
}

/**
 * The first incomplete step, or the status page once submitted.
 *
 * @param registration - The buyer's registration
 * @returns The step to land on
 */
export function entryStep(registration: Registration): RegStep | "status" {
  const { eligibility } = registration;
  if (eligibility.kind !== "incomplete") return "status";
  return eligibility.step === 1
    ? "details"
    : eligibility.step === 2
      ? "id"
      : "address";
}

/**
 * The name of the ID step: "ID" for an SA ID, "Passport" for a passport.
 *
 * @param idType - The chosen ID type
 * @returns The label
 */
export function idLabel(idType: "sa_id" | "passport" | undefined): string {
  return idType === "passport" ? "Passport" : "ID";
}

/**
 * The progress indicator for a step.
 *
 * @param step - The step
 * @param registration - The buyer's registration
 * @returns Step number, total (3 without a deposit, 4 with) and label
 */
export function stepProgress(
  step: RegStep,
  registration: Registration
): { step: number; total: 3 | 4; label: string } {
  const total = registration.depositSettings.enabled ? 4 : 3;
  switch (step) {
    case "details":
      return { step: 1, total, label: "Details" };
    case "id":
      return { step: 2, total, label: idLabel(registration.details.idType) };
    case "address":
      return { step: 3, total, label: "Address" };
    case "deposit":
      return { step: 4, total: 4, label: "Deposit" };
  }
}

/**
 * The document kinds that make up the ID step for an ID type.
 *
 * @param idType - The chosen ID type
 * @returns One kind for a passport, two for an SA ID
 */
export function idKinds(
  idType: "sa_id" | "passport" | undefined
): RegDocKind[] {
  return ID_KINDS[idType === "passport" ? "passport" : "sa_id"];
}

/**
 * The display name of a document kind.
 *
 * @param kind - The kind
 * @returns For example "ID front"
 */
export function kindTitle(kind: RegDocKind): string {
  return KIND_TITLES[kind];
}

/**
 * Rolls the documents of one step up into a single row.
 *
 * @param title - The row title
 * @param step - The step to open from "Replace"
 * @param kinds - The kinds the row covers
 * @param registration - The buyer's registration
 * @returns The row
 */
function documentRow(
  title: string,
  step: "id" | "address",
  kinds: RegDocKind[],
  registration: Registration
): StatusRowData {
  const docs = kinds.map((kind) =>
    registration.documents.find((doc) => doc.kind === kind)
  );
  const key = step === "id" ? "id" : "proof_of_address";
  if (docs.some((doc) => doc?.status === "rejected")) {
    return {
      key,
      title,
      sub: "Needs replacing",
      tone: "bad",
      action: { label: "Replace", step, replace: true },
    };
  }
  if (docs.some((doc) => doc === undefined)) {
    return { key, title, sub: "Not uploaded", tone: "neutral" };
  }
  return docs.every((doc) => doc?.status === "approved")
    ? { key, title, sub: "Approved", tone: "ok" }
    : { key, title, sub: "Under review", tone: "pending" };
}

/**
 * The rows of the "Your registration" list.
 *
 * @param registration - The buyer's registration
 * @returns Details, ID or passport, proof of address, and the deposit row
 *   when the deposit is on
 */
export function buildStatusRows(registration: Registration): StatusRowData[] {
  const rows: StatusRowData[] = [
    { key: "details", title: "Your details", sub: "Saved", tone: "ok" },
    documentRow(
      idLabel(registration.details.idType),
      "id",
      idKinds(registration.details.idType),
      registration
    ),
    documentRow(
      "Proof of address",
      "address",
      ["proof_of_address"],
      registration
    ),
  ];

  const { depositSettings, deposit } = registration;
  if (depositSettings.enabled) {
    const amount = formatRand(deposit?.amount ?? depositSettings.amount);
    if (deposit?.status === "received") {
      rows.push({
        key: "deposit",
        title: "Deposit",
        sub:
          deposit.receivedAt === undefined
            ? `${amount} received`
            : `${amount} received ${formatSastDate(deposit.receivedAt)}`,
        tone: "ok",
      });
    } else {
      rows.push({
        key: "deposit",
        title: "Deposit",
        sub: `${amount} · not yet received`,
        tone: "neutral",
        action: { label: "Pay now", step: "deposit" },
      });
    }
  }
  return rows;
}

/**
 * The banners at the top of the status page.
 *
 * @param registration - The buyer's registration
 * @returns Zero or one banner
 */
export function buildStatusBanners(registration: Registration): StatusBanner[] {
  const { eligibility, submittedAt } = registration;
  switch (eligibility.kind) {
    case "ok":
      return [{ kind: "ok", text: "You can bid" }];
    case "needs_replacing":
      return [
        {
          kind: "warn",
          text:
            eligibility.count === 1
              ? "One document needs replacing"
              : `${String(eligibility.count)} documents need replacing`,
        },
      ];
    case "under_review":
      return [
        eligibility.depositReceived
          ? { kind: "ok", text: "Deposit received" }
          : {
              kind: "info",
              text:
                submittedAt === undefined
                  ? "Documents sent. We check them within 2 business days."
                  : `Documents sent ${formatSastDate(submittedAt)}. We check them within 2 business days.`,
            },
      ];
    case "deposit_due":
      return [
        {
          kind: "info",
          text: `Pay your ${formatRand(eligibility.amount)} deposit to bid.`,
        },
      ];
    case "incomplete":
      return [];
  }
}

/**
 * The line under the rows while the registration is being checked.
 *
 * @param registration - The buyer's registration
 * @returns The note, or null when nothing is pending
 */
export function statusFootnote(registration: Registration): string | null {
  const { eligibility } = registration;
  if (eligibility.kind !== "under_review") return null;
  return eligibility.depositReceived
    ? "Bidding opens when your documents are approved."
    : "We notify you when it's done.";
}

/**
 * The rejected documents with the reviewer's reasons.
 *
 * @param registration - The buyer's registration
 * @returns One entry per rejected document
 */
export function rejectedDocuments(
  registration: Registration
): RejectedDocument[] {
  return registration.documents
    .filter((doc) => doc.status === "rejected")
    .map((doc) => ({
      kind: doc.kind,
      title: kindTitle(doc.kind),
      reason:
        doc.rejectionReason ??
        "This document couldn't be accepted. Replace it.",
      reviewedAt: doc.reviewedAt,
    }));
}
