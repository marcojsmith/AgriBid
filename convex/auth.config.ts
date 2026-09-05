// Kept free of imports from other convex/ modules: Convex's bundler treats
// every environment variable read anywhere in this file's transitive import
// graph as required by auth.config.ts, so pulling in shared helpers here
// (e.g. from ./config) would force unrelated env vars to be set just to
// deploy auth.
const clerkJwtIssuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!clerkJwtIssuerDomain) {
  throw new Error("Missing CLERK_JWT_ISSUER_DOMAIN environment variable.");
}

export default {
  providers: [
    {
      domain: clerkJwtIssuerDomain,
      applicationID: "convex",
    },
  ],
};
