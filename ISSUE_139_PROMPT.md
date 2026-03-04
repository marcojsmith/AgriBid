# Issue #139: Admin Dashboard - Inconsistent User Count Data

## Issue Summary
The Admin Dashboard displays inconsistent user count statistics:
- "LIVE USERS" shows "0"
- "TOTAL USERS" shows "10"
- Admin Users page shows "4 Total Profiles"

These numbers should be consistent and accurate.

## Root Cause Analysis
Different sections likely use different queries:
- Dashboard stats may use cached/stale data
- Users page may filter by a different criterion (e.g., verified profiles only)
- Live users may not be tracking correctly

## Files to Investigate
1. `app/src/pages/admin/AdminDashboard.tsx` - Dashboard component
2. `app/src/pages/admin/AdminUsers.tsx` - Users page
3. `app/convex/admin/statistics.ts` - Stats queries
4. `app/convex/admin/index.ts` - User queries

## Requirements

### 1. Audit User Counting Queries
- Identify all places that count users
- Document what each count represents
- Ensure consistency in what "user" means (all registered vs. verified vs. active)

### 2. Fix Inconsistencies
- Standardize user counting logic
- Fix "LIVE USERS" to track actual active sessions
- Ensure TOTAL USERS reflects all registered users
- Clarify what "Profiles" means on Admin Users page

### 3. Implementation Suggestions
- Add a single source of truth for user counts
- Consider adding user status (active/inactive) field
- Implement proper live user tracking (use Convex presence or session tracking)

### 4. UI Updates
- Update labels to be clear about what they represent
- Add tooltips explaining each metric

## Expected Behavior
- TOTAL USERS = All registered users in the system
- LIVE USERS = Users with active sessions (real-time)
- Admin Users page = Should show same total, with filters for verified/pending

## Testing
- Verify all three locations show consistent numbers
- Test that live users updates when users are active
