import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, MessageSquare, Clock, CheckCircle2, HelpCircle } from "lucide-react";

export default function Support() {
  const tickets = useQuery(api.support.getMyTickets);
  const createTicket = useMutation(api.support.createTicket);
  
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) return;

    setIsSubmitting(true);
    try {
      await createTicket({ subject, message, priority });
      toast.success("Support ticket created");
      setSubject("");
      setMessage("");
    } catch (e) {
      toast.error("Failed to create ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
            <h1 className="text-4xl font-black uppercase tracking-tight">Help & Support</h1>
            <p className="text-muted-foreground font-medium uppercase text-sm tracking-wide">
                Get assistance with auctions, accounts, or payments.
            </p>
        </div>
        <div className="hidden md:flex gap-4">
            <Card className="p-4 border-2 flex items-center gap-3 bg-muted/30">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <Clock className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Response Time</p>
                    <p className="text-sm font-black">&lt; 4 Hours</p>
                </div>
            </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Open New Ticket
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="p-6 border-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest">Subject</Label>
                            <Input 
                                value={subject} 
                                onChange={e => setSubject(e.target.value)} 
                                placeholder="e.g. Bidding Issue" 
                                className="h-12 border-2 rounded-xl"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest">Priority</Label>
                            <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                                <SelectTrigger className="h-12 border-2 rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low - General Inquiry</SelectItem>
                                    <SelectItem value="medium">Medium - Active Auction</SelectItem>
                                    <SelectItem value="high">High - Payment/Legal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest">Message</Label>
                        <Textarea 
                            value={message} 
                            onChange={e => setMessage(e.target.value)} 
                            placeholder="Describe your issue in detail..." 
                            className="min-h-[150px] border-2 rounded-xl resize-none"
                            required
                        />
                    </div>
                    <Button 
                        type="submit" 
                        className="w-full h-14 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit Support Ticket"}
                    </Button>
                </Card>
            </form>
        </div>

        <div className="space-y-6">
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                My Tickets
            </h2>
            <div className="space-y-4">
                {tickets?.map(ticket => (
                    <Card key={ticket._id} className="p-4 border-2 hover:border-primary/40 transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <Badge variant={ticket.status === "open" ? "destructive" : "outline"} className="text-[9px] font-black uppercase">
                                {ticket.status}
                            </Badge>
                            <span className="text-[9px] font-mono text-muted-foreground uppercase">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-bold text-sm mb-1">{ticket.subject}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">{ticket.message}</p>
                        {ticket.status === "resolved" && (
                            <div className="mt-3 pt-3 border-t flex items-center gap-2 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                <span className="text-[10px] font-black uppercase">Resolved by Admin</span>
                            </div>
                        )}
                    </Card>
                ))}
                {!tickets || tickets.length === 0 && (
                    <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-3xl">
                        <HelpCircle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-xs font-black uppercase text-muted-foreground">No active tickets</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
