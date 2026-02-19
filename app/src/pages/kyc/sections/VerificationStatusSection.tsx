// app/src/pages/kyc/sections/VerificationStatusSection.tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Mail, Phone, FileText, Clock } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { useNavigate } from "react-router-dom";

export interface KycDetails {
  firstName?: string;
  lastName?: string;
  kycEmail?: string;
  phoneNumber?: string;
  idNumber?: string;
  kycDocuments?: string[];
}

interface VerificationStatusSectionProps {
  status: string;
  myKycDetails: KycDetails | null | undefined;
  userId: string;
  onEdit: () => void;
}

/**
 * Render a verification status panel showing identity, contact, and document details or a pending notice.
 *
 * Renders a detailed "verified" card when `status` is "verified" and `myKycDetails` is provided, a pending review card when `status` is "pending", and nothing for other statuses.
 *
 * @param status - Verification state; expected values include `"verified"` and `"pending"`.
 * @param myKycDetails - User's KYC details (may be `null` or `undefined` while loading).
 * @param userId - User identifier used to build the public profile link.
 * @param onEdit - Callback invoked when the "Edit Details" action is triggered.
 * @returns The JSX element for the verification status UI, or `null` if the `status` is not handled.
 */
export function VerificationStatusSection({
  status,
  myKycDetails,
  userId,
  onEdit,
}: VerificationStatusSectionProps) {
  const navigate = useNavigate();

  if (status === "verified") {
    if (!myKycDetails) {
      return (
        <div className="flex justify-center py-20">
          <LoadingIndicator />
        </div>
      );
    }

    const hasDocs = (myKycDetails.kycDocuments?.length || 0) > 0;

    return (
      <Card className="p-12 border-2 border-green-500/20 bg-green-500/5 space-y-8">
        <div className="text-center space-y-4">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-green-500/10 pt-8">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Full Name
              </Label>
              <p className="font-bold">
                {myKycDetails.firstName || "—"} {myKycDetails.lastName || ""}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                ID Number
              </Label>
              <p className="font-bold">{myKycDetails.idNumber || "N/A"}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Contact Details
              </Label>
              <div className="space-y-1">
                <p className="font-bold flex items-center gap-2">
                  <Mail className="h-3 w-3" /> {myKycDetails.kycEmail || "N/A"}
                </p>
                <p className="font-bold flex items-center gap-2">
                  <Phone className="h-3 w-3" /> {myKycDetails.phoneNumber || "N/A"}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Verified Documents
              </Label>
              <div className="flex flex-wrap gap-2">
                {hasDocs ? (
                  myKycDetails.kycDocuments?.map((docId: string, idx: number) => (
                    <Badge
                      key={docId}
                      variant="secondary"
                      className="h-8 px-3 gap-2 font-bold uppercase text-[10px] border-2 border-green-500/10"
                    >
                      <FileText className="h-3 w-3" />
                      Document {idx + 1}
                    </Badge>
                  ))
                ) : (
                  <p className="text-[10px] font-bold text-muted-foreground uppercase italic">No documents verified</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
          <Button
            onClick={() => navigate("/profile/" + userId)}
            variant="outline"
            className="border-2 font-bold uppercase h-12 px-8"
          >
            View Public Profile
          </Button>
          <Button
            onClick={onEdit}
            variant="secondary"
            className="border-2 font-bold uppercase h-12 px-8"
          >
            Edit Details
          </Button>
        </div>
      </Card>
    );
  }

  if (status === "pending") {
    return (
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
    );
  }

  return null;
}