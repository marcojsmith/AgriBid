# Implementation Plan: Vercel Deployment & CI/CD Pipeline

## Phase 1: Vercel Project Initialization [checkpoint: 077cfe2]
Connect the repository to Vercel and establish basic settings.

- [x] Task: Link Git Repository to Vercel.
- [x] Task: Configure Vercel Dashboard Settings (Root Directory: 'app', Output Directory: 'dist'). Ensure Build Command is NOT set in UI.
- [x] Task: Manually verify/set Root Directory to 'app' in Vercel Dashboard.
- [ ] Task: Ensure 'Build Command' override is DISABLED in Vercel Dashboard so Vercel uses canonical build command in vercel.json.
- [ ] Task: Conductor - User Manual Verification 'Vercel Project Initialization' (Protocol in workflow.md)

## Phase 2: Build Script & Pipeline Integration
Configure the unified build command that runs linting, tests, and Convex deployment.

- [x] Task: Create or update build script in `app/package.json` to include `lint`, `test`, and `build`. e392a61
- [x] Task: Implement/Configure the `prebuild` step for Convex deployment in Vercel. e392a61
- [ ] Task: Conductor - User Manual Verification 'Build Script & Pipeline Integration' (Protocol in workflow.md)

## Phase 3: Environment Variable Setup
Securely configure necessary secrets in the Vercel environment.

- [x] Task: Add Convex Deployment Keys to Vercel (Staging & Production).
- [~] Task: Add Better Auth secrets and environment variables.
- [ ] Task: Conductor - User Manual Verification 'Environment Variable Setup' (Protocol in workflow.md)

## Phase 4: Automated CI/CD Verification
Confirm that pushes and merges trigger the expected deployment behaviors.

- [ ] Task: Verify Preview Deployment on a feature branch push.
- [ ] Task: Verify Production Deployment on merge to `main`.
- [ ] Task: Verify that a test failure (simulated) halts the deployment.
- [ ] Task: Conductor - User Manual Verification 'Automated CI/CD Verification' (Protocol in workflow.md)
