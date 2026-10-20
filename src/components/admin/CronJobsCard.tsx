import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Timer } from "lucide-react";
import { toast } from "sonner";

import { LoadingIndicator } from "@/components/LoadingIndicator";
import { getErrorMessage } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Admin card listing every scheduled background job with an on/off switch.
 *
 * Each switch saves immediately; a disabled job's cron still fires but exits
 * before doing any work, so it consumes almost no database bandwidth.
 *
 * @returns The background-jobs card.
 */
export function CronJobsCard() {
  const jobs = useQuery(api.cronJobs.getCronJobs);
  const setCronJobEnabled = useMutation(api.cronJobs.setCronJobEnabled);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleToggle = async (key: string, enabled: boolean) => {
    setPendingKey(key);
    try {
      await setCronJobEnabled({ key, enabled });
      toast.success(enabled ? "Job enabled" : "Job disabled");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update job"));
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <Timer className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle>Background jobs</CardTitle>
            <CardDescription>
              Choose which scheduled jobs run. Disabled jobs do no work, which
              keeps database usage down when the app is idle. Changes apply on
              each job&apos;s next scheduled run.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {jobs === undefined ? (
          <div className="h-24 flex items-center justify-center">
            <LoadingIndicator />
          </div>
        ) : (
          <ul className="divide-y">
            {jobs.map((job) => (
              <li
                key={job.key}
                className="flex items-start justify-between gap-4 py-4"
              >
                <div className="space-y-1">
                  <Label htmlFor={`cron-${job.key}`}>{job.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {job.schedule} — {job.description}
                  </p>
                </div>
                <Switch
                  id={`cron-${job.key}`}
                  checked={job.enabled}
                  disabled={pendingKey === job.key}
                  onCheckedChange={(checked) => {
                    void handleToggle(job.key, checked);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
