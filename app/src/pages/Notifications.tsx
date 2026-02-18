import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  ArrowRight,
  Inbox,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getNotificationIcon, handleNotificationClick } from "@/lib/notifications";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";

export default function Notifications() {
  const navigate = useNavigate();
  const notifications = useQuery(api.notifications.getNotificationArchive, {});
  const markRead = useMutation(api.notifications.markAsRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const onNotificationClick = async (id: Id<"notifications">, link?: string) => {
    try {
        await handleNotificationClick(id, link, navigate, markRead);
    } catch (e) {
        console.error("Notification click failed:", e);
        toast.error(`Action failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <h1 className="text-4xl font-black uppercase tracking-tight">Notification Archive</h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">Your communication history</p>
        </div>
        <Button 
          variant="outline" 
          className="border-2 font-black uppercase text-[10px] tracking-widest h-10 px-6 rounded-xl"
          onClick={async () => {
            try {
                await markAllRead();
                toast.success("All notifications marked as read");
            } catch (e) {
                console.error("Mark all read failed:", e);
                toast.error(`Action failed: ${e instanceof Error ? e.message : "Unknown error"}`);
            }
          }}
        >
          Mark all as read
        </Button>
      </div>

      <Card className="border-2 overflow-hidden bg-card/50">
        <div className="divide-y-2">
          {notifications === undefined ? (
            <div className="py-24 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary/40 mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-4">Syncing History...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-24 text-center space-y-4">
              <Inbox className="h-12 w-12 text-muted-foreground/20 mx-auto" />
              <div className="space-y-1">
                <p className="text-xl font-black uppercase">No notifications</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">You're all caught up for now.</p>
              </div>
            </div>
          ) : null}
          
          {notifications?.map((n) => (
            <div 
              key={n._id}
              className={cn(
                "p-6 flex gap-6 hover:bg-muted/30 transition-all cursor-pointer group",
                !n.isRead ? "bg-muted/50" : "opacity-60"
              )}
              onClick={() => onNotificationClick(n._id, n.link)}
            >
              <div className="h-12 w-12 rounded-2xl bg-background border-2 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                {getNotificationIcon(n.type)}
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black uppercase text-sm tracking-tight">{n.title}</h3>
                    {!n.isRead && <Badge className="h-2 w-2 rounded-full p-0 bg-primary animate-pulse" />}
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-2xl">{n.message}</p>
                
                {n.link && (
                  <div className="pt-2">
                    <Button variant="link" className="p-0 h-auto text-[10px] font-black uppercase tracking-widest text-primary gap-1 group-hover:translate-x-1 transition-transform">
                      View Details <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
