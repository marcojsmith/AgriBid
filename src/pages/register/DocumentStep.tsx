import { useState } from "react";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { showToast } from "@/components/ds/showToast";
import { UploadSlot, type UploadSlotFile } from "@/components/ds/UploadSlot";
import { WhyBox } from "@/components/ds/WhyBox";
import { Button } from "@/components/ui/button";
import {
  useDocumentPreview,
  type RegistrationDocument,
} from "@/hooks/useDocumentPreview";
import { useRegisterParams } from "@/hooks/useRegisterParams";
import { useRegistrationUpload } from "@/hooks/useRegistrationUpload";
import {
  kindTitle,
  stepProgress,
  type Registration,
  type RegStep,
} from "@/lib/registrationCopy";
import { getErrorMessage } from "@/lib/utils";

import type { RegDocKind } from "../../../convex/lib/registration";
import { RegisterLayout } from "./RegisterLayout";

interface DocumentStepProps {
  registration: Registration;
  /** Which step this is. */
  step: Extract<RegStep, "id" | "address">;
  title: string;
  intro: string;
  /** The slots, in order. */
  kinds: RegDocKind[];
  /** The things the document must show. */
  checklist: string[];
  /** The primary button's label. */
  nextLabel: string;
  /** Runs when "Next" is pressed; navigates itself on success. */
  onNext: () => Promise<void>;
}

/**
 * The stored document for a slot, or undefined when the slot is empty (no
 * document yet, or it was rejected and must be replaced).
 *
 * @param registration - The buyer's registration
 * @param kind - The slot
 * @returns The document, if the slot counts as filled
 */
function filledDoc(
  registration: Registration,
  kind: RegDocKind
): RegistrationDocument | undefined {
  const doc = registration.documents.find((row) => row.kind === kind);
  return doc && doc.status !== "rejected" ? doc : undefined;
}

interface SlotProps {
  kind: RegDocKind;
  doc: RegistrationDocument | undefined;
  uploading: boolean;
  error: string | undefined;
  onFile: (file: File) => void;
}

/**
 * One upload slot; reads the stored file only through `useDocumentPreview`.
 *
 * @param props - Component props
 * @param props.kind - The document kind
 * @param props.doc - The stored document, if the slot is filled
 * @param props.uploading - Whether this slot is uploading
 * @param props.error - Upload error for this slot
 * @param props.onFile - Called with the picked file
 * @returns The slot
 */
function DocumentSlot({ kind, doc, uploading, error, onFile }: SlotProps) {
  const preview = useDocumentPreview(doc);
  const file: UploadSlotFile | undefined = doc
    ? { name: doc.fileName, size: doc.fileSize, previewUrl: preview.src }
    : undefined;
  return (
    <UploadSlot
      label={kindTitle(kind)}
      file={file}
      uploading={uploading}
      error={error}
      onFile={onFile}
    />
  );
}

/**
 * Steps 2 and 3: upload slots with a checklist. A rejected document's slot is
 * empty with the reviewer's reason above it. In replace mode (`?replace=1`)
 * uploading the last rejected document returns to the status page and there
 * is no "Next" button.
 *
 * @param props - Component props
 * @param props.registration - The buyer's registration
 * @param props.step - The step
 * @param props.title - The heading
 * @param props.intro - The line under the heading
 * @param props.kinds - The slots
 * @param props.checklist - What the document must show
 * @param props.nextLabel - The primary button's label
 * @param props.onNext - Runs on "Next"
 * @returns The step inside the registration layout
 */
export function DocumentStep({
  registration,
  step,
  title,
  intro,
  kinds,
  checklist,
  nextLabel,
  onNext,
}: DocumentStepProps) {
  const navigate = useNavigate();
  const { callbackUrl, replace, path } = useRegisterParams();
  const { upload, uploadingKind, error } = useRegistrationUpload();
  const [busy, setBusy] = useState(false);

  const rejected = registration.documents.filter(
    (doc) => kinds.includes(doc.kind) && doc.status === "rejected"
  );
  const complete = kinds.every(
    (kind) => filledDoc(registration, kind) !== undefined
  );

  const onFile = async (kind: RegDocKind, file: File) => {
    const attached = await upload(kind, file);
    if (!attached || !replace) return;
    if (rejected.every((doc) => doc.kind === kind)) {
      await navigate(path("status"));
    }
  };

  const next = async () => {
    setBusy(true);
    try {
      await onNext();
    } catch (err) {
      showToast(
        getErrorMessage(err, "Something went wrong. Try again."),
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <RegisterLayout
      callbackUrl={callbackUrl}
      title={title}
      intro={intro}
      progress={stepProgress(step, registration)}
      deposit={
        registration.depositSettings.enabled
          ? registration.depositSettings
          : undefined
      }
    >
      {kinds.map((kind) => {
        const reason = rejected.find((doc) => doc.kind === kind);
        return (
          <div key={kind}>
            {reason?.reviewedAt !== undefined ? (
              <WhyBox
                reason={
                  reason.rejectionReason ??
                  "This document couldn't be accepted. Replace it."
                }
                checkedAt={reason.reviewedAt}
              />
            ) : null}
            <DocumentSlot
              kind={kind}
              doc={filledDoc(registration, kind)}
              uploading={uploadingKind === kind}
              error={error?.kind === kind ? error.message : undefined}
              onFile={(file) => {
                void onFile(kind, file);
              }}
            />
          </div>
        );
      })}
      <ul className="m-0 mb-5 list-none space-y-1 p-0 text-[15px] text-muted-foreground">
        {checklist.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <Check aria-hidden="true" className="size-4 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
      {replace ? null : (
        <Button
          type="button"
          className="w-full"
          disabled={!complete || busy || uploadingKind !== null}
          onClick={() => {
            void next();
          }}
        >
          {nextLabel}
        </Button>
      )}
    </RegisterLayout>
  );
}
