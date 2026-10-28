import type { NextConfig } from "next";

const buildTime = Date.now().toString();
const appVersion =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  buildTime;

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingIncludes: {
    "/*": ["./dev.db"],
    "/api/**/*": ["./dev.db"],
  },
  env: {
    NEXTAUTH_URL:
      process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("ebvnnjpka")
        ? process.env.NEXTAUTH_URL
        : "https://gocab-iota.vercel.app",
    AUTH_URL:
      process.env.AUTH_URL && !process.env.AUTH_URL.includes("ebvnnjpka")
        ? process.env.AUTH_URL
        : "https://gocab-iota.vercel.app",
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
