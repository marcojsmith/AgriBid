import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, AlertCircle, Info, XCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export function NotificationDropdown() {
  const navigate = useNavigate();
  const notifications = useQuery(api.notifications.getMyNotifications);
  const markRead = useMutation(api.notifications.markAsRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const handleNotificationClick = async (id: any, link?: string) => {
    await markRead({ notificationId: id });
    if (link) navigate(link);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error": return <XCircle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default: return <Info className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full border-2 hover:bg-muted transition-all">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-[10px] font-black text-primary-foreground flex items-center justify-center border-2 border-background animate-in zoom-in">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2 rounded-2xl border-2 shadow-2xl">
        <div className="flex items-center justify-between px-2 py-2">
          <DropdownMenuLabel className="text-xs font-black uppercase tracking-widest opacity-50">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-[10px] font-bold uppercase tracking-tighter hover:bg-primary/10 hover:text-primary"
                onClick={() => markAllRead()}
            >
                Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[400px] overflow-y-auto space-y-1 py-1">
          {notifications?.length === 0 && (
            <div className="py-8 text-center space-y-2">
                <Clock className="h-8 w-8 text-muted-foreground/20 mx-auto" />
                <p className="text-[10px] font-black uppercase text-muted-foreground">All caught up</p>
            </div>
          )}
          {notifications?.map((n) => (
            <DropdownMenuItem 
              key={n._id} 
              className={cn(
                "flex flex-col items-start gap-1 p-3 rounded-xl cursor-pointer transition-all border-2 border-transparent",
                "focus:bg-muted/10 focus:border-primary focus:text-foreground outline-none",
                !n.isRead ? "bg-muted/50 border-primary/10" : "opacity-60"
              )}
              onClick={() => handleNotificationClick(n._id, n.link)}
            >
              <div className="flex items-center gap-2 w-full">
                {getIcon(n.type)}
                <span className="font-black uppercase text-[10px] tracking-tight flex-1 truncate">{n.title}</span>
                <span className="text-[8px] font-bold text-muted-foreground">{new Date(n.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-xs font-medium leading-relaxed text-muted-foreground">{n.message}</p>
            </DropdownMenuItem>
          ))}
        </div>
        {notifications && notifications.length > 0 && (
            <>
                <DropdownMenuSeparator />
                <div className="p-1">
                    <Button variant="ghost" className="w-full h-9 text-[10px] font-black uppercase tracking-widest text-muted-foreground">View Archive</Button>
                </div>
            </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
