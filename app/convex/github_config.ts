import { getEnv, requireEnv } from "./config";

const IS_PRODUCTION = !!((globalThis as unknown) as Record<string, Record<string, string | undefined>>)?.process?.env?.CONVEX_CLOUD_URL;

export const GITHUB_API_ENABLED = (() => {
  const env = getEnv("GITHUB_API_ENABLED");
  if (env !== undefined) return env === "true";
  return IS_PRODUCTION;
})();

export const GITHUB_API_TOKEN = getEnv("GITHUB_API_TOKEN");
export const GITHUB_REPO_OWNER = getEnv("GITHUB_REPO_OWNER");
export const GITHUB_REPO_NAME = getEnv("GITHUB_REPO_NAME");

export function getGitHubHeaders() {
  if (!GITHUB_API_ENABLED) {
    throw new Error("GitHub API is disabled via configuration");
  }

  // Require values when enabled to fail early in production
  const token = requireEnv("GITHUB_API_TOKEN");
  const owner = requireEnv("GITHUB_REPO_OWNER");
  const repo = requireEnv("GITHUB_REPO_NAME");

  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    // return owner/repo as well for convenience
    "x-gh-owner": owner,
    "x-gh-repo": repo,
  } as Record<string, string>;
}

export function getRepoOwnerAndName() {
  const owner = requireEnv("GITHUB_REPO_OWNER");
  const repo = requireEnv("GITHUB_REPO_NAME");
  return { owner, repo };
}
