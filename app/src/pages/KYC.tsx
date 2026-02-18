import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Upload, AlertCircle, Clock, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function KYC() {
  const navigate = useNavigate();
  const profile = useQuery(api.users.getMyProfile);
  const generateUploadUrl = useMutation(api.auctions.generateUploadUrl);
  const submitKYC = useMutation(api.users.submitKYC);
  
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  if (!profile) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    setIsUploading(true);
    try {
      const storageIds = [];
      for (const file of files) {
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        storageIds.push(storageId);
      }

      await submitKYC({ documents: storageIds });
      toast.success("KYC Documents submitted for review");
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const status = profile.profile?.kycStatus || "none";

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-black uppercase tracking-tight">Seller Verification</h1>
        <p className="text-muted-foreground">Verify your identity to unlock selling privileges and trust badges.</p>
      </div>

      {status === "verified" ? (
        <Card className="p-12 border-2 border-green-500/20 bg-green-500/5 text-center space-y-4">
          <div className="h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/20">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase">Identity Verified</h2>
            <p className="text-muted-foreground font-medium">You have full access to the AgriBid marketplace.</p>
          </div>
          <Button onClick={() => navigate("/profile")} variant="outline" className="border-2 font-bold uppercase">Back to Profile</Button>
        </Card>
      ) : status === "pending" ? (
        <Card className="p-12 border-2 border-orange-500/20 bg-orange-500/5 text-center space-y-4">
          <div className="h-16 w-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto animate-pulse shadow-lg shadow-orange-500/20">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase">Review in Progress</h2>
            <p className="text-muted-foreground font-medium">Our team is currently verifying your documents. This usually takes 24-48 hours.</p>
          </div>
          <Button onClick={() => navigate("/profile")} variant="outline" className="border-2 font-bold uppercase">Check Profile Status</Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-6 border-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-xl border-2 border-dashed">
                  <Label className="flex flex-col items-center justify-center gap-2 cursor-pointer py-8">
                    <Upload className="h-8 w-8 text-primary" />
                    <span className="font-bold uppercase text-xs tracking-widest">Upload ID / Passport</span>
                    <Input 
                        type="file" 
                        className="hidden" 
                        onChange={(e) => setFiles(Array.from(e.target.files || []))}
                        multiple
                    />
                  </Label>
                </div>
                {files.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-muted-foreground">Selected Files:</p>
                        {files.map(f => (
                            <div key={f.name} className="flex items-center gap-2 p-2 bg-muted rounded-lg text-xs font-bold uppercase">
                                <FileText className="h-4 w-4" /> {f.name}
                            </div>
                        ))}
                    </div>
                )}
              </div>
              
              <div className="space-y-4">
                <h3 className="font-black uppercase text-sm tracking-widest flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  Verification Rules
                </h3>
                <ul className="space-y-2 text-xs text-muted-foreground font-medium list-disc pl-4">
                  <li>Upload a clear color photo of your National ID or Passport.</li>
                  <li>Ensure all four corners of the document are visible.</li>
                  <li>Documents must be valid (not expired).</li>
                  <li>Name on ID must match your account name.</li>
                </ul>
              </div>
            </div>

            <Button 
                className="w-full h-14 rounded-xl font-black uppercase tracking-widest bg-primary text-primary-foreground hover:scale-[1.01] transition-transform shadow-xl shadow-primary/20"
                onClick={handleUpload}
                disabled={isUploading || files.length === 0}
            >
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShieldCheck className="h-5 w-5 mr-2" />}
              Submit for Verification
            </Button>
          </Card>

          {status === "rejected" && (
            <Card className="p-4 border-2 border-destructive/20 bg-destructive/5 flex gap-4 items-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <div>
                    <p className="font-black uppercase text-xs text-destructive">Previous Attempt Rejected</p>
                    <p className="text-sm font-medium text-destructive/80">{profile.profile?.kycRejectionReason || "Please ensure your documents are clear and valid."}</p>
                </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
