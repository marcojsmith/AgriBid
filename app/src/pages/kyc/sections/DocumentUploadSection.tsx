// app/src/pages/kyc/sections/DocumentUploadSection.tsx
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, ShieldCheck, FileText } from "lucide-react";

interface DocumentUploadSectionProps {
  files: File[];
  existingDocuments: string[];
  isEditMode: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteDocument: (docId: string) => void;
}

/**
 * Render a document upload section with an upload area, badges for existing and newly selected files, and optional delete controls.
 *
 * @param files - Newly selected File objects to display as upload previews.
 * @param existingDocuments - IDs of documents already stored; each is shown as an existing-document badge.
 * @param isEditMode - When true, shows a delete control for each existing document.
 * @param onFileChange - Handler invoked when the hidden file input changes (user selects files).
 * @param onDeleteDocument - Callback invoked with a document ID to remove that existing document.
 * @returns The rendered JSX element for the supporting documents upload section.
 */
export function DocumentUploadSection({
  files,
  existingDocuments,
  isEditMode,
  onFileChange,
  onDeleteDocument,
}: DocumentUploadSectionProps) {
  return (
    <Card className="p-6 border-2 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Upload className="h-5 w-5 text-primary" />
        <h2 className="font-black uppercase text-sm tracking-widest">
          Supporting Documents
        </h2>
      </div>

      <div className="p-8 bg-muted/30 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 text-center group hover:bg-muted/50 transition-colors">
        <Label className="cursor-pointer space-y-4 w-full">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-black uppercase text-sm">
              Drop ID images here
            </p>
            <p className="text-xs text-muted-foreground font-medium">
              PNG, JPG or PDF up to 10MB
            </p>
          </div>
          <Input
            type="file"
            className="hidden"
            onChange={onFileChange}
            multiple
            accept=".jpg,.jpeg,.png,.pdf"
          />
        </Label>
      </div>

      {(files.length > 0 || existingDocuments.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {existingDocuments.map((docId, idx) => (
            <Badge
              key={docId}
              variant="secondary"
              className="h-8 px-3 gap-2 font-bold uppercase text-[10px] border-2 border-green-500/20"
            >
              <ShieldCheck className="h-3 w-3 text-green-600" />
              Existing Doc {idx + 1}
              {isEditMode && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-4 w-4 ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                                            onClick={() => onDeleteDocument(docId)}
                                            aria-label={`Delete document ${idx + 1}`}
                                          >
                                            ×
                                          </Button>              )}
            </Badge>
          ))}
          {files.map((f, idx) => (
            <Badge
              key={`${f.name}-${f.size}-${f.lastModified}-${idx}`}
              variant="secondary"
              className="h-8 px-3 gap-2 font-bold uppercase text-[10px] border-2"
            >
              <FileText className="h-3 w-3" />
              {f.name}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}