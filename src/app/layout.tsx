import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LiveSyncProvider } from "@/context/LiveSyncContext";
import "@/lib/dom-patch";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GoCab CRM — Growth & Fleet Operations",
  description:
    "Kanban-style lead management and fleet operations for GoCab driver onboarding, vehicle assignment, collections, and field supervisor tasks.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/gocab-official-logo.png", sizes: "412x390", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GoCab Ops",
  },
  other: {
    google: "notranslate",
  },
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      translate="no"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased notranslate`}
    >
      <head>
        <meta name="google" content="notranslate" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof Node !== 'undefined' && Node.prototype) {
                var origRemoveChild = Node.prototype.removeChild;
                Node.prototype.removeChild = function(child) {
                  if (child.parentNode !== this) {
                    if (child.parentNode) {
                      try { return child.parentNode.removeChild(child); } catch(e) {}
                    }
                    return child;
                  }
                  return origRemoveChild.apply(this, arguments);
                };
                var origInsertBefore = Node.prototype.insertBefore;
                Node.prototype.insertBefore = function(newNode, referenceNode) {
                  if (referenceNode && referenceNode.parentNode !== this) {
                    if (referenceNode.parentNode) {
                      try { return referenceNode.parentNode.insertBefore(newNode, referenceNode); } catch(e) {}
                    }
                    return this.appendChild(newNode);
                  }
                  return origInsertBefore.apply(this, arguments);
                };
              }
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-[#f4f6fb] text-slate-900 notranslate" translate="no">
        <SessionProviderWrapper>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <LiveSyncProvider>
              <LanguageProvider>
                {children}
                <Toaster 
                  position="bottom-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#fff',
                      color: '#1e293b',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 500,
                    },
                  }} 
                />
              </LanguageProvider>
            </LiveSyncProvider>
          </ThemeProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
