"use client";

/**
 * SessionProviderWrapper — wraps NextAuth SessionProvider as a client component
 * so it can be used within the server-side RootLayout.
 */

import { SessionProvider } from "next-auth/react";

export default function SessionProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
