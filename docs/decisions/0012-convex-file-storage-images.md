# 0012 - Convex file storage for images

Date: undated | Status: Accepted

## Context

Listing images needed permanent storage and precise UI placement.

## Decision

Store all equipment images in Convex File Storage. `generateUploadUrl` returns a single-use upload URL; the wizard shows a local `blob:` preview immediately, uploads, and saves the `storageId`. Images are a structured object (`front`, `engine`, `cabin`, `rear`, plus an `additional` array) instead of a flat array. KYC documents likewise use Convex storage ids.

## Consequences

- Cards and detail pages resolve `storageId` to URLs (mock data may hold full HTTP URLs, handled transparently).
- The hero image can be the "front" view.
- Blob URLs must be revoked on removal and unmount.
