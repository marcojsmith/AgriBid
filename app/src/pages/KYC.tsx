// app/src/pages/KYC.tsx
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import type { Id } from "convex/_generated/dataModel";
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
import { LoadingIndicator, LoadingPage } from "@/components/ui/LoadingIndicator";
import { useKYCForm } from "./kyc/hooks/useKYCForm";
import { useKYCFileUpload } from "./kyc/hooks/useKYCFileUpload";
import { VerificationStatusSection } from "./kyc/sections/VerificationStatusSection";
import { PersonalInfoSection } from "./kyc/sections/PersonalInfoSection";
import { DocumentUploadSection } from "./kyc/sections/DocumentUploadSection";
import { ListItem } from "@/components/kyc/ListItem";

/**
 * Renders the Seller Verification (KYC) page and orchestrates the KYC user flow.
 *
 * Displays UI for verified, pending, rejected, and unverified states; provides a form
 * for personal information, a document upload area, and controls to submit or edit KYC details.
 *
 * @returns The JSX element for the KYC page
 */
export default function KYC() {
  const profile = useQuery(api.users.getMyProfile);
  const myKycDetails = useQuery(api.users.getMyKYCDetails);
  const submitKYC = useMutation(api.users.submitKYC);

  const [isEditMode, setIsEditMode] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  const {
    formData,
    updateField,
    validate,
    setIsFormInitialized,
  } = useKYCForm(isEditMode && myKycDetails ? {
    firstName: myKycDetails.firstName,
    lastName: myKycDetails.lastName,
    phoneNumber: myKycDetails.phoneNumber,
    idNumber: myKycDetails.idNumber,
    email: myKycDetails.kycEmail,
  } : undefined);

  const {
    isUploading,
    files,
    existingDocuments,
    setExistingDocuments,
    handleFileChange,
    executeDeleteDocument,
    uploadFiles,
    cleanupUploads,
  } = useKYCFileUpload();

  // Reset initialization when leaving edit mode
  useEffect(() => {
    if (!isEditMode) {
      setIsFormInitialized(false);
    }
  }, [isEditMode, setIsFormInitialized]);

  // Populate existing documents when myKycDetails loads
  useEffect(() => {
    if (myKycDetails?.kycDocuments) {
      setExistingDocuments(myKycDetails.kycDocuments);
    }
  }, [myKycDetails, setExistingDocuments]);

  if (!profile) return <LoadingPage />;

  const handleDeleteDocument = (docId: string) => {
    setDocToDelete(docId);
    setShowDeleteConfirm(true);
  };

  const handleUpload = async (skipConfirm = false) => {
    if (files.length === 0 && existingDocuments.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    const validation = validate();
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    if (isEditMode && !skipConfirm) {
      setShowConfirmModal(true);
      return;
    }

    // Pass autoClear=true to clear file selection on success
    const storageIds = await uploadFiles(files, true);
    if (!storageIds && files.length > 0) return; // Error handled in hook

    try {
      // Collect all non-empty document IDs as strings
      const allDocuments = [
        ...(existingDocuments || []),
        ...(storageIds || [])
      ].filter((id): id is string => typeof id === "string" && id.length > 0);
      
      await submitKYC({
        // Branded type validation is enforced on the server; casting here to match API signature
        documents: allDocuments as Id<"_storage">[],
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        idNumber: formData.idNumber,
        email: formData.email,
      });
      toast.success("KYC Documents submitted for review");
      setIsEditMode(false);
    } catch (submitError) {
      console.error("KYC Submission Phase Failed:", submitError);
      toast.error(
        `Submission failed: ${submitError instanceof Error ? submitError.message : "Internal error"}`,
      );
      if (storageIds) await cleanupUploads(storageIds);
    }
  };

  const status = profile.profile?.kycStatus || "none";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-black uppercase tracking-tight">
          Seller Verification
        </h1>
        <p className="text-muted-foreground">
          Expand your reach. Verified sellers gain higher trust and faster
          settlement.
        </p>
      </div>

      {(status === "verified" || status === "pending") && !isEditMode ? (
        <VerificationStatusSection
          status={status}
          myKycDetails={myKycDetails}
          userId={profile.userId || ""}
          onEdit={() => setIsEditMode(true)}
        />
      ) : (
        <div className="space-y-8">
          {isEditMode && (
            <div className="p-4 border-2 border-orange-500/20 bg-orange-500/5 rounded-xl flex gap-3 items-center">
              <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="font-black uppercase text-xs text-orange-600">
                  Editing Verified Details
                </p>
                <p className="text-sm font-medium text-orange-600/80 leading-relaxed">
                  Updating your information will reset your status to "Pending"
                  and require re-verification by our team.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto font-bold uppercase text-[10px]"
                onClick={() => setIsEditMode(false)}
              >
                Cancel
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <PersonalInfoSection
                formData={formData}
                updateField={updateField}
              />
              <DocumentUploadSection
                files={files}
                existingDocuments={existingDocuments}
                isEditMode={isEditMode}
                onFileChange={handleFileChange}
                onDeleteDocument={handleDeleteDocument}
              />
            </div>

            <div className="space-y-6">
              <Card className="p-6 border-2 bg-primary/5 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  <h3 className="font-black uppercase text-xs tracking-widest">
                    Compliance Check
                  </h3>
                </div>
                <ul className="space-y-3">
                  <ListItem text="Names must match ID exactly" />
                  <ListItem text="Document must be in color" />
                  <ListItem text="All 4 corners must be visible" />
                  <ListItem text="Document cannot be expired" />
                </ul>
              </Card>

              <Button
                className="w-full h-16 rounded-2xl font-black uppercase tracking-widest bg-primary text-primary-foreground hover:scale-[1.02] transition-transform shadow-2xl shadow-primary/20"
                onClick={() => handleUpload()}
                disabled={isUploading || (files.length === 0 && existingDocuments.length === 0)}
              >
                {isUploading ? (
                  <LoadingIndicator size="sm" className="mr-2 border-white" />
                ) : (
                  <ShieldCheck className="h-5 w-5 mr-2" />
                )}
                Submit Application
              </Button>

              {status === "rejected" && (
                <div className="p-4 border-2 border-destructive/20 bg-destructive/5 rounded-xl flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  <div className="space-y-1">
                    <p className="font-black uppercase text-[10px] text-destructive">
                      Application Rejected
                    </p>
                    <p className="text-xs font-medium text-destructive/80 leading-relaxed">
                      {profile.profile?.kycRejectionReason}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Verified Details?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update your verified details? This will
              reset your verification status to "Pending" and you will need to
              be re-verified before you can continue listing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmModal(false);
                handleUpload(true);
              }}
            >
              Confirm Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          setShowDeleteConfirm(open);
          if (!open) setDocToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this document from
              your profile?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteConfirm(false);
                setDocToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async (e) => {
                e.preventDefault();
                if (docToDelete) {
                  try {
                    const success = await executeDeleteDocument(docToDelete);
                    if (success) {
                      setShowDeleteConfirm(false);
                      setDocToDelete(null);
                    }
                  } catch (err) {
                    console.error("Delete document failed:", err);
                  }
                }
              }}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
