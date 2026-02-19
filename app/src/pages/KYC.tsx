import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  Upload,
  AlertCircle,
  Clock,
  FileText,
  User,
  Phone,
  Mail,
  Fingerprint,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Id } from "convex/_generated/dataModel";

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Render the Seller Verification (KYC) page with status-aware UI and document submission.
 *
 * Renders a KYC workflow that shows verified/pending/rejected states and, when applicable,
 * displays a personal-information form, document upload area, compliance guidance, and a
 * submit action. Manages local form state, validates required fields and email consistency,
 * uploads selected documents to pre-signed URLs, and submits KYC data for review.
 *
 * @returns The page's JSX element for the KYC flow
 */
export default function KYC() {
  const navigate = useNavigate();
  const profile = useQuery(api.users.getMyProfile);
  const generateUploadUrl = useMutation(api.auctions.generateUploadUrl);
  const deleteUpload = useMutation(api.auctions.deleteUpload);
  const submitKYC = useMutation(api.users.submitKYC);

  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    idNumber: "",
    email: "",
    confirmEmail: "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = ["image/png", "image/jpeg", "application/pdf"];

    const validFiles: File[] = [];
    let hasError = false;

    for (const file of selectedFiles) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} exceeds 10MB limit`);
        hasError = true;
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(
          `${file.name} is not a supported format (PNG, JPG, PDF only)`,
        );
        hasError = true;
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setFiles(validFiles);
    } else if (hasError) {
      setFiles([]);
    }

    // Reset input so the same file can be selected again if needed
    e.target.value = "";
  };

  if (!profile)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin" />
      </div>
    );

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    if (!isValidEmail(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (formData.email !== formData.confirmEmail) {
      toast.error("Emails do not match");
      return;
    }

    // Basic validation
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.phoneNumber ||
      !formData.idNumber
    ) {
      toast.error("Please fill in all personal details");
      return;
    }

    setIsUploading(true);
    let storageIds: string[] = [];
    try {
      // Phase 1: Parallel Uploads with allSettled to track partial successes
      const uploadResults = await Promise.allSettled(
        files.map(async (file) => {
          const postUrl = await generateUploadUrl();
          const result = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!result.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }

          const { storageId } = await result.json();
          return storageId as string;
        }),
      );

      const failures = uploadResults.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      storageIds = uploadResults
        .filter(
          (r): r is PromiseFulfilledResult<string> => r.status === "fulfilled",
        )
        .map((r) => r.value);

      if (failures.length > 0) {
        console.error("KYC Upload partial/total failure:", failures);
        toast.error(
          `Failed to upload ${failures.length} file(s). Please try again.`,
        );

        // Cleanup successes since we are halting
        if (storageIds.length > 0) {
          await Promise.allSettled(
            storageIds.map((id) =>
              deleteUpload({ storageId: id as Id<"_storage"> }),
            ),
          );
        }
        setIsUploading(false);
        return;
      }

      // Phase 2: KYC Submission
      try {
        await submitKYC({
          documents: storageIds as Id<"_storage">[],
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phoneNumber,
          idNumber: formData.idNumber,
          email: formData.email,
        });
        toast.success("KYC Documents submitted for review");
      } catch (submitError) {
        console.error("KYC Submission Phase Failed:", submitError);
        toast.error(
          `Submission failed: ${submitError instanceof Error ? submitError.message : "Internal error"}`,
        );

        // Phase 3: Cleanup Orphaned Uploads
        if (storageIds.length > 0) {
          await Promise.allSettled(
            storageIds.map((id) =>
              deleteUpload({ storageId: id as Id<"_storage"> }),
            ),
          );
        }
      }
    } catch (generalError) {
      console.error("KYC Process Error:", generalError);
      toast.error("An unexpected error occurred during verification");
    } finally {
      setIsUploading(false);
    }
  };

  const status = profile.profile?.kycStatus || "none";

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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

      {status === "verified" ? (
        <Card className="p-12 border-2 border-green-500/20 bg-green-500/5 text-center space-y-4">
          <div className="h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/20">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase">Identity Verified</h2>
            <p className="text-muted-foreground font-medium">
              Your account is fully verified. Thank you for maintaining
              marketplace integrity.
            </p>
          </div>
          <Button
            onClick={() => navigate("/profile/" + profile.userId)}
            variant="outline"
            className="border-2 font-bold uppercase"
          >
            View Public Profile
          </Button>
        </Card>
      ) : status === "pending" ? (
        <Card className="p-12 border-2 border-orange-500/20 bg-orange-500/5 text-center space-y-4">
          <div className="h-16 w-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto animate-pulse shadow-lg shadow-orange-500/20">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase">
              Review in Progress
            </h2>
            <p className="text-muted-foreground font-medium">
              Our compliance team is reviewing your documents. You'll receive a
              notification once verified.
            </p>
          </div>
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="border-2 font-bold uppercase"
          >
            Return to Marketplace
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left: Personal Info Form */}
            <div className="md:col-span-2 space-y-6">
              <Card className="p-6 border-2 space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <User className="h-5 w-5 text-primary" />
                  <h2 className="font-black uppercase text-sm tracking-widest">
                    Personal Information
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      First Names
                    </Label>
                    <Input
                      placeholder="Enter all names as per ID"
                      className="h-12 border-2 rounded-xl"
                      value={formData.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Last Name
                    </Label>
                    <Input
                      placeholder="Surname"
                      className="h-12 border-2 rounded-xl"
                      value={formData.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      ID / Passport Number
                    </Label>
                    <div className="relative">
                      <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="National ID Number"
                        className="h-12 pl-10 border-2 rounded-xl"
                        value={formData.idNumber}
                        onChange={(e) =>
                          updateField("idNumber", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Cell Phone Number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="+27..."
                        className="h-12 pl-10 border-2 rounded-xl"
                        value={formData.phoneNumber}
                        onChange={(e) =>
                          updateField("phoneNumber", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="verify@example.com"
                        className="h-12 pl-10 border-2 rounded-xl"
                        value={formData.email}
                        onChange={(e) => updateField("email", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Confirm Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Repeat email address"
                        className="h-12 pl-10 border-2 rounded-xl"
                        value={formData.confirmEmail}
                        onChange={(e) =>
                          updateField("confirmEmail", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              </Card>

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
                      onChange={handleFileChange}
                      multiple
                      accept=".jpg,.jpeg,.png,.pdf"
                    />
                  </Label>
                </div>

                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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
            </div>

            {/* Right: Info/Rules */}
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
                onClick={handleUpload}
                disabled={isUploading || files.length === 0}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
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
    </div>
  );
}

/**
 * Renders a list item with a check icon and the given label styled for compliance rules.
 *
 * @param text - The label to display next to the check icon
 * @returns A JSX list item element containing a check icon and the provided text
 */
function ListItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-[11px] font-bold uppercase text-muted-foreground leading-tight">
      <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
      {text}
    </li>
  );
}
