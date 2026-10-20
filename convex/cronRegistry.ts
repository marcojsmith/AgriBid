/**
 * Registry of scheduled background jobs that admins can switch on or off.
 *
 * Convex cron schedules are static (set in `convex/crons.ts` at deploy time),
 * so "disabling" a job means its cron wrapper (`convex/cronJobs.ts`) reads the
 * matching `settings` row and returns early. The registry is the single source
 * of truth for the job keys, labels and schedule descriptions shown in the UI.
 */

/** Identifier of a toggleable background job. */
export type CronJobKey =
  | "settle_expired_auctions"
  | "cleanup_abandoned_drafts"
  | "cleanup_presence_records"
  | "sweep_orphaned_uploads"
  | "process_error_reports"
  | "weekly_mock_data_reset";

/** Static description of a toggleable background job. */
export interface CronJobDefinition {
  key: CronJobKey;
  label: string;
  description: string;
  schedule: string;
  /** Whether the job runs when no setting has been stored (off: opt-in). */
  defaultEnabled: boolean;
}

/** All toggleable background jobs, in display order. */
export const CRON_JOBS: readonly CronJobDefinition[] = [
  {
    key: "settle_expired_auctions",
    label: "Settle expired auctions",
    description:
      "Marks lots as sold/unsold and closes auctions once their end time passes. Disabling it means no lot will settle.",
    schedule: "Every 1 minute",
    defaultEnabled: false,
  },
  {
    key: "cleanup_presence_records",
    label: "Clean up presence records",
    description: "Deletes stale online-presence records.",
    schedule: "Every 15 minutes",
    defaultEnabled: false,
  },
  {
    key: "cleanup_abandoned_drafts",
    label: "Clean up abandoned drafts",
    description: "Deletes draft lots (and their files) older than 30 days.",
    schedule: "Daily at 00:00 UTC",
    defaultEnabled: false,
  },
  {
    key: "sweep_orphaned_uploads",
    label: "Sweep orphaned uploads",
    description:
      "Deletes uploaded files no longer referenced by any lot, KYC document or banner.",
    schedule: "Every 24 hours",
    defaultEnabled: false,
  },
  {
    key: "process_error_reports",
    label: "Process error reports",
    description:
      "Turns pending error reports into GitHub issues (also requires GitHub error reporting to be enabled).",
    schedule: "Daily at 02:00 UTC",
    defaultEnabled: false,
  },
  {
    key: "weekly_mock_data_reset",
    label: "Weekly mock data reset",
    description:
      "Wipes all mock application data and reseeds it (demo deployments only).",
    schedule: "Every 7 days",
    defaultEnabled: false,
  },
];

/**
 * Build the `settings` table key that stores a job's enabled flag.
 *
 * @param key - The job identifier
 * @returns The settings key, e.g. `cron_enabled_settle_expired_auctions`
 */
export function cronSettingKey(key: string): string {
  return `cron_enabled_${key}`;
}

/**
 * Look up a job definition by key.
 *
 * @param key - Candidate job identifier
 * @returns The definition, or undefined when the key is not a known job
 */
export function findCronJob(key: string): CronJobDefinition | undefined {
  return CRON_JOBS.find((job) => job.key === key);
}
