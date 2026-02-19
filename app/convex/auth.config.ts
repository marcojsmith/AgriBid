// app/convex/auth.config.ts

const domain = process.env.CONVEX_SITE_URL;
if (!domain) {
  throw new Error(
    "Missing CONVEX_SITE_URL environment variable. " +
      "Ensure it is set in your Convex environment variables.",
  );
}

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
};
