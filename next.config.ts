import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@mozilla/readability', 'jsdom'],
};

export default withSentryConfig(nextConfig, {
  org: "read-it-anytime",
  project: "read-it-anytime",
  silent: !process.env.CI,
});


