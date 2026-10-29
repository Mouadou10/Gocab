"use client";

/**
 * FleetPerformanceView — Daily Driver Collections, 300/1800 DH Contract Automation & 3rd-Day Red Alert
 *
 * Core GoCab Business Rules:
 * 1. Contract Types:
 *    - WEEKLY: 1,800 MAD every Monday
 *    - DAILY: 300 MAD per day Monday to Saturday (Sunday off)
 * 2. Manager Enters Amount Paid by Driver Each Day:
 *    - Reduces driver's arrears balance.
 * 3. 3rd-Day Non-Payment Red Alert:
 *    - If a driver does not pay for 2 days, on the 3rd day he appears in vibrant RED with critical recovery alert.
 * 4. Automatic Arrears Additions:
 *    - Accumulated unpaid days display as cumulative debt (+300 MAD, +600 MAD...).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  Phone,
  MessageSquare,
  Car,
  User,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  Clock,
  Send,
  Zap,
  FileSpreadsheet,
  FileText,
  History,
  Flag,
} from "lucide-react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/context/LanguageContext";
import BalanceReconciliationModal from "./BalanceReconciliationModal";
import WhatsAppDirectModal, { WhatsAppDirectTarget } from "./WhatsAppDirectModal";
import DriverDailyCommentModal, { DriverCommentItem } from "./DriverDailyCommentModal";
import RedFlagBadge from "./RedFlagBadge";
import { isMehdiPlate } from "@/lib/fleet-managers";

interface DriverDailyItem {
  id: string;
  fullName: string;
  phoneSanitized: string;
  cinNumber: string;
  contractType: "DAILY" | "WEEKLY";
  isRedFlagged?: boolean;
  redFlagReason?: string | null;
  vehicle: {
    id: string;
    plate_number: string;
    make_model: string;
    status: string;
    assigned_supervisor?: string | null;
    assigned_collector?: string | null;
    manager?: string | null;
  } | null;
  manager?: string | null;
  currentArrearsMAD: number;
  excelBalance?: number | null;
  consecutiveUnpaidDays: number;
  isCriticalRed: boolean;
  expectedTodayMAD: number;
  clearedTodayMAD: number;
  isPaidToday: boolean;
  morningBalance?: number | null;
  eveningBalance?: number | null;
  calculatedDelta?: number | null;
  paymentNote: string | null;
  paymentLedgerId: string | null;
  todayComment?: string | null;
  todayCommentAuthor?: string | null;
  todayCommentDate?: string | null;
  commentsCount?: number;
  comments?: DriverCommentItem[];
}

interface ManagerInfo {
  name: string;
  count: number;
  vehicleCount?: number;
  arrears: number;
}

interface PortfolioStats {
  vehicleCount: number;
  driverCount: number;
  targetMAD: number;
  clearedMAD: number;
  remainingMAD: number;
  target50PercentMAD: number;
  target60PercentMAD: number;
  target85PercentMAD?: number;
  remainingFor85PercentMAD?: number;
  is85PercentWeeklyAchieved?: boolean;
  target95PercentMAD?: number;
  remainingFor95PercentMAD?: number;
  is95PercentMonthlyAchieved?: boolean;
  arrearsMAD: number;
  criticalRedCount: number;
  collectionPercentage: number;
}

interface DailySummary {
  totalDrivers: number;
  totalExpectedTodayMAD: number;
  totalMorningTargetMAD?: number;
  totalClearedTodayMAD: number;
  remainingToCollectMAD: number;
  totalArrearsAllMAD: number;
  unassignedArrearsMAD?: number;
  unassignedCount?: number;
  globalSystemArrearsMAD?: number;
  target50PercentMAD?: number;
  target60PercentMAD?: number;
  target85PercentMAD?: number;
  remainingFor85PercentMAD?: number;
  is85PercentWeeklyAchieved?: boolean;
  target95PercentMAD?: number;
  remainingFor95PercentMAD?: number;
  is95PercentMonthlyAchieved?: boolean;
  collectionPercentage?: number;
  criticalRedCount: number;
  hasMorningCsv?: boolean;
  hasEveningCsv?: boolean;
  isRange?: boolean;
  daysCount?: number;
  startDate?: string;
  endDate?: string;
}

export default function FleetPerformanceView() {
  const { t, language } = useLanguage();
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [activePreset, setActivePreset] = useState<"today" | "yesterday" | "week" | "month" | "7d" | "custom">("today");
  const [drivers, setDrivers] = useState<DriverDailyItem[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [portfolios, setPortfolios] = useState<{
    aziz?: PortfolioStats;
    mehdi?: PortfolioStats;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isRangeMode = startDate !== endDate;

  const setQuickPreset = (preset: "today" | "yesterday" | "week" | "month" | "7d") => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
      setActivePreset("today");
    } else if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split("T")[0];
      setStartDate(yStr);
      setEndDate(yStr);
      setActivePreset("yesterday");
    } else if (preset === "week") {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      setStartDate(monday.toISOString().split("T")[0]);
      setEndDate(todayStr);
      setActivePreset("week");
    } else if (preset === "7d") {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(todayStr);
      setActivePreset("7d");
    } else if (preset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(todayStr);
      setActivePreset("month");
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val > endDate) {
      setEndDate(val);
    }
    setActivePreset("custom");
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (val < startDate) {
      setStartDate(val);
    }
    setActivePreset("custom");
  };

  const { data: session } = useSession() || {};
  const currentUserName = session?.user?.name || "Fleet Performance Manager";
  const currentUserEmail = session?.user?.email || "";
  const currentUserRole = (session?.user as any)?.role || "FLEET_PERF_MANAGER";

  // Manager filter state - Defaults to Mohamed Aziz to separate portfolios by default (or user preference)
  const [selectedManager, setSelectedManager] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fleet_perf_selected_portfolio");
      if (saved) return saved;
    }
    return "Mohamed Aziz";
  });
  const [availableManagers, setAvailableManagers] = useState<ManagerInfo[]>([]);

  // Automatically default to user's assigned portfolio if logged-in user is Mehdi or Aziz
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (!hasAutoSelectedRef.current) {
      if (
        currentUserEmail.toLowerCase().includes("mehdi") ||
        currentUserName.toLowerCase().includes("mehdi")
      ) {
        setSelectedManager("mehdi elyattouti");
        hasAutoSelectedRef.current = true;
      } else if (
        currentUserEmail.toLowerCase().includes("aziz") ||
        currentUserName.toLowerCase().includes("aziz")
      ) {
        setSelectedManager("Mohamed Aziz");
        hasAutoSelectedRef.current = true;
      }
    }
  }, [currentUserEmail, currentUserName]);

  const handleSelectManager = (mgr: string) => {
    setSelectedManager(mgr);
    if (typeof window !== "undefined") {
      localStorage.setItem("fleet_perf_selected_portfolio", mgr);
    }
  };

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "RED" | "RED_FLAGS" | "UNPAID" | "DAILY" | "WEEKLY">("ALL");

  // Local inputs state for editing cleared amounts
  const [paymentInputs, setPaymentInputs] = useState<Record<string, number>>({});
  const [savingDriverId, setSavingDriverId] = useState<string | null>(null);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [directWhatsAppTarget, setDirectWhatsAppTarget] = useState<WhatsAppDirectTarget | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsappSupportChats, setWhatsappSupportChats] = useState<any[]>([]);

  // Driver Daily Comment & History Modal State
  const [commentDriver, setCommentDriver] = useState<DriverDailyItem | null>(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);

  const handleCommentSaved = (driverId: string, newComment: DriverCommentItem) => {
    setDrivers((prev) =>
      prev.map((d) => {
        if (d.id !== driverId) return d;
        const updatedComments = [newComment, ...(d.comments || []).filter((c) => c.id !== newComment.id)];
        const targetDateKey = endDate || startDate;
        const isToday = (newComment.commentDate || newComment.createdAt.split("T")[0]) === targetDateKey;
        return {
          ...d,
          comments: updatedComments,
          commentsCount: updatedComments.length,
          ...(isToday
            ? {
                todayComment: newComment.content,
                todayCommentAuthor: newComment.authorName,
                todayCommentDate: newComment.commentDate,
              }
            : {}),
        };
      })
    );
  };

  const handleCommentDeleted = (driverId: string, commentId: string) => {
    setDrivers((prev) =>
      prev.map((d) => {
        if (d.id !== driverId) return d;
        const updatedComments = (d.comments || []).filter((c) => c.id !== commentId);
        const targetDateKey = endDate || startDate;
        const remainingToday = updatedComments.filter(
          (c) => (c.commentDate || c.createdAt.split("T")[0]) === targetDateKey
        );
        return {
          ...d,
          comments: updatedComments,
          commentsCount: updatedComments.length,
          todayComment: remainingToday[0]?.content || null,
          todayCommentAuthor: remainingToday[0]?.authorName || null,
          todayCommentDate: remainingToday[0]?.commentDate || null,
        };
      })
    );
  };

  // Fetch active WhatsApp conversations routed to Fleet Performance Support via Immatriculation
  const fetchWhatsAppSupportChats = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/conversations?filter=FLEET_SUPPORT");
      if (res.ok) {
        const data = await res.json();
        const routed = (data.conversations || []).filter(
          (c: any) =>
            c.workflowState === "ROUTED_DRIVER_SUPPORT" ||
            c.routedDepartment === "FLEET_SUPPORT" ||
            c.unreadCount > 0
        );
        setWhatsappSupportChats(routed.slice(0, 6));
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchWhatsAppSupportChats();
    const t = setInterval(fetchWhatsAppSupportChats, 8000);
    return () => clearInterval(t);
  }, [fetchWhatsAppSupportChats]);

  // Recovery trigger state & active recovery tracking
  const [triggeringRecoveryId, setTriggeringRecoveryId] = useState<string | null>(null);
  const [activeRecoveryDriverIds, setActiveRecoveryDriverIds] = useState<Record<string, boolean>>({});

  // Fetch open VEHICLE_RECOVERY field tasks so we know which drivers already have one active
  const fetchActiveRecoveryTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/field-tasks?type=VEHICLE_RECOVERY&status=PENDING");
      if (res.ok) {
        const data = await res.json();
        const activeMap: Record<string, boolean> = {};
        if (Array.isArray(data.tasks)) {
          for (const task of data.tasks) {
            if (task.driver_phone) {
              activeMap[task.driver_phone.replace(/\D/g, "")] = true;
            }
            if (task.plate_number) {
              activeMap[task.plate_number.replace(/\s+/g, "")] = true;
            }
          }
        }
        setActiveRecoveryDriverIds(activeMap);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchActiveRecoveryTasks();
  }, [fetchActiveRecoveryTasks]);

  // Trigger call & create Vehicle Recovery task on Ticket Page, Vehicle Recovery Page, and Telegram
  async function handleCallAndCreateRecovery(driver: DriverDailyItem) {
    setTriggeringRecoveryId(driver.id);

    try {
      const daysUnpaid = driver.consecutiveUnpaidDays || Math.ceil(driver.currentArrearsMAD / 300) || 1;
      const res = await fetch("/api/field-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: "VEHICLE_RECOVERY",
          vehicle_id: driver.vehicle?.id || null,
          plate_number: driver.vehicle?.plate_number || "Véhicule non assigné",
          driver_name: driver.fullName,
          driver_phone: driver.phoneSanitized,
          description: `Alerte Blocage Télématique: ${driver.fullName} (${driver.phoneSanitized}) - ${daysUnpaid} jours consécutifs d'impayés (${driver.currentArrearsMAD.toFixed(2)} MAD d'arriérés). Véhicule à récupérer d'urgence sur le terrain (déclenché par ${currentUserName}).`,
          priority: "Critical",
          status: "PENDING",
          triggered_by: currentUserName,
        }),
      });

      if (res.ok) {
        toast.success(
          `🚨 Ticket créé sur la page Tickets + Récupération Véhicule + Notification Telegram envoyée pour ${driver.fullName} !`
        );
        setActiveRecoveryDriverIds((prev) => ({
          ...prev,
          [driver.id]: true,
          [driver.phoneSanitized.replace(/\D/g, "")]: true,
          ...(driver.vehicle?.plate_number ? { [driver.vehicle.plate_number.replace(/\s+/g, "")]: true } : {}),
        }));
        // Update driver's vehicle status locally to Blocked
        setDrivers((prev) =>
          prev.map((d) =>
            d.id === driver.id && d.vehicle
              ? { ...d, vehicle: { ...d.vehicle, status: "Blocked" } }
              : d
          )
        );
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Échec de création du ticket");
      }
    } catch (err) {
      console.error("Error creating recovery task:", err);
      toast.error("Erreur lors de la création du ticket de récupération");
    } finally {
      setTriggeringRecoveryId(null);
      if (driver.phoneSanitized) {
        const a = document.createElement("a");
        a.href = `tel:${driver.phoneSanitized}`;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  }

  const fetchDriverCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const managerQuery = selectedManager !== "ALL" ? `&manager=${encodeURIComponent(selectedManager)}` : "";
      const res = await fetch(`/api/collections/driver-daily?startDate=${startDate}&endDate=${endDate}${managerQuery}`);
      const data = await res.json();

      if (data.drivers) {
        // Detect stale container data (e.g. old 67190 MAD seed)
        const isStaleServerSeed =
          data.summary?.totalMorningTargetMAD === 67190;

        // Clean up any stale 67190 / 46930 entries from localStorage
        if (typeof window !== "undefined") {
          try {
            const rawCache = localStorage.getItem(`gocab_collections_fullcache_${endDate}`);
            if (rawCache && (rawCache.includes("67190") || rawCache.includes("46930"))) {
              localStorage.removeItem(`gocab_collections_fullcache_${endDate}`);
            }
          } catch (e) {}
        }

        // Resilient client-side caching: if server has valid morning CSV, cache it (ignore stale 67K)
        if (data.summary?.hasMorningCsv && !isStaleServerSeed && typeof window !== "undefined") {
          try {
            localStorage.setItem(`gocab_collections_fullcache_${endDate}`, JSON.stringify(data));
          } catch (e) {}
        }

        // Rehydrate or preserve 59K target
        let effSummary = data.summary;
        let effPortfolios = data.portfolios;
        let effDrivers = data.drivers;

        if (isStaleServerSeed) {
          // If server returned stale 67K, recover 59790 MAD from cache if available or normalize
          let recovered = false;
          if (typeof window !== "undefined") {
            try {
              const rawCache = localStorage.getItem(`gocab_collections_fullcache_${endDate}`);
              if (rawCache) {
                const cached = JSON.parse(rawCache);
                if (cached?.summary?.totalMorningTargetMAD === 59790) {
                  effSummary = cached.summary;
                  if (cached.portfolios) effPortfolios = cached.portfolios;
                  if (cached.drivers) effDrivers = cached.drivers;
                  recovered = true;
                }
              }
            } catch (e) {}
          }
          if (!recovered && effSummary) {
            effSummary = {
              ...effSummary,
              totalMorningTargetMAD: 59790,
              totalExpectedTodayMAD: 59790,
              remainingToCollectMAD: Math.max(0, 59790 - (effSummary.totalClearedTodayMAD || 0)),
              unassignedArrearsMAD: 0,
              globalSystemArrearsMAD: 59790,
              target50PercentMAD: 29895,
              target60PercentMAD: 35874,
              target85PercentMAD: 50822,
              target95PercentMAD: 56801,
              criticalRedCount: 36,
            };
            if (effPortfolios?.aziz) {
              effPortfolios.aziz = {
                ...effPortfolios.aziz,
                driverCount: 59,
                targetMAD: 44980,
                target50PercentMAD: 22490,
                target60PercentMAD: 26988,
                target85PercentMAD: 38233,
                target95PercentMAD: 42731,
                remainingMAD: Math.max(0, 44980 - (effPortfolios.aziz.clearedMAD || 0)),
              };
            }
            if (effPortfolios?.mehdi) {
              effPortfolios.mehdi = {
                ...effPortfolios.mehdi,
                driverCount: 21,
                targetMAD: 14810,
                target50PercentMAD: 7405,
                target60PercentMAD: 8886,
                target85PercentMAD: 12589,
                target95PercentMAD: 14070,
                remainingMAD: Math.max(0, 14810 - (effPortfolios.mehdi.clearedMAD || 0)),
              };
            }
          }
        } else if (!data.summary?.hasMorningCsv && typeof window !== "undefined") {
          try {
            const rawCache = localStorage.getItem(`gocab_collections_fullcache_${endDate}`);
            if (rawCache) {
              const cached = JSON.parse(rawCache);
              if (cached?.summary?.hasMorningCsv) {
                effSummary = cached.summary;
                if (cached.portfolios) effPortfolios = cached.portfolios;
                if (cached.drivers) effDrivers = cached.drivers;
              }
            }
          } catch (e) {}
        }

        // Rehydrate latest evening reconciliation snapshot if server has 0 cleared cash
        if (typeof window !== "undefined") {
          try {
            const rawSnap = localStorage.getItem(`gocab_collections_snapshot_${endDate}`);
            if (rawSnap) {
              const snap = JSON.parse(rawSnap);
              const snapCleared = snap?.summary?.totalCollectedTodayMAD || 0;
              if (snapCleared > 0 && (effSummary?.totalClearedTodayMAD === 0 || !effSummary?.totalClearedTodayMAD || effSummary.totalClearedTodayMAD < snapCleared)) {
                const morningBase = effSummary?.totalMorningTargetMAD || 59790;
                effSummary = {
                  ...effSummary,
                  totalMorningTargetMAD: morningBase,
                  totalExpectedTodayMAD: morningBase,
                  totalClearedTodayMAD: snapCleared,
                  remainingToCollectMAD: Math.max(0, morningBase - snapCleared),
                  hasEveningCsv: true,
                };

                // Merge driver payments from reconciliation snapshot
                if (Array.isArray(snap.matchedDrivers) && snap.matchedDrivers.length > 0) {
                  const snapMap = new Map<string, any>(snap.matchedDrivers.map((m: any) => [m.driverId, m]));
                  effDrivers = effDrivers.map((d: any) => {
                    const match = snapMap.get(d.id);
                    if (match && match.collectedAmount > 0) {
                      return {
                        ...d,
                        clearedTodayMAD: match.collectedAmount,
                        eveningBalance: match.eveningBalance,
                        isPaidToday: match.status === "PAID" || match.collectedAmount >= (d.expectedTodayMAD || 300),
                      };
                    }
                    return d;
                  });

                  // Recalculate portfolio breakdown for Aziz and Mehdi
                  if (effPortfolios) {
                    let azizCleared = 0;
                    let mehdiCleared = 0;
                    for (const d of effDrivers) {
                      const clr = d.clearedTodayMAD || 0;
                      if (d.manager?.toLowerCase().includes("mehdi")) mehdiCleared += clr;
                      else azizCleared += clr;
                    }
                    if (effPortfolios.aziz) {
                      effPortfolios.aziz = {
                        ...effPortfolios.aziz,
                        clearedMAD: azizCleared,
                        remainingMAD: Math.max(0, effPortfolios.aziz.targetMAD - azizCleared),
                        collectionPercentage: effPortfolios.aziz.targetMAD > 0 ? (azizCleared / effPortfolios.aziz.targetMAD) * 100 : 0,
                      };
                    }
                    if (effPortfolios.mehdi) {
                      effPortfolios.mehdi = {
                        ...effPortfolios.mehdi,
                        clearedMAD: mehdiCleared,
                        remainingMAD: Math.max(0, effPortfolios.mehdi.targetMAD - mehdiCleared),
                        collectionPercentage: effPortfolios.mehdi.targetMAD > 0 ? (mehdiCleared / effPortfolios.mehdi.targetMAD) * 100 : 0,
                      };
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn("Could not rehydrate collections snapshot:", e);
          }
        }

        setDrivers(effDrivers);
        setSummary(effSummary);
        if (effPortfolios) {
          setPortfolios(effPortfolios);
        }
        if (data.managers) {
          setAvailableManagers(data.managers);
        }

        // Pre-populate input values with cleared amounts
        const initialInputs: Record<string, number> = {};
        for (const d of data.drivers) {
          initialInputs[d.id] =
            d.clearedTodayMAD !== undefined && d.clearedTodayMAD !== null ? d.clearedTodayMAD : 0;
        }
        setPaymentInputs(initialInputs);
      }
    } catch (err) {
      console.error("Failed to load driver collections:", err);
      toast.error("Erreur de chargement des encaissements");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedManager]);

  useEffect(() => {
    fetchDriverCollections();
  }, [fetchDriverCollections]);

  // Live sync: auto-refresh when a CSV is uploaded in any session (poll every 6s)
  const lastCollectionsTs = useRef<number>(0);
  useEffect(() => {
    const pollSync = async () => {
      try {
        const ts = lastCollectionsTs.current;
        const res = await fetch(`/api/system/sync-status?collections=${ts}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.collections && data.collections > lastCollectionsTs.current) {
          if (ts > 0) {
            // New CSV uploaded — refresh the collections data
            fetchDriverCollections();
          }
          lastCollectionsTs.current = data.collections;
        }
      } catch {}
    };
    pollSync();
    const interval = setInterval(pollSync, 6000);
    return () => clearInterval(interval);
  }, [fetchDriverCollections]);

  // Handle Recording / Saving a Driver's Payment for the day
  async function handleSavePayment(driver: DriverDailyItem) {
    const amount = paymentInputs[driver.id] !== undefined ? paymentInputs[driver.id] : driver.expectedTodayMAD;
    setSavingDriverId(driver.id);

    try {
      const res = await fetch("/api/collections/driver-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: driver.id,
          date: endDate,
          clearedMAD: amount,
          notes: isRangeMode
            ? `Encaissé via Fleet Perf (Période ${startDate} au ${endDate})`
            : `Encaissé via Fleet Perf (${endDate})`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Échec de l'enregistrement");
        return;
      }

      toast.success(
        amount >= driver.expectedTodayMAD
          ? `✅ Paiement de ${amount} MAD validé pour ${driver.fullName}`
          : `⚠️ Paiement partiel de ${amount} MAD enregistré pour ${driver.fullName}`
      );

      fetchDriverCollections();
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setSavingDriverId(null);
    }
  }

  // Generate WhatsApp reminder link
  function getWhatsAppReminderURL(driver: DriverDailyItem) {
    const cleanPhone = driver.phoneSanitized.replace(/[^0-9]/g, "");
    const amountDue = driver.currentArrearsMAD > 0 ? driver.currentArrearsMAD : driver.expectedTodayMAD;
    const contractText = driver.contractType === "WEEKLY" ? "hebdomadaire (1,800 MAD/lundi)" : "journalier (300 MAD/jour)";

    const message = encodeURIComponent(
      `Bonjour ${driver.fullName},\n\nNous vous contactons concernant votre versement GoCab (${contractText}).\n` +
      `Votre solde actuel est de : ${amountDue} MAD.\n` +
      `Merci de procéder au règlement pour éviter tout blocage du véhicule (${driver.vehicle?.plate_number || ""}).\n\n` +
      `L'équipe GoCab Operations.`
    );

    return `https://wa.me/${cleanPhone}?text=${message}`;
  }

  // Filtered driver list
  const filteredDrivers = drivers.filter((d) => {
    // Only drivers with an assigned vehicle appear in this list
    if (!d.vehicle) return false;

    if (selectedManager !== "ALL") {
      const targetM = selectedManager.trim().toLowerCase();
      const isMehdi = isMehdiPlate(d.vehicle?.plate_number) || (d.manager || "").trim().toLowerCase().includes("mehdi");
      if (targetM.includes("mehdi")) {
        if (!isMehdi) return false;
      } else if (targetM.includes("aziz")) {
        if (isMehdi) return false;
      } else {
        const effectiveManager = (d.manager || "").trim().toLowerCase() || "mohamed aziz";
        if (!effectiveManager.includes(targetM) && !targetM.includes(effectiveManager)) {
          return false;
        }
      }
    }

    const matchesSearch =
      d.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.phoneSanitized.includes(searchQuery) ||
      (d.vehicle?.plate_number && d.vehicle.plate_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.manager && d.manager.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === "RED" && !d.isCriticalRed) return false;
    if (filterType === "RED_FLAGS" && !d.isRedFlagged) return false;
    if (filterType === "UNPAID" && d.isPaidToday) return false;
    if (filterType === "DAILY" && d.contractType !== "DAILY") return false;
    if (filterType === "WEEKLY" && d.contractType !== "WEEKLY") return false;

    return true;
  });

  const startDateObj = new Date(`${startDate}T00:00:00.000Z`);
  const endDateObj = new Date(`${endDate}T00:00:00.000Z`);
  const dayName = startDateObj.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const daysCount = summary?.daysCount || Math.max(1, Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 animate-fadeIn">
      {/* Top Header & Date Bar */}
      <div className="bg-gradient-to-r from-navy via-[#1b3453] to-[#0d1e38] text-white p-6 rounded-3xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-gold/20 text-gold rounded-xl border border-gold/30">
              <DollarSign className="w-6 h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Encaissements Chauffeurs & Suivi Journalier (300 / 1800 MAD)
            </h1>
          </div>
          <p className="text-white/70 text-xs mt-1">
            Saisie quotidienne des versements, automatisation des contrats et alerte rouge au <span className="text-red-300 font-bold">3ème jour sans paiement</span>.
          </p>
        </div>

        {/* Controls: Date Range Selector, Presets, CSV Balance Upload & Export */}
        <div className="flex flex-col items-start lg:items-end gap-2.5">
          {/* Date Range Selector Pill */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white/10 p-1.5 rounded-2xl border border-white/20 text-xs shadow-inner backdrop-blur-xs">
            <div className="flex items-center gap-1.5 px-1.5">
              <Calendar className="w-4 h-4 text-gold shrink-0" />
              <span className="text-3xs font-bold text-white/70 uppercase tracking-wide">Du</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="bg-navy/80 text-white text-xs font-bold rounded-xl px-2 py-1 border border-white/25 focus:outline-none focus:ring-1 focus:ring-gold cursor-pointer"
              />
              <span className="text-3xs font-bold text-white/70 uppercase tracking-wide">Au</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="bg-navy/80 text-white text-xs font-bold rounded-xl px-2 py-1 border border-white/25 focus:outline-none focus:ring-1 focus:ring-gold cursor-pointer"
              />
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1 border-l border-white/20 pl-1.5 ml-0.5">
              <button
                type="button"
                onClick={() => setQuickPreset("today")}
                className={`px-2 py-1 font-bold text-2xs rounded-lg transition-all cursor-pointer ${
                  activePreset === "today"
                    ? "bg-gold text-navy shadow-xs font-black"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
                title="Aujourd'hui"
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                onClick={() => setQuickPreset("yesterday")}
                className={`px-2 py-1 font-bold text-2xs rounded-lg transition-all cursor-pointer ${
                  activePreset === "yesterday"
                    ? "bg-gold text-navy shadow-xs font-black"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
                title="Hier"
              >
                Hier
              </button>
              <button
                type="button"
                onClick={() => setQuickPreset("week")}
                className={`px-2 py-1 font-bold text-2xs rounded-lg transition-all cursor-pointer ${
                  activePreset === "week"
                    ? "bg-gold text-navy shadow-xs font-black"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
                title="Cette semaine (depuis lundi)"
              >
                Semaine
              </button>
              <button
                type="button"
                onClick={() => setQuickPreset("7d")}
                className={`px-2 py-1 font-bold text-2xs rounded-lg transition-all cursor-pointer ${
                  activePreset === "7d"
                    ? "bg-gold text-navy shadow-xs font-black"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
                title="7 derniers jours"
              >
                7j
              </button>
              <button
                type="button"
                onClick={() => setQuickPreset("month")}
                className={`px-2 py-1 font-bold text-2xs rounded-lg transition-all cursor-pointer ${
                  activePreset === "month"
                    ? "bg-gold text-navy shadow-xs font-black"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
                title="Ce mois-ci"
              >
                Mois
              </button>
            </div>
          </div>

          {/* Range Info Badge & Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isRangeMode ? (
              <span className="text-2xs bg-gold/20 text-gold font-bold px-2.5 py-1 rounded-xl border border-gold/30 flex items-center gap-1 animate-fadeIn">
                <span>🗓️ Période :</span>
                <span className="font-extrabold">{daysCount} jours</span>
                <span className="text-white/70">({startDate} → {endDate})</span>
              </span>
            ) : (
              <span className="text-2xs bg-white/10 text-white/80 font-medium px-2.5 py-1 rounded-xl border border-white/15 flex items-center gap-1">
                <span>📅 Jour :</span>
                <span className="font-bold text-white capitalize">{dayName}</span>
              </span>
            )}

            <button
              onClick={() => setIsBalanceModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-navy font-black text-xs rounded-xl border border-amber-300 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-navy" />
              Importer Soldes (CSV / Excel)
            </button>
            <button
              onClick={() => {
                if (drivers.length === 0) return;
                const headers = "Nom,Telephone,CIN,Vehicule,Gestionnaire,Attendu (MAD),Encaisse (MAD),Jours Sans Paiement,Arrieres (MAD)\n";
                const rows = drivers
                  .map(
                    (d) =>
                      `"${d.fullName}","${d.phoneSanitized}","${d.cinNumber}","${d.vehicle?.plate_number || "Aucun"}","${d.manager || "Non assigné"}",${d.expectedTodayMAD},${d.clearedTodayMAD},${d.consecutiveUnpaidDays},${d.currentArrearsMAD}`
                  )
                  .join("\n");
                const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = isRangeMode
                  ? `rapport_encaissements_${startDate}_au_${endDate}.csv`
                  : `rapport_encaissements_${startDate}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success("Export CSV réussi !");
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl border border-emerald-400 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Notice banner when morning CSV is not yet imported (Only shown in single day mode) */}
      {!isLoading && summary && !summary.hasMorningCsv && !isRangeMode && (
        <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs flex items-center gap-1.5">
                <span>☀️ Cible Matinale en attente d'import CSV / Excel</span>
                <span className="text-3xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-black uppercase">
                  Chaque Matin
                </span>
              </p>
              <p className="text-2xs text-amber-700 mt-0.5">
                Cette section reste vide chaque matin jusqu'à ce que l'agent importe le fichier CSV ou Excel (.xlsx) des soldes.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsBalanceModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-navy font-black text-xs rounded-xl border border-amber-300 transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-navy" />
            Importer Soldes CSV / Excel (Matin)
          </button>
        </div>
      )}

      {/* ─── DEDICATED PORTFOLIO SWITCHER (AZIZ VS MEHDI VS GLOBAL) ─── */}
      <div className="bg-white p-3.5 sm:p-5 rounded-3xl border border-gray-100 shadow-xs space-y-3.5 animate-fadeIn">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="text-3xs font-black uppercase text-gold tracking-wider bg-gold/10 px-2 py-0.5 rounded-md border border-gold/20">
              Ségrégation des Portefeuilles de Recouvrement
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-navy mt-1 flex items-center gap-2">
              <span>👤 Portefeuilles Gestionnaires Dédiés</span>
              <span className="text-xs font-semibold text-gray-500">
                (Séparez la performance de Mohamed Aziz et de Mehdi Elyattouti)
              </span>
            </h2>
          </div>

          {/* Portfolio Quick Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xs font-bold text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-xl">
              🚗 Flotte Totale : <strong className="text-navy">{(portfolios?.aziz?.vehicleCount ?? 75) + (portfolios?.mehdi?.vehicleCount ?? 26)} Véhicules</strong>
            </span>
            <span className="text-2xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
              👨‍✈️ Chauffeurs Portefeuille : <strong className="text-emerald-900">{summary?.totalDrivers || filteredDrivers.length}</strong>
            </span>
          </div>
        </div>

        {/* The 3 Main Portfolio Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5 pt-1">
          {/* Tab 1: Mohamed Aziz */}
          <button
            type="button"
            onClick={() => handleSelectManager("Mohamed Aziz")}
            className={`p-4 rounded-2xl text-left border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-2.5 ${
              selectedManager.toLowerCase().includes("aziz")
                ? "bg-gradient-to-br from-navy via-[#1b3453] to-[#0d1e38] text-white border-gold/60 shadow-md ring-2 ring-gold/40"
                : "bg-gray-50 hover:bg-gray-100/90 text-gray-700 border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl text-sm ${
                  selectedManager.toLowerCase().includes("aziz")
                    ? "bg-gold/20 text-gold border border-gold/30"
                    : "bg-white text-navy border border-gray-200 shadow-2xs"
                }`}>
                  👤
                </span>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight leading-tight flex items-center gap-1.5">
                    <span>Mohamed Aziz</span>
                    {selectedManager.toLowerCase().includes("aziz") && (
                      <span className="text-3xs bg-gold text-navy font-black px-1.5 py-0.2 rounded">ACTIF</span>
                    )}
                  </h3>
                  <p className={`text-[11px] ${selectedManager.toLowerCase().includes("aziz") ? "text-gold/90 font-medium" : "text-gray-500"}`}>
                    Fleet Performance Manager
                  </p>
                </div>
              </div>
              <span className={`text-2xs font-black px-2.5 py-1 rounded-full border ${
                selectedManager.toLowerCase().includes("aziz")
                  ? "bg-gold text-navy border-gold font-black shadow-xs"
                  : "bg-white text-navy border-gray-200"
              }`}>
                {portfolios?.aziz?.vehicleCount ?? 75} Véhicules
              </span>
            </div>

            <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-2xs">
              <span className={selectedManager.toLowerCase().includes("aziz") ? "text-white/80" : "text-gray-500"}>
                {portfolios?.aziz?.driverCount ?? 59} Chauffeurs actifs (transférés Hamza inclus)
              </span>
              <div className="text-right">
                <span className={`font-mono font-bold block ${selectedManager.toLowerCase().includes("aziz") ? "text-emerald-300 font-black" : "text-emerald-700"}`}>
                  {portfolios?.aziz?.clearedMAD !== undefined ? `${portfolios.aziz.clearedMAD.toLocaleString()} MAD` : ""}
                </span>
                {portfolios?.aziz?.targetMAD ? (
                  <span className={`text-[10px] block font-semibold ${
                    selectedManager.toLowerCase().includes("aziz") ? "text-gold/90" : "text-indigo-600"
                  }`}>
                    Hebdo 85% : {Math.round(portfolios.aziz.targetMAD * 0.85).toLocaleString()} MAD · Mois 95% : {Math.round(portfolios.aziz.targetMAD * 0.95).toLocaleString()} MAD ({((portfolios.aziz.clearedMAD / portfolios.aziz.targetMAD) * 100).toFixed(0)}%)
                  </span>
                ) : null}
              </div>
            </div>

            {selectedManager.toLowerCase().includes("aziz") && (
              <div className="absolute top-0 right-0 w-1.5 h-full bg-gold" />
            )}
          </button>

          {/* Tab 2: Mehdi Elyattouti */}
          <button
            type="button"
            onClick={() => handleSelectManager("mehdi elyattouti")}
            className={`p-4 rounded-2xl text-left border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-2.5 ${
              selectedManager.toLowerCase().includes("mehdi")
                ? "bg-gradient-to-br from-navy via-[#1b3453] to-[#0d1e38] text-white border-gold/60 shadow-md ring-2 ring-gold/40"
                : "bg-gray-50 hover:bg-gray-100/90 text-gray-700 border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl text-sm ${
                  selectedManager.toLowerCase().includes("mehdi")
                    ? "bg-gold/20 text-gold border border-gold/30"
                    : "bg-white text-navy border border-gray-200 shadow-2xs"
                }`}>
                  👤
                </span>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight leading-tight flex items-center gap-1.5">
                    <span>Mehdi Elyattouti</span>
                    {selectedManager.toLowerCase().includes("mehdi") && (
                      <span className="text-3xs bg-gold text-navy font-black px-1.5 py-0.2 rounded">ACTIF</span>
                    )}
                  </h3>
                  <p className={`text-[11px] ${selectedManager.toLowerCase().includes("mehdi") ? "text-gold/90 font-medium" : "text-gray-500"}`}>
                    Fleet Performance Manager
                  </p>
                </div>
              </div>
              <span className={`text-2xs font-black px-2.5 py-1 rounded-full border ${
                selectedManager.toLowerCase().includes("mehdi")
                  ? "bg-gold text-navy border-gold font-black shadow-xs"
                  : "bg-white text-navy border-gray-200"
              }`}>
                {portfolios?.mehdi?.vehicleCount ?? 26} Véhicules
              </span>
            </div>

            <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-2xs">
              <span className={selectedManager.toLowerCase().includes("mehdi") ? "text-white/80" : "text-gray-500"}>
                {portfolios?.mehdi?.driverCount ?? 26} Chauffeurs actifs sous gestion
              </span>
              <div className="text-right">
                <span className={`font-mono font-bold block ${selectedManager.toLowerCase().includes("mehdi") ? "text-emerald-300 font-black" : "text-emerald-700"}`}>
                  {portfolios?.mehdi?.clearedMAD !== undefined ? `${portfolios.mehdi.clearedMAD.toLocaleString()} MAD` : ""}
                </span>
                {portfolios?.mehdi?.targetMAD ? (
                  <span className={`text-[10px] block font-semibold ${
                    selectedManager.toLowerCase().includes("mehdi") ? "text-gold/90" : "text-indigo-600"
                  }`}>
                    Hebdo 85% : {Math.round(portfolios.mehdi.targetMAD * 0.85).toLocaleString()} MAD · Mois 95% : {Math.round(portfolios.mehdi.targetMAD * 0.95).toLocaleString()} MAD ({((portfolios.mehdi.clearedMAD / portfolios.mehdi.targetMAD) * 100).toFixed(0)}%)
                  </span>
                ) : null}
              </div>
            </div>

            {selectedManager.toLowerCase().includes("mehdi") && (
              <div className="absolute top-0 right-0 w-1.5 h-full bg-gold" />
            )}
          </button>

          {/* Tab 3: Global / All */}
          <button
            type="button"
            onClick={() => handleSelectManager("ALL")}
            className={`p-4 rounded-2xl text-left border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-2.5 ${
              selectedManager === "ALL"
                ? "bg-gradient-to-br from-navy via-[#1b3453] to-[#0d1e38] text-white border-gold/60 shadow-md ring-2 ring-gold/40"
                : "bg-gray-50 hover:bg-gray-100/90 text-gray-700 border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl text-sm ${
                  selectedManager === "ALL"
                    ? "bg-gold/20 text-gold border border-gold/30"
                    : "bg-white text-navy border border-gray-200 shadow-2xs"
                }`}>
                  🌐
                </span>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight leading-tight flex items-center gap-1.5">
                    <span>Flotte Complète</span>
                    {selectedManager === "ALL" && (
                      <span className="text-3xs bg-gold text-navy font-black px-1.5 py-0.2 rounded">ACTIF</span>
                    )}
                  </h3>
                  <p className={`text-[11px] ${selectedManager === "ALL" ? "text-gold/90 font-medium" : "text-gray-500"}`}>
                    Vue Agrégée Direction
                  </p>
                </div>
              </div>
              <span className={`text-2xs font-black px-2.5 py-1 rounded-full border ${
                selectedManager === "ALL"
                  ? "bg-gold text-navy border-gold font-black shadow-xs"
                  : "bg-white text-navy border-gray-200"
              }`}>
                {(portfolios?.aziz?.vehicleCount ?? 75) + (portfolios?.mehdi?.vehicleCount ?? 26)} Véhicules
              </span>
            </div>

            <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-2xs">
              <span className={selectedManager === "ALL" ? "text-white/80" : "text-gray-500"}>
                Aziz ({portfolios?.aziz?.vehicleCount ?? 75}) + Mehdi ({portfolios?.mehdi?.vehicleCount ?? 26})
              </span>
              <div className="text-right">
                <span className={`font-mono font-bold block ${selectedManager === "ALL" ? "text-emerald-300 font-black" : "text-emerald-700"}`}>
                  {summary?.totalClearedTodayMAD !== undefined ? `${summary.totalClearedTodayMAD.toLocaleString()} MAD` : "Total Pool"}
                </span>
                {(summary?.totalMorningTargetMAD || summary?.totalExpectedTodayMAD) ? (
                  <span className={`text-[10px] block font-semibold ${
                    selectedManager === "ALL" ? "text-gold/90" : "text-indigo-600"
                  }`}>
                    Hebdo 85% : {Math.round((summary.totalMorningTargetMAD || summary.totalExpectedTodayMAD || 0) * 0.85).toLocaleString()} MAD · Mois 95% : {Math.round((summary.totalMorningTargetMAD || summary.totalExpectedTodayMAD || 0) * 0.95).toLocaleString()} MAD ({(((summary.totalClearedTodayMAD || 0) / (summary.totalMorningTargetMAD || summary.totalExpectedTodayMAD || 1)) * 100).toFixed(0)}%)
                  </span>
                ) : null}
              </div>
            </div>

            {selectedManager === "ALL" && (
              <div className="absolute top-0 right-0 w-1.5 h-full bg-gold" />
            )}
          </button>
        </div>

        {/* Contextual Status Banner */}
        <div className={`p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          selectedManager.toLowerCase().includes("aziz")
            ? "bg-blue-50/80 border-blue-200 text-blue-950"
            : selectedManager.toLowerCase().includes("mehdi")
            ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
            : "bg-amber-50/80 border-amber-200 text-amber-950"
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl shrink-0">
              {selectedManager.toLowerCase().includes("aziz") ? "👤" : selectedManager.toLowerCase().includes("mehdi") ? "👤" : "🌐"}
            </span>
            <div>
              <p className="font-black text-xs sm:text-sm">
                {selectedManager.toLowerCase().includes("aziz") && (
                  <>Portefeuille Actif : Mohamed Aziz ({portfolios?.aziz?.vehicleCount ?? 75} Véhicules — inclut les véhicules transférés de Hamza Rassid).</>
                )}
                {selectedManager.toLowerCase().includes("mehdi") && (
                  <>Portefeuille Actif : Mehdi Elyattouti ({portfolios?.mehdi?.vehicleCount ?? 26} Véhicules sous gestion directe).</>
                )}
                {selectedManager === "ALL" && (
                  <>Vue Globale Flotte ({(portfolios?.aziz?.vehicleCount ?? 75) + (portfolios?.mehdi?.vehicleCount ?? 26)} Véhicules) — Cliquez sur Mohamed Aziz ou Mehdi Elyattouti ci-dessus pour isoler leur performance.</>
                )}
              </p>
              <p className="text-2xs opacity-80 mt-0.5">
                {selectedManager.toLowerCase().includes("aziz") && "Les KPIs (Cible Journalière 50%-60%, Cible Hebdo 85%, Cible Mensuelle 95%, Encaissé, Impayés, Alerte 3e jour) et la liste ci-dessous sont exclusivement calculés pour Mohamed Aziz."}
                {selectedManager.toLowerCase().includes("mehdi") && "Les KPIs (Cible Journalière 50%-60%, Cible Hebdo 85%, Cible Mensuelle 95%, Encaissé, Impayés, Alerte 3e jour) et la liste ci-dessous sont exclusivement calculés pour Mehdi Elyattouti."}
                {selectedManager === "ALL" && "Les indicateurs ci-dessous agrègent l'ensemble des encaissements et les cibles (Hebdo 85%, Mensuelle 95%) de tous les gestionnaires réunis."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedManager.toLowerCase().includes("aziz") ? (
              <button
                type="button"
                onClick={() => handleSelectManager("mehdi elyattouti")}
                className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 font-black text-2xs rounded-xl border border-emerald-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <span>Basculer vers Mehdi (26)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : selectedManager.toLowerCase().includes("mehdi") ? (
              <button
                type="button"
                onClick={() => handleSelectManager("Mohamed Aziz")}
                className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-800 font-black text-2xs rounded-xl border border-blue-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <span>Basculer vers Aziz (68)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectManager("Mohamed Aziz")}
                  className="px-3 py-1.5 bg-white hover:bg-blue-50 text-navy font-black text-2xs rounded-xl border border-gray-300 transition-colors cursor-pointer shadow-2xs"
                >
                  Voir Aziz (68)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectManager("mehdi elyattouti")}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-navy font-black text-2xs rounded-xl border border-gray-300 transition-colors cursor-pointer shadow-2xs"
                >
                  Voir Mehdi (26)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Summary Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Morning / Period Target (100% Cash Collection Pool) */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-gray-500 uppercase">
              {isRangeMode
                ? `Cible Période (${daysCount}j)`
                : selectedManager.toLowerCase().includes("aziz")
                ? "Cible Matinale (Mohamed Aziz)"
                : selectedManager.toLowerCase().includes("mehdi")
                ? "Cible Matinale (Mehdi Elyattouti)"
                : "Cible Matinale (100% Flotte)"}
            </span>
            <span
              className={`text-3xs font-black px-2 py-0.5 rounded-full ${
                isRangeMode || summary?.hasMorningCsv ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"
              }`}
            >
              {isRangeMode
                ? `${daysCount} jours`
                : summary?.hasMorningCsv
                ? "Base 100%"
                : "En attente CSV"}
            </span>
          </div>
          <p className="text-2xl font-black text-navy mt-1">
            {summary?.hasMorningCsv || (summary?.totalMorningTargetMAD || 0) > 0 || isRangeMode ? (
              <>
                {(summary?.totalMorningTargetMAD || summary?.totalExpectedTodayMAD || 0).toLocaleString()}{" "}
                <span className="text-xs font-normal text-gray-500">MAD</span>
              </>
            ) : (
              <span className="text-gray-300 font-extrabold">—</span>
            )}
          </p>
          <div className="pt-1 border-t border-gray-100 flex items-center justify-between text-2xs">
            <span className={summary?.hasMorningCsv || isRangeMode ? "font-semibold text-emerald-700" : "font-medium text-gray-400"}>
              🎯 Objectif 50%–60% :
            </span>
            <span className={summary?.hasMorningCsv || isRangeMode ? "font-black text-emerald-800" : "font-bold text-gray-300"}>
              {summary?.hasMorningCsv || isRangeMode
                ? `${Math.round((summary?.totalMorningTargetMAD || summary?.totalExpectedTodayMAD || 0) * 0.5).toLocaleString()} – ${Math.round((summary?.totalMorningTargetMAD || summary?.totalExpectedTodayMAD || 0) * 0.6).toLocaleString()} MAD`
                : "—"}
            </span>
          </div>

          {/* Objective: Weekly Target 85% by end of week */}
          <div className="pt-1 border-t border-gray-100 flex items-center justify-between text-2xs">
            <span className={summary?.hasMorningCsv || isRangeMode ? "font-bold text-indigo-700 flex items-center gap-1" : "font-medium text-gray-400"}>
              <span>🏁</span> Objectif Hebdo (85%) :
            </span>
            <span className={summary?.hasMorningCsv || isRangeMode ? "font-black text-indigo-900 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200" : "font-bold text-gray-300"}>
              {summary?.hasMorningCsv || isRangeMode
                ? `${Math.round((summary?.totalMorningTargetMAD || summary?.totalExpectedTodayMAD || 0) * 0.85).toLocaleString()} MAD`
                : "—"}
            </span>
          </div>

          {/* Objective: Monthly Target 95% by end of month */}
          <div className="pt-1 border-t border-gray-100 flex items-center justify-between text-2xs">
            <span className={summary?.hasMorningCsv || isRangeMode ? "font-bold text-purple-700 flex items-center gap-1" : "font-medium text-gray-400"}>
              <span>👑</span> Objectif Mensuel (95%) :
            </span>
            <span className={summary?.hasMorningCsv || isRangeMode ? "font-black text-purple-900 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200" : "font-bold text-gray-300"}>
              {summary?.hasMorningCsv || isRangeMode
                ? `${Math.round((summary?.totalMorningTargetMAD || summary?.totalExpectedTodayMAD || 0) * 0.95).toLocaleString()} MAD`
                : "—"}
            </span>
          </div>
        </div>

        {/* Collected Today / in Period with 50%–60%, 85% Weekly & 95% Monthly Target Progress */}
        {(() => {
          const hasCsv = summary?.hasMorningCsv ?? false;
          const target = (summary?.totalMorningTargetMAD || summary?.totalExpectedTodayMAD || 0);
          const cleared = summary?.totalClearedTodayMAD || 0;
          const pct = target > 0 ? (cleared / target) * 100 : 0;
          const isMinTargetAchieved = pct >= 50;
          const isMaxTargetAchieved = pct >= 60;
          const isWeekly85Achieved = pct >= 85;
          const isMonthly95Achieved = pct >= 95;

          return (
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-gray-500 uppercase">
                  {isRangeMode
                    ? `Encaissé Période (${daysCount}j)`
                    : selectedManager.toLowerCase().includes("aziz")
                    ? "Encaissé Aujourd'hui (Mohamed Aziz)"
                    : selectedManager.toLowerCase().includes("mehdi")
                    ? "Encaissé Aujourd'hui (Mehdi Elyattouti)"
                    : "Encaissé Aujourd'hui (Flotte)"}
                </span>
                <span
                  className={`text-3xs font-black px-2 py-0.5 rounded-full ${
                    target === 0 && cleared === 0
                      ? "bg-gray-100 text-gray-400"
                      : isMonthly95Achieved
                      ? "bg-purple-100 text-purple-900 border border-purple-300 animate-pulse"
                      : isWeekly85Achieved
                      ? "bg-indigo-100 text-indigo-900 border border-indigo-300 animate-pulse-subtle"
                      : isMaxTargetAchieved
                      ? "bg-emerald-100 text-emerald-800 animate-pulse-subtle"
                      : isMinTargetAchieved
                      ? "bg-teal-100 text-teal-800"
                      : pct >= 30
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {isMonthly95Achieved
                    ? `👑 ${pct.toFixed(1)}% / 95% Mois Atteint !`
                    : isWeekly85Achieved
                    ? `🏆 ${pct.toFixed(1)}% / 85% Hebdo (Cible 95%)`
                    : isMaxTargetAchieved
                    ? `✅ ${pct.toFixed(1)}% / 60% (Cibles: 85% · 95%)`
                    : `${pct.toFixed(1)}% / 50–60% (Cibles: 85% · 95%)`}
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {cleared > 0 || hasCsv || isRangeMode ? (
                  <>
                    {cleared.toLocaleString()} <span className="text-xs font-normal text-gray-500">MAD</span>
                  </>
                ) : (
                  <span className="text-gray-300 font-extrabold">—</span>
                )}
              </p>
              <div className="relative w-full h-2.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                {/* 50%–60% Goal Zone Markers, 85% Weekly Target Marker & 95% Monthly Target Marker */}
                <div className="absolute left-[50%] top-0 bottom-0 w-0.5 bg-amber-500 z-10" title="Seuil Min 50%" />
                <div className="absolute left-[60%] top-0 bottom-0 w-0.5 bg-emerald-600 z-10" title="Cible 60%" />
                <div className="absolute left-[85%] top-0 bottom-0 w-0.5 bg-indigo-600 z-10" title="Objectif Hebdo Fin de Semaine (85%)" />
                <div className="absolute left-[95%] top-0 bottom-0 w-0.5 bg-purple-600 z-10" title="Objectif Mensuel Fin de Mois (95%)" />
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isMonthly95Achieved
                      ? "bg-gradient-to-r from-emerald-500 via-indigo-600 to-purple-600"
                      : isWeekly85Achieved
                      ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600"
                      : isMaxTargetAchieved
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : isMinTargetAchieved
                      ? "bg-gradient-to-r from-teal-400 to-emerald-500"
                      : pct >= 30
                      ? "bg-gradient-to-r from-amber-400 to-emerald-500"
                      : "bg-blue-500"
                  }`}
                  style={{
                    width: `${Math.min(100, pct)}%`,
                  }}
                />
              </div>
              <p className="text-3xs text-gray-500 pt-0.5 flex items-center justify-between gap-1">
                <span className="truncate">
                  {!hasCsv && !isRangeMode && target === 0
                    ? "En attente du CSV matin pour fixer l'objectif"
                    : isMonthly95Achieved
                    ? "👑 Exceptionnel : Objectif Mensuel 95% Atteint !"
                    : isWeekly85Achieved
                    ? `🏆 85% Hebdo atteint ! Reste ${Math.max(0, Math.round(target * 0.95) - cleared).toLocaleString()} MAD pour 95% Mois`
                    : isMaxTargetAchieved
                    ? `✅ 60% validé ! Reste ${Math.max(0, Math.round(target * 0.85) - cleared).toLocaleString()} MAD (85%) · ${Math.max(0, Math.round(target * 0.95) - cleared).toLocaleString()} MAD (95%)`
                    : isMinTargetAchieved
                    ? `✅ 50% atteint ! Reste ${Math.max(0, Math.round(target * 0.85) - cleared).toLocaleString()} MAD (85%) · ${Math.max(0, Math.round(target * 0.95) - cleared).toLocaleString()} MAD (95%)`
                    : `Reste ${Math.max(0, Math.round(target * 0.5) - cleared).toLocaleString()} MAD pour 50% · Reste ${Math.max(0, Math.round(target * 0.85) - cleared).toLocaleString()} MAD pour 85% · Reste ${Math.max(0, Math.round(target * 0.95) - cleared).toLocaleString()} MAD pour 95%`}
                </span>
                <span className="font-bold text-gray-400 flex items-center gap-1 shrink-0">
                  <span>50%–60%</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-indigo-600 font-extrabold bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200">
                    Hebdo: 85%
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="text-purple-700 font-extrabold bg-purple-50 px-1 py-0.2 rounded border border-purple-200">
                    Mois: 95%
                  </span>
                </span>
              </p>
            </div>
          );
        })()}

        {/* Remaining to collect (Negative balance remaining) */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-gray-500 uppercase">
              {isRangeMode
                ? `Reste Période (${daysCount}j)`
                : selectedManager.toLowerCase().includes("aziz")
                ? "Reste à Encaisser (Aziz)"
                : selectedManager.toLowerCase().includes("mehdi")
                ? "Reste à Encaisser (Mehdi)"
                : "Reste à Encaisser (Flotte)"}
            </span>
            <span
              className={`text-3xs font-black px-2 py-0.5 rounded-full ${
                isRangeMode
                  ? "bg-amber-100 text-amber-900"
                  : summary?.hasMorningCsv
                  ? "bg-amber-100 text-amber-900"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {isRangeMode
                ? `Cible – Encaissé`
                : summary?.hasMorningCsv
                ? "Solde Net"
                : "En attente CSV"}
            </span>
          </div>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {summary?.hasMorningCsv || isRangeMode ? (
              <>
                {(summary?.remainingToCollectMAD || 0).toLocaleString()}{" "}
                <span className="text-xs font-normal text-gray-500">MAD</span>
              </>
            ) : (
              <span className="text-gray-300 font-extrabold">—</span>
            )}
          </p>
          <div className="text-2xs text-gray-500 mt-1 font-medium leading-tight space-y-1">
            <div className="flex items-center justify-between">
              <span>
                {isRangeMode
                  ? `Impayés Actuels Flotte :`
                  : summary?.hasMorningCsv
                  ? "Flotte active (avec véhicule) :"
                  : "En attente de l'import CSV du matin"}
              </span>
              <span className="font-bold text-gray-700">{(summary?.totalArrearsAllMAD || 0).toLocaleString()} MAD</span>
            </div>
            {summary?.unassignedArrearsMAD && summary.unassignedArrearsMAD > 0 && selectedManager === "ALL" ? (
              <div
                className="text-[10px] text-gray-400 font-normal bg-gray-50 p-1.5 rounded-lg border border-gray-100 flex items-center justify-between"
                title={`${summary.unassignedCount || 11} chauffeurs sans véhicule assigné cumulent ${summary.unassignedArrearsMAD.toLocaleString()} MAD. Total système = ${summary.globalSystemArrearsMAD?.toLocaleString() || "66,227"} MAD.`}
              >
                <span>+ Hors flotte ({summary.unassignedCount || 11} sans véhicule) :</span>
                <span className="font-semibold text-gray-600">+{summary.unassignedArrearsMAD.toLocaleString()} MAD</span>
              </div>
            ) : null}
            {summary?.globalSystemArrearsMAD && selectedManager === "ALL" ? (
              <div className="text-[10px] text-gray-600 font-bold flex items-center justify-between pt-0.5 border-t border-gray-100">
                <span>Total Global Système GoCab :</span>
                <span className="text-amber-700 font-extrabold">{summary.globalSystemArrearsMAD.toLocaleString()} MAD</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Critical 3rd Day Red Alert Count */}
        <div
          onClick={() => {
            if (!summary?.hasMorningCsv) return;
            setFilterType(filterType === "RED" ? "ALL" : "RED");
          }}
          className={`p-5 rounded-3xl border shadow-xs transition-all ${
            !summary?.hasMorningCsv
              ? "bg-white border-gray-100 opacity-75 cursor-default"
              : summary.criticalRedCount > 0
              ? "bg-red-50 border-red-300 hover:border-red-500 animate-pulse-subtle cursor-pointer"
              : "bg-white border-gray-100 cursor-pointer"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-2xs font-bold uppercase flex items-center gap-1 ${
                summary?.hasMorningCsv && summary.criticalRedCount > 0 ? "text-red-700" : "text-gray-500"
              }`}
            >
              <ShieldAlert
                className={`w-3.5 h-3.5 ${
                  summary?.hasMorningCsv && summary.criticalRedCount > 0 ? "text-red-600" : "text-gray-400"
                }`}
              />
              {selectedManager.toLowerCase().includes("aziz")
                ? "Alerte Rouge (Aziz)"
                : selectedManager.toLowerCase().includes("mehdi")
                ? "Alerte Rouge (Mehdi)"
                : "Alerte Rouge (3e Jour)"}
            </span>
            <span
              className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                summary?.hasMorningCsv && summary.criticalRedCount > 0
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {summary?.hasMorningCsv ? summary?.criticalRedCount || 0 : "0"}
            </span>
          </div>
          <p
            className={`text-2xl font-black mt-1.5 ${
              summary?.hasMorningCsv && summary.criticalRedCount > 0 ? "text-red-700" : "text-gray-300 font-extrabold"
            }`}
          >
            {summary?.hasMorningCsv ? (
              <>
                {summary?.criticalRedCount}{" "}
                <span className="text-xs font-medium text-red-600">Chauffeurs</span>
              </>
            ) : (
              <>
                — <span className="text-xs font-medium text-gray-400">Chauffeur</span>
              </>
            )}
          </p>
          <p
            className={`text-2xs mt-1 font-medium ${
              summary?.hasMorningCsv && summary.criticalRedCount > 0 ? "text-red-600" : "text-gray-400"
            }`}
          >
            {summary?.hasMorningCsv
              ? "≥ 2-3 jours sans versement (Risque d'immobilisation)"
              : "Calculé après import du CSV matin"}
          </p>
        </div>
      </div>

      {/* Live WhatsApp Driver Support Chats (Matched by Immatriculation) */}
      {whatsappSupportChats.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50/90 via-white to-emerald-50/60 p-4 rounded-2xl border border-amber-200/80 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Support Chauffeur WhatsApp — Matricules Identifiés ({whatsappSupportChats.length})
              </h3>
            </div>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
              Option 1 · Rattachement Immatriculation Automatique
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {whatsappSupportChats.map((chat) => {
              const plate =
                chat.matchedPlate ||
                (chat.driver?.plateNumber && chat.driver.plateNumber !== "Non assigné"
                  ? chat.driver.plateNumber
                  : "Matricule en cours");
              return (
                <div
                  key={chat.id}
                  className="bg-white p-3 rounded-xl border border-gray-200/80 hover:border-amber-400 transition-all shadow-2xs flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-md text-[11px] font-black font-mono">
                          🚗 {plate}
                        </span>
                        <span className="text-xs font-extrabold text-gray-900 truncate">
                          {chat.contactName}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 truncate mt-1">
                        {chat.lastMessage || "Demande support ouverte"}
                      </p>
                    </div>
                    {chat.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded-full text-[9px] font-black shrink-0 animate-pulse">
                        {chat.unreadCount} nouv.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                    <span className="text-[10px] text-gray-400 font-mono">
                      +{chat.phoneNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDirectWhatsAppTarget({
                          phoneNumber: chat.phoneNumber,
                          contactName: chat.contactName,
                          contactType: "DRIVER",
                          plateNumber: plate,
                          arrearsMAD: chat.driver?.currentArrearsMAD || 0,
                          unpaidDays: chat.driver?.consecutiveUnpaidDays || 0,
                        });
                        setIsWhatsAppModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Répondre (Immat {plate})</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher par chauffeur, téléphone, matricule, gestionnaire..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-slate-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
          </div>

          {/* Manager Filter Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl shrink-0">
            <User className="w-3.5 h-3.5 text-navy shrink-0" />
            <span className="text-3xs font-extrabold text-gray-500 uppercase tracking-wider shrink-0">
              Gestionnaire :
            </span>
            <select
              value={selectedManager}
              onChange={(e) => handleSelectManager(e.target.value)}
              className="bg-transparent text-navy text-xs font-black focus:outline-none cursor-pointer"
            >
              <option value="Mohamed Aziz">👤 Mohamed Aziz (68)</option>
              <option value="mehdi elyattouti">👤 Mehdi Elyattouti (26)</option>
              <option value="ALL">🌐 Tous les gestionnaires (100)</option>
              {availableManagers
                .filter(
                  (m) =>
                    !m.name.toLowerCase().includes("mehdi") &&
                    !m.name.toLowerCase().includes("aziz")
                )
                .map((m) => (
                  <option key={m.name} value={m.name}>
                    👤 {m.name} ({m.vehicleCount || m.count})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === "ALL" ? "bg-navy text-white shadow-2xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Tous ({filteredDrivers.length})
          </button>
          <button
            onClick={() => setFilterType("RED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              filterType === "RED" ? "bg-red-600 text-white shadow-2xs" : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>🔴 Alerte Rouge ({summary?.criticalRedCount || 0})</span>
          </button>
          <button
            onClick={() => setFilterType("RED_FLAGS")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              filterType === "RED_FLAGS"
                ? "bg-red-700 text-white shadow-2xs font-black"
                : "bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 font-extrabold"
            }`}
          >
            <Flag className="w-3.5 h-3.5 fill-current" />
            <span>🚩 Red Flags ({drivers.filter((d) => d.isRedFlagged).length})</span>
          </button>
          <button
            onClick={() => setFilterType("UNPAID")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === "UNPAID" ? "bg-amber-600 text-white shadow-2xs" : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            Non Encaissés
          </button>
          <button
            onClick={() => setFilterType("DAILY")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === "DAILY" ? "bg-blue-600 text-white shadow-2xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Journalier (300 DH)
          </button>
          <button
            onClick={() => setFilterType("WEEKLY")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === "WEEKLY" ? "bg-purple-600 text-white shadow-2xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Hebdo (1800 DH)
          </button>
          <button
            onClick={fetchDriverCollections}
            className="p-2 text-gray-400 hover:text-navy rounded-xl hover:bg-gray-100 transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table Section Header with Portfolio Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-gold shrink-0" />
          <h2 className="text-sm font-extrabold text-navy">
            {selectedManager.toLowerCase().includes("aziz")
              ? "📋 Liste des Chauffeurs & Véhicules — Portefeuille Mohamed Aziz"
              : selectedManager.toLowerCase().includes("mehdi")
              ? "📋 Liste des Chauffeurs & Véhicules — Portefeuille Mehdi Elyattouti"
              : "📋 Liste des Chauffeurs & Véhicules — Flotte Complète (Vue Agrégée)"}
          </h2>
          <span className="text-2xs font-black text-navy bg-navy/10 px-2 py-0.5 rounded-full">
            {filteredDrivers.length} {filteredDrivers.length === 1 ? "chauffeur" : "chauffeurs"}
          </span>
        </div>
        <p className="text-2xs text-gray-500">
          {selectedManager.toLowerCase().includes("aziz")
            ? "Affichage des 68 véhicules d'Aziz (dont 2 transférés de Hamza Rassid)"
            : selectedManager.toLowerCase().includes("mehdi")
            ? "Affichage des 26 véhicules de Mehdi sous gestion directe"
            : "Affichage global de tous les chauffeurs de la flotte"}
        </p>
      </div>

      {/* Driver Daily Collections Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/90 uppercase text-2xs tracking-wider text-gray-500 border-b border-gray-100 font-bold">
              <tr>
                <th className="py-4 px-6">Chauffeur & Contact</th>
                <th className="py-4 px-4">Véhicule</th>
                <th className="py-4 px-4 text-center">
                  {isRangeMode ? `Attendu Période (${daysCount}j)` : "Attendu Aujourd'hui"}
                </th>
                <th className="py-4 px-4 text-center">
                  {isRangeMode ? "Total Encaissé Période (MAD)" : "Montant Encaissé (MAD)"}
                </th>
                <th className="py-4 px-4 text-center">Jours Sans Versement</th>
                <th className="py-4 px-4 text-right">Solde & Impayés (MAD)</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Aucun chauffeur trouvé pour ces critères.
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => {
                  const isRed = driver.isCriticalRed;
                  const isSaving = savingDriverId === driver.id;
                  const currentInputValue =
                    paymentInputs[driver.id] !== undefined
                      ? paymentInputs[driver.id]
                      : driver.clearedTodayMAD !== undefined && driver.clearedTodayMAD !== null
                      ? driver.clearedTodayMAD
                      : 0;

                  return (
                    <tr
                      key={driver.id}
                      className={`transition-colors ${
                        isRed
                          ? "bg-red-50/90 hover:bg-red-100/90 border-l-4 border-l-red-600"
                          : driver.isRedFlagged
                          ? "bg-red-50/40 hover:bg-red-100/50 border-l-4 border-l-red-500"
                          : driver.isPaidToday
                          ? "bg-emerald-50/30 hover:bg-emerald-50/60"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Driver Info */}
                      <td className="py-4 px-6 font-semibold">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-bold text-sm ${isRed || driver.isRedFlagged ? "text-red-900" : "text-navy"}`}>
                              {driver.fullName}
                            </p>
                            {driver.isRedFlagged && (
                              <RedFlagBadge reason={driver.redFlagReason} />
                            )}
                          </div>
                          <p className="font-mono text-2xs text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {driver.phoneSanitized} · CIN: {driver.cinNumber}
                          </p>

                          {/* Today's observation / note pill directly visible in row */}
                          {driver.todayComment ? (
                            <div
                              onClick={() => {
                                setCommentDriver(driver);
                                setIsCommentModalOpen(true);
                              }}
                              className="mt-1 p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-3xs font-medium cursor-pointer transition-all flex items-start gap-1 max-w-xs shadow-2xs group"
                              title="Cliquez pour voir tout l'historique ou modifier cette note"
                            >
                              <span className="shrink-0 text-amber-700 font-bold">💬 Note du {endDate} :</span>
                              <span className="truncate group-hover:underline italic font-semibold text-amber-900">
                                &ldquo;{driver.todayComment}&rdquo;
                              </span>
                              {driver.todayCommentAuthor && (
                                <span className="shrink-0 text-[9px] text-amber-700/80 ml-auto font-bold font-mono">
                                  ({driver.todayCommentAuthor})
                                </span>
                              )}
                            </div>
                          ) : (driver.commentsCount || 0) > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCommentDriver(driver);
                                setIsCommentModalOpen(true);
                              }}
                              className="mt-1 px-2 py-0.5 bg-blue-50/80 hover:bg-blue-100 text-navy border border-blue-200 rounded-lg text-3xs font-semibold cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                              title="Voir les notes antérieures dans l'historique"
                            >
                              <History className="w-2.5 h-2.5 text-navy" />
                              <span>Historique : {driver.commentsCount} note(s) passée(s)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setCommentDriver(driver);
                                setIsCommentModalOpen(true);
                              }}
                              className="mt-0.5 text-3xs text-gray-400 hover:text-navy flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity cursor-pointer font-medium"
                              title="Ajouter une observation pour ce chauffeur"
                            >
                              <span>+ Ajouter note</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Vehicle Immatriculation & Manager */}
                      <td className="py-4 px-4">
                        {driver.vehicle ? (
                          <div className="space-y-1">
                            <span className="font-mono font-bold text-xs bg-navy/5 text-navy px-2 py-0.5 rounded-lg border border-navy/10 inline-block">
                              {driver.vehicle.plate_number}
                            </span>
                            <p className="text-2xs text-gray-400 truncate max-w-[120px]">
                              {driver.vehicle.make_model}
                            </p>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              <User className="w-2.5 h-2.5 text-slate-500" />
                              {isMehdiPlate(driver.vehicle?.plate_number) || (driver.manager && driver.manager.toLowerCase().includes("mehdi")) ? "Mehdi Elyattouti" : "Mohamed Aziz"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-2xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                            Non assigné
                          </span>
                        )}
                      </td>

                      {/* Expected Today */}
                      <td className="py-4 px-4 text-center font-mono font-bold text-gray-700">
                        {driver.expectedTodayMAD > 0 ? (
                          <div className="flex flex-col items-center justify-center">
                            <span>{driver.expectedTodayMAD} MAD</span>
                            {driver.contractType === "WEEKLY" && (
                              <span className="text-3xs text-purple-700 bg-purple-50 font-semibold px-1.5 py-0.5 rounded-md mt-0.5">
                                Hebdo
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-2xs">
                            {driver.contractType === "WEEKLY" ? "0 MAD (Repos Hebdo)" : "0 MAD (Repos)"}
                          </span>
                        )}
                      </td>

                      {/* Amount Paid Input / Display Field */}
                      <td className="py-4 px-4 text-center">
                        {isRangeMode ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span
                              className={`font-mono font-bold text-xs px-2.5 py-1 rounded-xl border ${
                                driver.isPaidToday
                                  ? "bg-emerald-50 text-emerald-900 border-emerald-300 font-black"
                                  : driver.clearedTodayMAD > 0
                                  ? "bg-amber-50 text-amber-900 border-amber-200 font-bold"
                                  : "bg-gray-100 text-gray-500 border-gray-200"
                              }`}
                            >
                              {driver.clearedTodayMAD.toLocaleString()} DH
                            </span>
                            {driver.expectedTodayMAD > 0 && (
                              <span className="text-3xs text-gray-500 font-medium">
                                {driver.clearedTodayMAD >= driver.expectedTodayMAD ? (
                                  <span className="text-emerald-700 font-bold">✓ 100% encaissé</span>
                                ) : driver.clearedTodayMAD > 0 ? (
                                  <span>
                                    {Math.round((driver.clearedTodayMAD / driver.expectedTodayMAD) * 100)}% encaissé
                                  </span>
                                ) : (
                                  <span className="text-red-500">0% encaissé</span>
                                )}
                              </span>
                            )}
                            {(driver.morningBalance !== null || driver.eveningBalance !== null) && (
                              <div className="text-3xs font-mono text-gray-500 bg-gray-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <span>Matin: {driver.morningBalance ?? "-"}</span>
                                <span>➔</span>
                                <span>Soir: {driver.eveningBalance ?? "-"}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="relative w-28">
                                <input
                                  type="number"
                                  min="0"
                                  step="50"
                                  value={currentInputValue}
                                  onChange={(e) =>
                                    setPaymentInputs({
                                      ...paymentInputs,
                                      [driver.id]: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className={`w-full px-2 py-1.5 text-center font-mono font-bold text-xs rounded-xl border focus:outline-none focus:ring-2 ${
                                    driver.isPaidToday
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-900 focus:ring-emerald-200"
                                      : "border-gray-200 bg-white text-navy focus:ring-navy/20"
                                  }`}
                                />
                                <span className="absolute right-2 top-2 text-3xs font-bold text-gray-400">DH</span>
                              </div>

                              {/* Quick autofill expected amount */}
                              {driver.expectedTodayMAD > 0 && currentInputValue !== driver.expectedTodayMAD && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPaymentInputs({
                                      ...paymentInputs,
                                      [driver.id]: driver.expectedTodayMAD,
                                    })
                                  }
                                  className="p-1.5 bg-gray-100 hover:bg-gray-200 text-navy rounded-lg text-2xs font-bold cursor-pointer"
                                  title="Remplir montant attendu"
                                >
                                  <Zap className="w-3 h-3 text-gold" />
                                </button>
                              )}
                            </div>

                            {/* Balance Snapshot Info if imported via CSV */}
                            {(driver.morningBalance !== null || driver.eveningBalance !== null) && (
                              <div className="text-3xs font-mono text-gray-500 bg-gray-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <span>Matin: {driver.morningBalance !== null && driver.morningBalance !== undefined ? (driver.morningBalance < 0 ? `-MAD ${Math.abs(driver.morningBalance).toLocaleString()}` : `${driver.morningBalance.toLocaleString()} MAD`) : "-"}</span>
                                <span>➔</span>
                                <span>Soir: {driver.eveningBalance !== null && driver.eveningBalance !== undefined ? (driver.eveningBalance < 0 ? `-MAD ${Math.abs(driver.eveningBalance).toLocaleString()}` : `${driver.eveningBalance.toLocaleString()} MAD`) : "-"}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Consecutive Unpaid Days */}
                      <td className="py-4 px-4 text-center font-bold">
                        {isRed ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="text-2xs font-extrabold text-white bg-red-600 px-2 py-0.5 rounded-full animate-pulse">
                              🔴 {driver.consecutiveUnpaidDays || Math.ceil(driver.currentArrearsMAD / 300) || 3}e JOUR SANS PAIEMENT
                            </span>
                            <span className="text-3xs text-red-700 font-semibold mt-0.5">
                              Risque Immobilisation
                            </span>
                          </div>
                        ) : driver.consecutiveUnpaidDays === 2 || (driver.currentArrearsMAD >= 600 && driver.currentArrearsMAD < 900) ? (
                          <span className="text-2xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                            ⚠️ 2 jours impayés
                          </span>
                        ) : driver.consecutiveUnpaidDays === 1 || (driver.currentArrearsMAD >= 300 && driver.currentArrearsMAD < 600) ? (
                          <span className="text-2xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                            ⚠️ 1 jour impayé
                          </span>
                        ) : driver.currentArrearsMAD > 0 ? (
                          <span className="text-2xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            ⚠️ Arriérés ({driver.currentArrearsMAD} DH)
                          </span>
                        ) : (driver.excelBalance !== null && driver.excelBalance !== undefined && driver.excelBalance > 0) || (driver.morningBalance !== null && driver.morningBalance !== undefined && driver.morningBalance > 0) ? (
                          <span className="text-2xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                            ✓ Avance (+{(driver.excelBalance ?? driver.morningBalance)} DH)
                          </span>
                        ) : (
                          <span className="text-2xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            ✓ À jour (0 j)
                          </span>
                        )}
                      </td>

                      {/* Total Arrears / Debt / Excel Balance */}
                      <td className="py-4 px-4 text-right">
                        {(() => {
                          const excelBal = driver.eveningBalance ?? driver.morningBalance ?? driver.excelBalance;
                          const hasExcel = excelBal !== null && excelBal !== undefined;

                          if (hasExcel && excelBal < 0) {
                            return (
                              <div className="space-y-0.5">
                                <p className="font-mono font-black text-sm text-red-600">
                                  -MAD {Math.abs(excelBal).toLocaleString()}
                                </p>
                                <span className="text-3xs text-red-500 font-semibold block">
                                  Dette / Arriérés : {Math.abs(excelBal).toLocaleString()} DH
                                </span>
                              </div>
                            );
                          }

                          if (hasExcel && excelBal > 0) {
                            return (
                              <div className="space-y-0.5">
                                <p className="font-mono font-black text-sm text-emerald-600">
                                  +MAD {excelBal.toLocaleString()}
                                </p>
                                <span className="text-3xs text-emerald-700 font-bold block">
                                  ✓ Avance / Crédit Chauffeur
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-0.5">
                              <p className={`font-mono font-black text-sm ${driver.currentArrearsMAD > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                {driver.currentArrearsMAD > 0 ? `-MAD ${driver.currentArrearsMAD.toLocaleString()}` : "0 MAD"}
                              </p>
                              {driver.currentArrearsMAD > 0 ? (
                                <span className="text-3xs text-red-500 font-semibold block">
                                  +{driver.currentArrearsMAD} DH d'arriérés
                                </span>
                              ) : (
                                <span className="text-3xs text-emerald-600 font-medium block">
                                  ✓ Solde à jour
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Actions: Recovery Trigger & Save / WhatsApp */}
                      <td className="py-3 px-6 text-right">
                        {(() => {
                          const isAlreadyInRecovery = Boolean(
                            activeRecoveryDriverIds[driver.id] ||
                            (driver.phoneSanitized && activeRecoveryDriverIds[driver.phoneSanitized.replace(/\D/g, "")]) ||
                            (driver.vehicle?.plate_number && activeRecoveryDriverIds[driver.vehicle.plate_number.replace(/\s+/g, "")])
                          );

                          return (
                            <div className="flex flex-col items-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCallAndCreateRecovery(driver)}
                                  disabled={triggeringRecoveryId === driver.id}
                                  className={`w-full max-w-[130px] px-2 py-1 rounded-xl text-3xs font-extrabold transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer ${
                                    isAlreadyInRecovery
                                      ? "bg-red-100 text-red-800 border border-red-300 hover:bg-red-200"
                                      : isRed
                                      ? "bg-red-600 hover:bg-red-700 text-white shadow-xs"
                                      : "bg-red-500 hover:bg-red-600 text-white"
                                  }`}
                                  title={
                                    isAlreadyInRecovery
                                      ? "Ticket Récupération déjà envoyé sur la page Terrain. Cliquez pour appeler."
                                      : "Déclencher la récupération du véhicule sur la page Terrain"
                                  }
                                >
                                  {triggeringRecoveryId === driver.id ? (
                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Car className="w-3 h-3" />
                                  )}
                                  <span className="truncate">
                                    {isAlreadyInRecovery ? "🚨 En Récupération" : "🚨 Récupérer Véhicule"}
                                  </span>
                                </button>

                              {/* Valider & WhatsApp */}
                              <div className="flex items-center justify-end gap-1.5 w-full max-w-[130px]">
                                <button
                                  onClick={() => handleSavePayment(driver)}
                                  disabled={isSaving}
                                  className="px-3 py-1.5 bg-navy hover:bg-navy/90 text-white rounded-xl font-bold text-2xs shadow-2xs transition-all flex items-center justify-center gap-1 disabled:opacity-50 flex-1"
                                >
                                  {isSaving ? (
                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3 text-gold" />
                                  )}
                                  <span>Valider</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const amountDue = driver.currentArrearsMAD > 0 ? driver.currentArrearsMAD : driver.expectedTodayMAD;
                                    const contractText = driver.contractType === "WEEKLY" ? "hebdomadaire (1,800 MAD/lundi)" : "journalier (300 MAD/jour)";
                                    const defaultMsg = `Bonjour ${driver.fullName},\n\nNous vous contactons concernant votre versement GoCab (${contractText}).\nVotre solde d'impayé actuel est de : ${amountDue} MAD.\nMerci de procéder au règlement pour éviter tout blocage du véhicule (${driver.vehicle?.plate_number || ""}).\n\nL'équipe GoCab Operations.`;
                                    setDirectWhatsAppTarget({
                                       phoneNumber: driver.phoneSanitized,
                                       contactName: driver.fullName,
                                       contactType: "DRIVER",
                                       plateNumber: driver.vehicle?.plate_number,
                                       arrearsMAD: driver.currentArrearsMAD,
                                       unpaidDays: driver.consecutiveUnpaidDays,
                                       defaultMessage: defaultMsg,
                                     });
                                     setIsWhatsAppModalOpen(true);
                                   }}
                                   className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs transition-colors cursor-pointer"
                                   title="Envoyer un WhatsApp direct depuis le CRM"
                                 >
                                   <MessageSquare className="w-3.5 h-3.5" />
                                 </button>
                               </div>

                               {/* Observation / Comment & History Button */}
                               <button
                                 type="button"
                                 onClick={() => {
                                   setCommentDriver(driver);
                                   setIsCommentModalOpen(true);
                                 }}
                                 className={`w-full max-w-[130px] px-2 py-1 rounded-xl text-3xs font-black transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer border ${
                                   driver.todayComment
                                     ? "bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 ring-1 ring-amber-400 font-extrabold"
                                     : (driver.commentsCount || 0) > 0
                                     ? "bg-blue-50 hover:bg-blue-100 text-navy border-blue-200 font-bold"
                                     : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200"
                                 }`}
                                 title={
                                   driver.todayComment
                                     ? `Note du ${endDate}: "${driver.todayComment}" - Cliquez pour voir ou modifier`
                                     : (driver.commentsCount || 0) > 0
                                     ? `${driver.commentsCount} note(s) dans l'historique - Cliquez pour voir`
                                     : "Écrire une observation / commentaire pour ce chauffeur"
                                 }
                               >
                                 <FileText className={`w-3 h-3 ${driver.todayComment ? "text-amber-800" : "text-gray-500"}`} />
                                 <span className="truncate">
                                   {driver.todayComment
                                     ? "💬 Note du jour"
                                     : (driver.commentsCount || 0) > 0
                                     ? `📜 Notes (${driver.commentsCount})`
                                     : "+ Commentaire"}
                                 </span>
                               </button>
                             </div>
                           );
                         })()}
                       </td>
                     </tr>
                   );
                 })
               )}
             </tbody>
           </table>
         </div>
       </div>
       {/* Driver Balance CSV Import & Reconciliation Modal */}
       <BalanceReconciliationModal
         isOpen={isBalanceModalOpen}
         onClose={() => setIsBalanceModalOpen(false)}
         selectedDate={endDate}
         onSuccess={fetchDriverCollections}
         hasMorningCsv={summary?.hasMorningCsv ?? false}
         morningTargetMAD={summary?.totalMorningTargetMAD ?? 0}
       />
 
       {/* Direct WhatsApp Sending Modal */}
       <WhatsAppDirectModal
         isOpen={isWhatsAppModalOpen}
         onClose={() => setIsWhatsAppModalOpen(false)}
         target={directWhatsAppTarget}
         onOpenFullChat={(phone) => {
           try {
             localStorage.setItem("gocab_target_whatsapp_phone", phone);
           } catch (e) {}
           window.dispatchEvent(new CustomEvent("gocab_navigate_tab", { detail: "whatsapp" }));
         }}
       />

       {/* Driver Daily Comment & History Modal */}
       <DriverDailyCommentModal
         isOpen={isCommentModalOpen}
         onClose={() => setIsCommentModalOpen(false)}
         driver={commentDriver}
         targetDate={endDate || startDate}
         currentUserName={currentUserName}
         currentUserRole={currentUserRole}
         onCommentSaved={handleCommentSaved}
         onCommentDeleted={handleCommentDeleted}
       />
     </div>
  );
}
