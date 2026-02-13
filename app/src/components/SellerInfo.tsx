// app/src/components/SellerInfo.tsx
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { UserCheck, ShieldCheck, Mail, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SellerInfoProps {
  sellerId: string;
}

export const SellerInfo = ({ sellerId }: SellerInfoProps) => {
  const seller = useQuery(api.auctions.getSellerInfo, { sellerId });

  if (seller === undefined) {
    return (
      <div className="bg-card border-2 rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (seller === null) {
    return (
      <div className="bg-muted/20 border-2 border-dashed rounded-2xl p-6 text-center">
        <p className="text-sm font-medium text-muted-foreground italic">Seller information unavailable</p>
      </div>
    );
  }

  const memberSince = new Date(seller.createdAt).getFullYear();

  return (
    <div className="bg-card border-2 rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border-2 border-primary/5">
            <UserCheck className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black uppercase tracking-tight">{seller.name}</h3>
              {seller.isVerified && (
                <ShieldCheck className="h-5 w-5 text-green-600 fill-green-50" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider py-0 px-2 h-5 border-primary/20 bg-primary/5 text-primary">
                {seller.role}
              </Badge>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold uppercase">
                <Calendar className="h-3 w-3" />
                Member since {memberSince}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          className="h-11 font-bold rounded-xl border-2 hover:bg-primary/5 hover:border-primary transition-all gap-2"
          aria-label={`Message ${seller.name}`}
        >
          <Mail className="h-4 w-4" />
          Message
        </Button>
        <Button 
          variant="secondary" 
          className="h-11 font-bold rounded-xl border-2 border-transparent hover:border-muted-foreground/20 transition-all"
          aria-label={`View ${seller.name}'s profile`}
        >
          View Profile
        </Button>
      </div>
      
      {seller.isVerified && (
        <div className="bg-green-50/50 border border-green-100 rounded-xl p-3 flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5" />
          <p className="text-[10px] text-green-800 font-medium leading-relaxed uppercase tracking-wide">
            This seller has completed our <strong>High-Integrity Verification</strong> process, including identity and business registration checks.
          </p>
        </div>
      )}
    </div>
  );
};
