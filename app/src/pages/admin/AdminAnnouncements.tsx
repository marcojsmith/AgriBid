import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Send, History, Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/admin/StatCard";

export default function AdminAnnouncements() {
  const announcements = useQuery(api.admin.listAnnouncements, {});
  const announcementStats = useQuery(api.admin.getAnnouncementStats, {});
  const adminStats = useQuery(api.admin.getAdminStats);
  const createAnnouncementMutation = useMutation(api.admin.createAnnouncement);

  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendAnnouncement = async () => {
    const title = announcementTitle.trim();
    const message = announcementMessage.trim();

    if (!title || !message) {
      toast.error("Title and message cannot be empty");
      return;
    }

    setIsSending(true);
    try {
      await createAnnouncementMutation({ title, message });
      toast.success("Announcement sent successfully");
      setAnnouncementOpen(false);
      setAnnouncementTitle("");
      setAnnouncementMessage("");
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to send announcement"
      );
    } finally {
      setIsSending(false);
    }
  };

  if (announcements === undefined || adminStats === undefined) {
    return (
      <AdminLayout stats={adminStats || null}>
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout stats={adminStats || null}>
      <div className="space-y-8">
        {/* Header & Quick Stats */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-black uppercase tracking-tight">
                Announcements
              </h2>
            </div>
            <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest">
              Broadcast messages to all users
            </p>
          </div>

          <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-xl shadow-lg shadow-primary/20 h-11 px-6">
                <Plus className="h-4 w-4" /> New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-2 rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                  New Announcement
                </DialogTitle>
                <DialogDescription className="font-medium uppercase text-xs tracking-widest text-muted-foreground">
                  Send a broadcast notification to all platform users.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                    Notification Title
                  </label>
                  <Input
                    placeholder="Maintenance Update"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    className="h-12 border-2 rounded-xl bg-muted/30 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                    Detailed Message
                  </label>
                  <Textarea
                    placeholder="We will be offline for 2 hours..."
                    value={announcementMessage}
                    onChange={(e) => setAnnouncementMessage(e.target.value)}
                    className="min-h-[120px] border-2 rounded-xl bg-muted/30 focus:ring-primary/20 resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAnnouncementOpen(false)}
                  className="rounded-xl border-2"
                  disabled={isSending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendAnnouncement}
                  className="gap-2 rounded-xl shadow-lg shadow-primary/20"
                  disabled={isSending}
                >
                  {isSending ? (
                    <LoadingIndicator size="sm" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Send Broadcast
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Total Sent"
            value={announcementStats?.total || 0}
            icon={<History className="h-5 w-5" />}
          />
          <StatCard
            label="Last 7 Days"
            value={announcementStats?.recent || 0}
            icon={<Plus className="h-5 w-5" />}
            color="text-primary"
          />
          <StatCard
            label="Engaged Users"
            value={announcements.reduce(
              (acc, curr) => acc + (curr.readCount || 0),
              0
            )}
            icon={<Eye className="h-5 w-5" />}
            color="text-green-500"
          />
        </div>

        {/* History Table */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
              Broadcast History
            </h3>
          </div>

          <Card className="border-2 rounded-2xl overflow-hidden bg-card/30 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-black uppercase tracking-widest text-[10px]">
                    Date
                  </TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px]">
                    Title
                  </TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px]">
                    Message Preview
                  </TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-right">
                    Read Count
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((ann) => (
                  <TableRow
                    key={ann._id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="font-medium text-xs text-muted-foreground">
                      {new Date(ann.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-bold">{ann.title}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-md truncate">
                      {ann.message}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="font-bold gap-1">
                        <Eye className="h-3 w-3" />
                        {ann.readCount}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {announcements.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-32 text-center text-muted-foreground italic font-medium"
                    >
                      No announcements sent yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
