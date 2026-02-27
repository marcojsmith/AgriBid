import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bot,
  Save,
  Power,
  PowerOff,
  Shield,
  Settings,
  Activity,
  History,
  RotateCcw,
  TrendingUp,
  Users,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WeeklyStat {
  date: string;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  errorCount: number;
}

type SafetyLevel = "low" | "medium" | "high";

interface ConfigHistory {
  version: number;
  updatedAt: number;
  updatedBy?: string;
  modelId: string;
  systemPrompt: string;
  safetyLevel?: "low" | "medium" | "high";
  isEnabled: boolean;
}

export default function AdminAISettings() {
  const config = useQuery(api.ai.config.getAIConfig);
  const updateConfig = useMutation(api.ai.config.updateAIConfig);
  const toggleAI = useMutation(api.ai.config.toggleAIEnabled);
  const configHistory = useQuery(api.ai.config.getConfigHistory);
  const todayStats = useQuery(api.ai.config.getTodayUsageStats);
  const weeklyStats = useQuery(api.ai.config.getWeeklyUsageStats);

  const [modelId, setModelId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>("medium");
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDisable, setShowConfirmDisable] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Sync config to local state when config changes
  useEffect(() => {
    if (config) {
      if (modelId === "" && systemPrompt === "") {
        setModelId(config.modelId);
        setSystemPrompt(config.systemPrompt);
        setSafetyLevel((config.safetyLevel || "medium") as SafetyLevel);
      }
    }
    // Only run when config changes, intentionally not including modelId/systemPrompt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  if (config === undefined) {
    return (
      <AdminLayout
        title="AI Settings"
        subtitle="Configure AI Assistant Behavior"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateConfig({
        modelId: modelId.trim(),
        systemPrompt: systemPrompt.trim(),
        safetyLevel: safetyLevel as SafetyLevel,
      });
      toast.success("AI configuration saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save configuration"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAI = async () => {
    // When AI is ON and trying to disable - show confirmation
    if (config.isEnabled && !showConfirmDisable) {
      setShowConfirmDisable(true);
      return;
    }

    // User confirmed or AI is OFF - proceed with toggle
    if (showConfirmDisable) {
      setShowConfirmDisable(false);
    }

    try {
      const result = await toggleAI({});
      toast.success(result.isEnabled ? "AI enabled" : "AI disabled");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to toggle AI"
      );
    }
  };

  const handleConfirmDisable = async () => {
    setShowConfirmDisable(false);
    try {
      await toggleAI({});
      toast.success("AI disabled");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to disable AI"
      );
    }
  };

  const handleRestoreVersion = async (history: ConfigHistory) => {
    setIsSaving(true);
    try {
      await updateConfig({
        modelId: history.modelId,
        systemPrompt: history.systemPrompt,
        safetyLevel: history.safetyLevel,
      });
      // Update local state to reflect restored values
      setModelId(history.modelId);
      setSystemPrompt(history.systemPrompt);
      setSafetyLevel((history.safetyLevel || "medium") as SafetyLevel);
      toast.success(`Restored to version ${history.version}`);
      setShowHistory(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to restore version"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout title="AI Settings" subtitle="Configure AI Assistant Behavior">
      <div className="space-y-6 max-w-4xl">
        <Card className="p-6 border-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center border-2",
                  config.isEnabled
                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                    : "bg-red-500/10 text-red-500 border-red-500/20"
                )}
              >
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-black uppercase text-lg">AI Assistant</h3>
                <p className="text-xs text-muted-foreground">
                  Agricultural equipment auction assistant
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant={config.isEnabled ? "default" : "destructive"}
                className={cn(
                  "px-3 py-1 text-xs font-bold uppercase",
                  config.isEnabled && "bg-green-500 hover:bg-green-600"
                )}
              >
                {config.isEnabled ? (
                  <span className="flex items-center gap-1">
                    <Power className="h-3 w-3" /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <PowerOff className="h-3 w-3" /> Offline
                  </span>
                )}
              </Badge>
              <Button
                variant={config.isEnabled ? "destructive" : "default"}
                size="sm"
                onClick={handleToggleAI}
                className="gap-2"
              >
                {config.isEnabled ? (
                  <>
                    <PowerOff className="h-4 w-4" /> Disable
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4" /> Enable
                  </>
                )}
              </Button>
            </div>
          </div>

          {showConfirmDisable && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-3">
                Are you sure you want to disable the AI assistant? Users will no
                longer have access to the chatbot.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmDisable}
                >
                  Yes, Disable AI
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmDisable(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="modelId" className="text-sm font-bold uppercase">
                Model ID
              </Label>
              <Input
                id="modelId"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="e.g., anthropic/claude-3.5-sonnet"
                disabled={!config.isEnabled}
              />
              <p className="text-xs text-muted-foreground">
                OpenRouter model identifier. See{" "}
                <a
                  href="https://openrouter.ai/models"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  openrouter.ai/models
                </a>{" "}
                for available models.
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="systemPrompt"
                  className="text-sm font-bold uppercase"
                >
                  System Prompt
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                    className="gap-1"
                  >
                    <History className="h-3 w-3" />
                    History
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {systemPrompt.length} characters
                  </span>
                </div>
              </div>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are AgriBid AI Assistant..."
                rows={10}
                disabled={!config.isEnabled}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Instructions that define the AI's personality and behavior. This
                prompt guides how the assistant responds to users.
              </p>
            </div>

            {showHistory && configHistory && configHistory.length > 0 && (
              <div className="border-2 rounded-xl p-4 bg-muted/20">
                <h4 className="font-bold text-sm mb-3">Prompt History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {configHistory.map((history: ConfigHistory) => (
                    <div
                      key={history.version}
                      className="p-3 rounded-lg border flex items-center justify-between border-border"
                    >
                      <div>
                        <p className="text-xs font-medium">
                          Version {history.version}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(history.updatedAt).toLocaleString()}
                          {history.updatedBy && ` by ${history.updatedBy}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {history.systemPrompt.substring(0, 100)}...
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestoreVersion(history)}
                        disabled={isSaving}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label className="text-sm font-bold uppercase">
                Safety Level
              </Label>
              <Select
                value={safetyLevel}
                onValueChange={(v) => setSafetyLevel(v as SafetyLevel)}
                disabled={!config.isEnabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-500" />
                      <span>Low - No confirmation required</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-yellow-500" />
                      <span>Medium - Confirm bulk bids</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-500" />
                      <span>High - Confirm all bids</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls when the AI requires user confirmation before executing
                actions like placing bids.
              </p>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={isSaving || !config.isEnabled}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              {config.updatedAt && (
                <span className="text-xs text-muted-foreground">
                  Last updated: {new Date(config.updatedAt).toLocaleString()}
                  {config.updatedBy && ` by ${config.updatedBy}`}
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground border-2">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-black uppercase text-lg">Usage Statistics</h3>
              <p className="text-xs text-muted-foreground">
                Today's AI usage metrics
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/30 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground font-bold uppercase">
                  Requests
                </p>
              </div>
              <p className="text-2xl font-black">
                {todayStats?.totalRequests ?? 0}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground font-bold uppercase">
                  Unique Users
                </p>
              </div>
              <p className="text-2xl font-black">
                {todayStats?.uniqueUsers ?? 0}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground font-bold uppercase">
                  Est. Cost
                </p>
              </div>
              <p className="text-2xl font-black">
                ${(todayStats?.totalCost ?? 0).toFixed(4)}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground font-bold uppercase">
                  Errors
                </p>
              </div>
              <p className="text-2xl font-black">
                {todayStats?.errorCount ?? 0}
              </p>
            </div>
          </div>

          {weeklyStats && weeklyStats.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-bold uppercase mb-3">Last 7 Days</h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {weeklyStats.map((day: WeeklyStat) => (
                  <div
                    key={day.date}
                    className="min-w-[80px] p-3 bg-muted/30 rounded-lg text-center"
                  >
                    <p className="text-xs text-muted-foreground">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        weekday: "short",
                      })}
                    </p>
                    <p className="text-lg font-black">{day.totalRequests}</p>
                    <p className="text-xs text-muted-foreground">requests</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 border-2">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground border-2">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-black uppercase text-lg">Rate Limits</h3>
              <p className="text-xs text-muted-foreground">
                Configure message rate limits per user
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-sm font-bold uppercase">
                Window (seconds)
              </Label>
              <Input
                type="number"
                value={config.rateLimitWindowSeconds}
                disabled
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Time window for rate limiting
              </p>
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-bold uppercase">
                Max Messages
              </Label>
              <Input
                type="number"
                value={config.rateLimitMaxMessages}
                disabled
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Maximum messages per window
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground border-2">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-black uppercase text-lg">System Info</h3>
              <p className="text-xs text-muted-foreground">
                Current configuration metadata
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-xs text-muted-foreground font-bold uppercase">
                Version
              </p>
              <p className="text-2xl font-black">{config.version}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-xs text-muted-foreground font-bold uppercase">
                Status
              </p>
              <p
                className={cn(
                  "text-2xl font-black",
                  config.isEnabled ? "text-green-500" : "text-red-500"
                )}
              >
                {config.isEnabled ? "Active" : "Disabled"}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-xs text-muted-foreground font-bold uppercase">
                Safety
              </p>
              <p className="text-2xl font-black capitalize">
                {config.safetyLevel || "medium"}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-xs text-muted-foreground font-bold uppercase">
                Model
              </p>
              <p className="text-sm font-black truncate" title={config.modelId}>
                {config.modelId.split("/").pop()}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
