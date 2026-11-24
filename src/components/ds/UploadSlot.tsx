import { useRef, type ChangeEvent } from "react";
import { Camera, FileText, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/fileSize";
import { cn } from "@/lib/utils";

/** The summary of an uploaded (or picked) file. */
export interface UploadSlotFile {
  name: string;
  /** Size in bytes. */
  size: number;
  /** An object or storage URL for an image thumbnail; omit for a PDF. */
  previewUrl?: string;
}

interface UploadSlotProps {
  label: string;
  file?: UploadSlotFile;
  onFile: (file: File) => void;
  uploading?: boolean;
  error?: string;
  className?: string;
}

/**
 * One document slot on registration step 2. Empty: a dashed box with the label,
 * a primary "Take photo" button (rear camera) and an outline "Choose file"
 * button (image or PDF). Filled: a thumbnail, the file name and size, and a
 * "Replace" button. While `uploading` the buttons are disabled and the slot is
 * `aria-busy`; an `error` shows under the box as an alert.
 *
 * @param props - Component props
 * @param props.label - The document name, e.g. "ID front"
 * @param props.file - The current file, if any
 * @param props.onFile - Called with the file the buyer picked or photographed
 * @param props.uploading - Disables the buttons and shows a spinner
 * @param props.error - Error text shown under the box
 * @param props.className - Extra classes merged onto the root element
 * @returns The slot
 */
export function UploadSlot({
  label,
  file,
  onFile,
  uploading = false,
  error,
  className,
}: UploadSlotProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLInputElement>(null);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) onFile(picked);
    // Allow picking the same file again after a failed upload.
    e.target.value = "";
  };

  const spinner = uploading ? (
    <Loader2 aria-hidden="true" className="animate-spin" />
  ) : null;

  return (
    <div className={cn("mb-3", className)} data-slot="upload-slot-wrap">
      <div
        data-slot="upload-slot"
        aria-busy={uploading}
        className={cn(
          "rounded-md bg-card p-3.5",
          file
            ? "flex items-center gap-3 border border-border"
            : "border border-dashed border-muted-foreground"
        )}
      >
        {file ? (
          <>
            <div
              data-slot="upload-thumb"
              className="flex h-11 w-14 flex-none items-center justify-center overflow-hidden rounded border border-border bg-muted text-muted-foreground"
            >
              {file.previewUrl ? (
                <img
                  src={file.previewUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <FileText aria-hidden="true" className="size-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <b className="block text-base">{label}</b>
              <span className="block truncate text-sm text-muted-foreground">
                {file.name}
              </span>
              <span className="num block text-sm text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => chooseRef.current?.click()}
            >
              {spinner}
              Replace
            </Button>
          </>
        ) : (
          <>
            <b className="block text-base">{label}</b>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                className="flex-1 px-2.5"
                disabled={uploading}
                onClick={() => cameraRef.current?.click()}
              >
                {spinner ?? <Camera aria-hidden="true" />}
                Take photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 px-2.5"
                disabled={uploading}
                onClick={() => chooseRef.current?.click()}
              >
                <Upload aria-hidden="true" />
                Choose file
              </Button>
            </div>
          </>
        )}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onChange}
        />
        <input
          ref={chooseRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onChange}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
