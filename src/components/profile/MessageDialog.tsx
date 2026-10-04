import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { api } from "convex/_generated/api";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/utils";

interface MessageDialogProps {
  /** The ID of the user to contact */
  userId: string;
}

/**
 * Dialog component for contacting a seller.
 *
 * Allows non-owners to start a conversation with the profile owner.
 *
 * @param props - Component props
 * @param props.userId - The ID of the user to contact
 * @returns A dialog trigger button and the message dialog
 */
export function MessageDialog({ userId }: MessageDialogProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const navigate = useNavigate();
  const startConversation = useMutation(api.messages.startConversation);

  const handleSend = async () => {
    if (message.trim().length === 0) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      const conversationId = await startConversation({
        recipientId: userId,
        initialMessage: message,
        lotId: undefined,
      });
      toast.success("Message sent");
      setOpen(false);
      setMessage("");
      void navigate(`/messages/${conversationId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send message"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full border border-border hover:border-primary/30 bg-transparent font-semibold text-xs h-10 rounded-md"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Contact Seller
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact Seller</DialogTitle>
          <DialogDescription>
            Send a message to start a conversation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="contact-message" className="text-sm font-medium">
              Message
            </label>
            <Textarea
              id="contact-message"
              name="contact-message"
              placeholder="Ask about availability, condition, or delivery..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
              }}
              rows={4}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <>
                  <span className="animate-pulse">Sending...</span>
                </>
              ) : (
                "Send Message"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
