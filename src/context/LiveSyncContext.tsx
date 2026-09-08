"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";

export type SyncEntity = "leads" | "tickets" | "settings" | "all";

interface LiveSyncContextValue {
  subscribe: (entity: SyncEntity, callback: () => void) => () => void;
  notifyMutation: (entity: SyncEntity) => void;
  isOnline: boolean;
  appUpdateAvailable: boolean;
  triggerAppReload: () => void;
  forceAllSessionsRefresh: () => Promise<void>;
}

const LiveSyncContext = createContext<LiveSyncContextValue | null>(null);

const BROADCAST_CHANNEL_NAME = "gocab_live_sync_channel";
const ACTIVE_POLL_INTERVAL_MS = 4000; // 4s when tab is active
const BACKGROUND_POLL_INTERVAL_MS = 20000; // 20s when backgrounded

export function LiveSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [appUpdateAvailable, setAppUpdateAvailable] = useState(false);
  const [updateCountdown, setUpdateCountdown] = useState<number | null>(null);

  // Initial client version
  const initialVersion =
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.NEXT_PUBLIC_BUILD_TIME ||
    "";
  const clientVersionRef = useRef<string>(initialVersion);
  const sessionStartTimeRef = useRef<number>(Date.now());

  // Monitored entity timestamps
  const lastSyncRef = useRef<{
    leads: number;
    tickets: number;
    settings: number;
  }>({
    leads: 0,
    tickets: 0,
    settings: 0,
  });

  // Subscribers map
  const subscribersRef = useRef<Map<SyncEntity, Set<() => void>>>(new Map());

  // BroadcastChannel reference
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Dispatch an update to registered subscribers
  const dispatchUpdate = useCallback((entity: SyncEntity) => {
    const notifySet = (targetEntity: SyncEntity) => {
      const set = subscribersRef.current.get(targetEntity);
      if (set) {
        set.forEach((cb) => {
          try {
            cb();
          } catch (e) {
            console.error(`Error in live sync callback for ${targetEntity}:`, e);
          }
        });
      }
    };

    if (entity === "all") {
      notifySet("leads");
      notifySet("tickets");
      notifySet("settings");
      notifySet("all");
    } else {
      notifySet(entity);
      notifySet("all");
    }
  }, []);

  // Trigger immediate hard reload for new application build
  const triggerAppReload = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  // Notify other tabs and server of a local mutation
  const notifyMutation = useCallback(
    (entity: SyncEntity) => {
      const now = Date.now();
      if (entity === "leads" || entity === "all") lastSyncRef.current.leads = now;
      if (entity === "tickets" || entity === "all") lastSyncRef.current.tickets = now;
      if (entity === "settings" || entity === "all") lastSyncRef.current.settings = now;

      // 1. Post to same-browser tabs via BroadcastChannel (<5ms latency)
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: "LOCAL_MUTATION",
            entity,
            timestamp: now,
          });
        } catch (e) {}
      }

      // 2. Dispatch to listeners in the current tab
      dispatchUpdate(entity);
    },
    [dispatchUpdate]
  );

  // Setup BroadcastChannel for cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, entity } = event.data || {};
      if (type === "LOCAL_MUTATION" && entity) {
        dispatchUpdate(entity);
      } else if (type === "APP_UPDATE_DETECTED" || type === "FORCE_SESSION_RELOAD") {
        setAppUpdateAvailable(true);
      }
    };

    return () => {
      channel.close();
      broadcastChannelRef.current = null;
    };
  }, [dispatchUpdate]);

  // Setup ChunkLoadError recovery
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleChunkError = (message: string) => {
      const isChunkError =
        message.includes("ChunkLoadError") ||
        message.includes("Loading chunk") ||
        message.includes("Failed to fetch dynamically imported module");

      if (isChunkError) {
        const lastReload = sessionStorage.getItem("gocab_chunk_reload_at");
        const now = Date.now();
        // Prevent infinite reload loops within 10 seconds
        if (!lastReload || now - Number(lastReload) > 10000) {
          sessionStorage.setItem("gocab_chunk_reload_at", now.toString());
          window.location.reload();
        }
      }
    };

    const onError = (e: ErrorEvent) => {
      if (e.message) handleChunkError(e.message);
    };

    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason?.message || String(e.reason || "");
      handleChunkError(reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  // Sync Status Poller Function
  const checkSyncStatus = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.onLine) {
      setIsOnline(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (lastSyncRef.current.leads > 0) {
        params.set("leads", lastSyncRef.current.leads.toString());
      }
      if (lastSyncRef.current.tickets > 0) {
        params.set("tickets", lastSyncRef.current.tickets.toString());
      }
      if (lastSyncRef.current.settings > 0) {
        params.set("settings", lastSyncRef.current.settings.toString());
      }
      if (clientVersionRef.current) {
        params.set("version", clientVersionRef.current);
      }
      params.set("sessionStart", sessionStartTimeRef.current.toString());

      const res = await fetch(`/api/system/sync-status?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) return;

      setIsOnline(true);
      const data = await res.json();

      // Check for forced refresh signal across all sessions or deployment update
      if (
        data.shouldRefreshApp ||
        (data.forceRefreshAt && data.forceRefreshAt > sessionStartTimeRef.current)
      ) {
        setAppUpdateAvailable(true);
        if (broadcastChannelRef.current) {
          try {
            broadcastChannelRef.current.postMessage({
              type: "FORCE_SESSION_RELOAD",
            });
          } catch (_) {}
        }
        return;
      }

      // Check for application deployment update
      if (data.version) {
        if (!clientVersionRef.current) {
          clientVersionRef.current = data.version;
        } else if (clientVersionRef.current !== data.version) {
          // New deployment detected!
          setAppUpdateAvailable(true);
          if (broadcastChannelRef.current) {
            broadcastChannelRef.current.postMessage({
              type: "APP_UPDATE_DETECTED",
              version: data.version,
            });
          }
        }
      }

      // Check for leads updates
      if (data.leads) {
        if (
          lastSyncRef.current.leads > 0 &&
          data.leads > lastSyncRef.current.leads
        ) {
          dispatchUpdate("leads");
        }
        lastSyncRef.current.leads = data.leads;
      }

      // Check for tickets updates
      if (data.tickets) {
        if (
          lastSyncRef.current.tickets > 0 &&
          data.tickets > lastSyncRef.current.tickets
        ) {
          dispatchUpdate("tickets");
        }
        lastSyncRef.current.tickets = data.tickets;
      }

      // Check for settings updates
      if (data.settings) {
        if (
          lastSyncRef.current.settings > 0 &&
          data.settings > lastSyncRef.current.settings
        ) {
          dispatchUpdate("settings");
        }
        lastSyncRef.current.settings = data.settings;
      }
    } catch (e) {
      // Network hiccup — keep previous state
    }
  }, [dispatchUpdate]);

  // Periodic Poller with visibility handling
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;

    const poll = () => {
      checkSyncStatus();
      const interval =
        document.visibilityState === "visible"
          ? ACTIVE_POLL_INTERVAL_MS
          : BACKGROUND_POLL_INTERVAL_MS;
      timerId = setTimeout(poll, interval);
    };

    // Initial check
    poll();

    // Check immediately on tab focus or visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkSyncStatus();
      }
    };

    const handleFocus = () => {
      checkSyncStatus();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkSyncStatus]);

  // Countdown auto-reload on new deployment
  useEffect(() => {
    if (!appUpdateAvailable) return;

    // If the tab is currently hidden/backgrounded, reload immediately when it becomes visible
    const handleVisibleReload = () => {
      if (document.visibilityState === "visible") {
        window.location.reload();
      }
    };

    if (document.hidden) {
      document.addEventListener("visibilitychange", handleVisibleReload);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibleReload);
      };
    }

    // Start 5-second countdown for active user
    setUpdateCountdown(5);
    const interval = setInterval(() => {
      setUpdateCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [appUpdateAvailable]);

  // Subscribe helper
  const subscribe = useCallback((entity: SyncEntity, callback: () => void) => {
    if (!subscribersRef.current.has(entity)) {
      subscribersRef.current.set(entity, new Set());
    }
    const set = subscribersRef.current.get(entity)!;
    set.add(callback);

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        subscribersRef.current.delete(entity);
      }
    };
  }, []);

  const forceAllSessionsRefresh = useCallback(async () => {
    try {
      await fetch("/api/system/sync-status", { method: "POST" });
    } catch (e) {
      console.error("Failed to trigger global force refresh:", e);
    }
  }, []);

  return (
    <LiveSyncContext.Provider
      value={{
        subscribe,
        notifyMutation,
        isOnline,
        appUpdateAvailable,
        triggerAppReload,
        forceAllSessionsRefresh,
      }}
    >
      {children}

      {/* Sleek Floating New Deployment Update Toast Banner */}
      {appUpdateAvailable && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 px-5 py-3.5 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-emerald-500/40 animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400">
            <Sparkles className="w-4 h-4 animate-spin" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide">
              Nouvelle mise à jour GoCab déployée !
            </span>
            <span className="text-xs text-slate-300">
              Actualisation automatique dans{" "}
              <span className="font-bold text-emerald-400 font-mono">
                {updateCountdown ?? 5}s
              </span>
              ...
            </span>
          </div>
          <button
            onClick={triggerAppReload}
            className="ml-3 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-semibold rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser maintenant
          </button>
        </div>
      )}
    </LiveSyncContext.Provider>
  );
}

/**
 * Hook to subscribe a component to live updates for a specific entity.
 * Callback is invoked whenever data changes in any session or tab.
 */
export function useLiveSync(
  entity: SyncEntity,
  onUpdate?: () => void
): {
  notifyMutation: (entity: SyncEntity) => void;
  isOnline: boolean;
  appUpdateAvailable: boolean;
  forceAllSessionsRefresh: () => Promise<void>;
} {
  const context = useContext(LiveSyncContext);

  useEffect(() => {
    if (!context || !onUpdate) return;
    const unsubscribe = context.subscribe(entity, onUpdate);
    return () => unsubscribe();
  }, [context, entity, onUpdate]);

  return {
    notifyMutation: context?.notifyMutation || (() => {}),
    isOnline: context?.isOnline ?? true,
    appUpdateAvailable: context?.appUpdateAvailable ?? false,
    forceAllSessionsRefresh: context?.forceAllSessionsRefresh || (async () => {}),
  };
}
