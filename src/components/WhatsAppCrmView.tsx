"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  MessageCircle,
  Search,
  Send,
  Phone,
  Plus,
  RefreshCw,
  Check,
  AlertTriangle,
  User,
  Car,
  FileText,
  Clock,
  ChevronRight,
  ChevronDown,
  X,
  Zap,
  Sparkles,
  ShieldCheck,
  Copy,
  Info,
  ExternalLink,
  Camera,
  Image as ImageIcon,
  Maximize2,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Paperclip,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  GOCAB_WHATSAPP_TEMPLATES,
  formatDisplayPhone,
  normalizeWhatsAppPhone,
} from "@/lib/whatsapp";

interface DriverSummary {
  id: string;
  fullName: string;
  cin: string;
  contractType: string;
  currentArrearsMAD: number;
  consecutiveUnpaidDays: number;
  defaultStage: string;
  plateNumber: string;
  vehicleModel: string;
}

interface LeadSummary {
  id: string;
  name: string;
  boardColumn: string;
  city: string;
  hasCin: boolean;
  hasPermis: boolean;
  trainingStatus?: string | null;
  presenceConfirmed?: boolean;
  notes?: string | null;
}

interface ConversationItem {
  id: string;
  phoneNumber: string;
  contactName: string;
  contactType: "DRIVER" | "LEAD" | "UNKNOWN";
  workflowState?: string;
  routedDepartment?: "FLEET_SUPPORT" | "LEAD_ACQUISITION" | null;
  matchedPlate?: string | null;
  matchedVehicleId?: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isPinned: boolean;
  driver: DriverSummary | null;
  lead: LeadSummary | null;
}

interface MessageItem {
  id: string;
  conversation_id: string;
  direction: "INBOUND" | "OUTBOUND";
  sender_type: "AGENT" | "CONTACT" | "SYSTEM";
  sender_name: string | null;
  text: string;
  status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  error_message?: string | null;
  created_at: string;
  media_url?: string | null;
}

function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/api/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  return `/api/whatsapp/media/${encodeURIComponent(trimmed)}`;
}

export default function WhatsAppCrmView() {
  const { data: session } = useSession();
  const userRole = ((session?.user as any)?.role || "").toUpperCase();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [filter, setFilter] = useState<
    "ALL" | "FLEET_SUPPORT" | "LEAD_ACQUISITION" | "DRIVERS" | "LEADS" | "ARREARS" | "UNREAD"
  >("ALL");
  const [restrictedQueue, setRestrictedQueue] = useState<"FLEET_SUPPORT" | "LEAD_ACQUISITION" | null>(null);
  const [fleetSupportCount, setFleetSupportCount] = useState(0);
  const [leadAcquisitionCount, setLeadAcquisitionCount] = useState(0);

  const isFleetSupportOnly =
    userRole === "FLEET_PERF_MANAGER" || restrictedQueue === "FLEET_SUPPORT";
  const isLeadAcquisitionOnly =
    userRole === "LEAD_ACQUISITION_JR" ||
    userRole === "BRAND_MANAGER" ||
    restrictedQueue === "LEAD_ACQUISITION";
  const [searchQuery, setSearchQuery] = useState("");
  const [inputMessage, setInputMessage] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showImmatModal, setShowImmatModal] = useState(false);
  const [manualImmatInput, setManualImmatInput] = useState("");
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [showRightDossier, setShowRightDossier] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [simulateText, setSimulateText] = useState("");
  const [apiConfig, setApiConfig] = useState<any>(null);

  // Photo Lightbox & Upload states
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string } | null>(null);
  const [lightboxScale, setLightboxScale] = useState(1);
  const [lightboxRotation, setLightboxRotation] = useState(0);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active selected conversation object
  const activeConversation = conversations.find((c) => c.id === selectedConvId) || null;

  // 24-hour Meta Customer Service Window evaluation
  const lastInboundMsg = [...messages].reverse().find((m) => m.direction === "INBOUND");
  const is24hWindowOpen = lastInboundMsg
    ? Date.now() - new Date(lastInboundMsg.created_at).getTime() < 24 * 60 * 60 * 1000
    : false;
  const hours24hRemaining = lastInboundMsg && is24hWindowOpen
    ? Math.max(0, Math.floor((24 * 60 * 60 * 1000 - (Date.now() - new Date(lastInboundMsg.created_at).getTime())) / (1000 * 60 * 60)))
    : 0;

  // Auto scroll chat to bottom
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch API Config status
  useEffect(() => {
    fetch("/api/whatsapp/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.config) setApiConfig(data.config);
      })
      .catch(() => {});
  }, []);

  // Check for target phone or filter requested from Fleet Performance / Lead Drawer
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const targetPhone = localStorage.getItem("gocab_target_whatsapp_phone");
      if (targetPhone) {
        setSearchQuery(targetPhone);
        localStorage.removeItem("gocab_target_whatsapp_phone");
      }
      const targetFilter = localStorage.getItem("gocab_target_whatsapp_filter");
      if (targetFilter === "FLEET_SUPPORT" || targetFilter === "LEAD_ACQUISITION") {
        setFilter(targetFilter);
        localStorage.removeItem("gocab_target_whatsapp_filter");
      }
    } catch (e) {}
  }, []);

  // Fetch conversations list
  const fetchConversations = useCallback(
    async (preserveSelection = true) => {
      try {
        const queryParams = new URLSearchParams();
        if (filter !== "ALL") queryParams.set("filter", filter);
        if (searchQuery.trim()) queryParams.set("search", searchQuery.trim());

        const res = await fetch(`/api/whatsapp/conversations?${queryParams.toString()}`);
        if (!res.ok) throw new Error("Erreur de chargement");
        const data = await res.json();

        const list: ConversationItem[] = data.conversations || [];
        setConversations(list);
        if (data.restrictedQueue !== undefined) {
          setRestrictedQueue(data.restrictedQueue);
        }
        if (typeof data.fleetSupportCount === "number") {
          setFleetSupportCount(data.fleetSupportCount);
        }
        if (typeof data.leadAcquisitionCount === "number") {
          setLeadAcquisitionCount(data.leadAcquisitionCount);
        }

        // If no conversation is selected or selected conversation is not in list, pick the first one
        const stillInList = selectedConvId && list.some((c) => c.id === selectedConvId);
        if (!preserveSelection || !stillInList) {
          setSelectedConvId(list.length > 0 ? list[0].id : null);
        }
      } catch (err: any) {
        console.error("Failed to load WhatsApp conversations", err);
      } finally {
        setIsLoadingList(false);
      }
    },
    [filter, searchQuery, selectedConvId]
  );

  useEffect(() => {
    fetchConversations(false);
  }, [filter, searchQuery]);

  // Periodic refresh for conversations & unread count
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true);
    }, 7000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Fetch message thread when selectedConvId changes
  const fetchMessages = useCallback(async (convId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/whatsapp/messages?conversationId=${convId}`);
      if (!res.ok) throw new Error("Erreur messages");
      const data = await res.json();
      setMessages(data.messages || []);
      // Reset unread count locally for responsive UX
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
    } else {
      setMessages([]);
    }
  }, [selectedConvId, fetchMessages]);

  // Polling active thread messages every 5 seconds
  useEffect(() => {
    if (!selectedConvId) return;
    const interval = setInterval(() => {
      fetch(`/api/whatsapp/messages?conversationId=${selectedConvId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages && data.messages.length !== messages.length) {
            setMessages(data.messages);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedConvId, messages.length]);

  // Escape key listener to close Lightbox modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Photo handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image valide (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error("L'image dépasse la limite autorisée de 16 Mo");
      return;
    }
    setSelectedPhotoFile(file);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const clearSelectedPhoto = () => {
    setSelectedPhotoFile(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          setSelectedPhotoFile(file);
          if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
          setPhotoPreviewUrl(URL.createObjectURL(file));
          toast.success("Photo collée depuis le presse-papier !", { icon: "📋" });
          break;
        }
      }
    }
  };

  // Send Message handler (Text + Optional Photo)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputMessage.trim() && !selectedPhotoFile) || !activeConversation || isSending) return;

    const messageText = inputMessage.trim();
    const photoToUpload = selectedPhotoFile;
    const previewToClean = photoPreviewUrl;

    setInputMessage("");
    clearSelectedPhoto();
    setIsSending(true);

    let uploadedMediaUrl: string | null = null;
    if (photoToUpload) {
      try {
        const formData = new FormData();
        formData.append("file", photoToUpload);
        const uploadRes = await fetch("/api/whatsapp/media/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.mediaUrl) {
          uploadedMediaUrl = uploadData.mediaUrl;
        } else {
          throw new Error(uploadData.error || "Échec du téléversement de l'image");
        }
      } catch (err: any) {
        toast.error(`Erreur image: ${err.message || "Impossible de téléverser l'image"}`);
        setIsSending(false);
        setSelectedPhotoFile(photoToUpload);
        setPhotoPreviewUrl(previewToClean);
        return;
      }
    }

    // Optimistic UI message insertion
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MessageItem = {
      id: tempId,
      conversation_id: activeConversation.id,
      direction: "OUTBOUND",
      sender_type: "AGENT",
      sender_name: "GoCab Operations",
      text: messageText || (uploadedMediaUrl ? "📷 Photo" : ""),
      media_url: uploadedMediaUrl,
      status: "PENDING",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          phoneNumber: activeConversation.phoneNumber,
          text: messageText,
          mediaUrl: uploadedMediaUrl || undefined,
          mediaType: uploadedMediaUrl ? "image" : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.message?.status !== "FAILED") {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (data.message as MessageItem) : m))
        );
        fetchConversations(true);
        toast.success("✓ Message WhatsApp transmis avec succès !", { icon: "🚀" });
      } else {
        const errorDetail =
          data.apiError ||
          data.error ||
          data.message?.error_message ||
          "Échec de remise par l'API WhatsApp (Vérifiez la fenêtre 24h)";
        const is401 = errorDetail.includes("401");
        toast.error(
          is401
            ? "⚠️ Clé API 360dialog non autorisée (HTTP 401). Rendez-vous dans Paramètres pour renseigner la clé générée sur app.360dialog.com"
            : `⚠️ Échec d'envoi: ${errorDetail}`,
          { duration: 7000 }
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...(data.message || m),
                  status: "FAILED",
                  error_message: errorDetail,
                }
              : m
          )
        );
      }
    } catch (err: any) {
      const errMsg = err.message || "Erreur réseau";
      toast.error(`Erreur: ${errMsg}`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "FAILED", error_message: errMsg } : m
        )
      );
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  // Quick Template insertion with token interpolation
  const handleApplyTemplate = (tpl: (typeof GOCAB_WHATSAPP_TEMPLATES)[0]) => {
    if (!activeConversation) return;

    let text = tpl.text;
    const name = activeConversation.contactName || "Chauffeur";
    const arrears = activeConversation.driver?.currentArrearsMAD?.toLocaleString() || "0";
    const plate = activeConversation.driver?.plateNumber || "véhicule GoCab";
    const date = new Date(Date.now() + 86400000).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    text = text.replace(/{{name}}/g, name);
    text = text.replace(/{{arrears}}/g, arrears);
    text = text.replace(/{{plate}}/g, plate);
    text = text.replace(/{{date}}/g, date);

    setInputMessage(text);
    setShowTemplatesDropdown(false);
    toast.success(`Modèle "${tpl.title}" appliqué`, { icon: "✨" });
    textareaRef.current?.focus();
  };

  // Send the 2-option Welcome Menu (1: Driver Support / 2: Getting Info) to active contact
  const handleSendWelcomeMenu = async () => {
    if (!activeConversation) return;
    try {
      const res = await fetch("/api/whatsapp/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_welcome_menu",
          conversationId: activeConversation.id,
          phoneNumber: activeConversation.phoneNumber,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("🤖 Menu interactif (1: Support / 2: Infos) envoyé sur WhatsApp !");
        fetchMessages(activeConversation.id);
        fetchConversations(true);
      } else {
        toast.error(data.error || "Erreur lors de l'envoi du menu");
      }
    } catch (e) {
      toast.error("Erreur réseau");
    }
  };

  // Manually match / assign a vehicle immatriculation to route to Fleet Performance Support
  const handleMatchImmat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConversation || !manualImmatInput.trim()) return;
    try {
      const res = await fetch("/api/whatsapp/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "match_immat",
          conversationId: activeConversation.id,
          immat: manualImmatInput.trim(),
          sendBotReply: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          data.vehicle
            ? `✅ Véhicule ${data.matchedPlate} (${data.vehicle.make_model}) identifié et transféré au Support Flotte !`
            : `✅ Matricule ${data.matchedPlate} enregistré et transféré au Support Flotte !`
        );
        setShowImmatModal(false);
        setManualImmatInput("");
        fetchMessages(activeConversation.id);
        fetchConversations(true);
      } else {
        toast.error(data.error || "Impossible d'associer le matricule");
      }
    } catch (e) {
      toast.error("Erreur réseau");
    }
  };

  // Manually route conversation to Lead Acquisition
  const handleRouteLeadAcquisition = async () => {
    if (!activeConversation) return;
    try {
      const res = await fetch("/api/whatsapp/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "route_lead_acquisition",
          conversationId: activeConversation.id,
          contactName: activeConversation.contactName,
          sendBotReply: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("🎯 Conversation transférée à Lead Acquisition (Fiche Prospect créée) !");
        fetchMessages(activeConversation.id);
        fetchConversations(true);
      } else {
        toast.error(data.error || "Erreur de transfert");
      }
    } catch (e) {
      toast.error("Erreur réseau");
    }
  };

  // Toggle Bot Pause / Human mode
  const handleToggleBot = async () => {
    if (!activeConversation) return;
    try {
      const res = await fetch("/api/whatsapp/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_bot",
          conversationId: activeConversation.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          data.isBotPaused
            ? "⏸️ Bot mis en pause (Mode Humain activé) !"
            : "🤖 Bot réactivé pour cette discussion !"
        );
        fetchConversations(true);
      } else {
        toast.error(data.error || "Erreur de basculement du bot");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  // Simulate incoming driver response
  const handleSimulateInbound = async (textToSimulate: string) => {
    if (!activeConversation) return;
    try {
      const res = await fetch("/api/whatsapp/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromPhone: activeConversation.phoneNumber,
          contactName: activeConversation.contactName,
          text: textToSimulate,
        }),
      });

      if (res.ok) {
        toast.success("Réponse entrante simulée avec succès !", { icon: "📥" });
        setShowSimulateModal(false);
        setSimulateText("");
        fetchMessages(activeConversation.id);
        fetchConversations(true);
      } else {
        toast.error("Échec de simulation");
      }
    } catch (e) {
      toast.error("Erreur réseau");
    }
  };

  // Start new conversation
  const handleCreateNewConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatPhone.trim()) return;

    try {
      const res = await fetch("/api/whatsapp/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: newChatPhone.trim(),
          contactName: newChatName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.conversation) {
        toast.success("Nouvelle conversation créée");
        setShowNewChatModal(false);
        setNewChatPhone("");
        setNewChatName("");
        await fetchConversations(false);
        setSelectedConvId(data.conversation.id);
      } else {
        toast.error(data.error || "Impossible d'initier la conversation");
      }
    } catch (e) {
      toast.error("Erreur réseau");
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-xl min-h-[calc(100vh-8.5rem)] max-h-[calc(100vh-8.5rem)]">
      {/* ======================================================== */}
      {/* 1. LEFT PANE: CONVERSATION LIST & SEARCH & FILTERS       */}
      {/* ======================================================== */}
      <div className="w-72 md:w-80 lg:w-88 flex flex-col border-r border-gray-200/80 bg-white shrink-0">
        {/* Header */}
        <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20 shrink-0">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-black text-gray-900 tracking-tight truncate">
                  WhatsApp CRM
                </h2>
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0"
                  title="Numéro officiel vérifié sur Meta Business & 360dialog (+212 6 62 14 51 09)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium truncate">+212 6 62 14 51 09 · GoCab</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => fetchConversations(true)}
              title="Rafraîchir les conversations"
              className="p-1.5 rounded-xl text-gray-500 hover:text-navy hover:bg-gray-100 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowNewChatModal(true)}
              title="Nouvelle conversation"
              className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-2.5 border-b border-gray-100 bg-white">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher nom, tél, matricule..."
              className="w-full pl-8 pr-7 py-1.5 bg-gray-100/80 hover:bg-gray-100 focus:bg-white text-xs text-slate-900 placeholder:text-gray-400 rounded-xl border border-transparent focus:border-emerald-500 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Workflow Routing Queues + Filter Chips */}
          {isFleetSupportOnly ? (
            <div className="mt-2">
              <button
                onClick={() => setFilter("FLEET_SUPPORT")}
                className="w-full px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-between transition-all cursor-pointer border bg-amber-600 text-white border-amber-700 shadow-xs"
                title="File dédiée : Support Performance Flotte"
              >
                <span className="truncate">1️⃣ Support Flotte (File dédiée)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-white text-amber-800">
                  {fleetSupportCount}
                </span>
              </button>
            </div>
          ) : isLeadAcquisitionOnly ? (
            <div className="mt-2">
              <button
                onClick={() => setFilter("LEAD_ACQUISITION")}
                className="w-full px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-between transition-all cursor-pointer border bg-blue-600 text-white border-blue-700 shadow-xs"
                title="File dédiée : Lead Acquisition"
              >
                <span className="truncate">2️⃣ Lead Acquisition (File dédiée)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-white text-blue-800">
                  {leadAcquisitionCount}
                </span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <button
                onClick={() => setFilter(filter === "FLEET_SUPPORT" ? "ALL" : "FLEET_SUPPORT")}
                className={`px-2 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-between transition-all cursor-pointer border ${
                  filter === "FLEET_SUPPORT"
                    ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                    : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                }`}
                title="Option 1 : Chauffeurs ayant saisi leur immatriculation pour le Support Performance Flotte"
              >
                <span className="truncate">1️⃣ Support Flotte</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                    filter === "FLEET_SUPPORT"
                      ? "bg-white text-amber-800"
                      : "bg-amber-200/80 text-amber-950"
                  }`}
                >
                  {fleetSupportCount}
                </span>
              </button>

              <button
                onClick={() => setFilter(filter === "LEAD_ACQUISITION" ? "ALL" : "LEAD_ACQUISITION")}
                className={`px-2 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-between transition-all cursor-pointer border ${
                  filter === "LEAD_ACQUISITION"
                    ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                    : "bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100"
                }`}
                title="Option 2 : Prospects demandant des informations (Lead Acquisition)"
              >
                <span className="truncate">2️⃣ Lead Acquisition</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                    filter === "LEAD_ACQUISITION"
                      ? "bg-white text-blue-800"
                      : "bg-blue-200/80 text-blue-950"
                  }`}
                >
                  {leadAcquisitionCount}
                </span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 mt-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {(isLeadAcquisitionOnly
              ? [
                  { id: "ALL", label: "Tous" },
                  { id: "UNREAD", label: "Non lus" },
                ]
              : [
                  { id: "ALL", label: "Tous" },
                  { id: "ARREARS", label: "⚠️ Impayés" },
                  { id: "UNREAD", label: "Non lus" },
                ]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filter === tab.id
                    ? "bg-navy text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 scrollbar-thin">
          {isLoadingList ? (
            <div className="p-8 text-center text-gray-400 space-y-2">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">Chargement des discussions...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400 space-y-2">
              <MessageCircle className="w-8 h-8 mx-auto text-gray-300" />
              <p className="text-xs font-semibold">Aucune conversation trouvée</p>
              <p className="text-[11px] text-gray-400">
                Cliquez sur + pour démarrer un échange.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const hasArrears = (conv.driver?.currentArrearsMAD || 0) > 0;
              const formattedPhone = formatDisplayPhone(conv.phoneNumber);
              const displayPlate =
                conv.matchedPlate ||
                (conv.driver?.plateNumber && conv.driver.plateNumber !== "Non assigné"
                  ? conv.driver.plateNumber
                  : null);

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3 flex items-start gap-2.5 cursor-pointer transition-all border-l-4 ${
                    isSelected
                      ? "bg-emerald-50/70 border-emerald-500"
                      : "border-transparent hover:bg-gray-50/80"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0 mt-0.5">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs ${
                        conv.contactType === "DRIVER"
                          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300/50"
                          : conv.contactType === "LEAD"
                          ? "bg-blue-100 text-blue-800 ring-1 ring-blue-300/50"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {conv.contactName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase() || "WA"}
                    </div>
                    {conv.contactType === "DRIVER" && (
                      <span className="absolute -bottom-1 -right-1 text-[9px] bg-amber-500 text-white rounded-full px-1 py-0.2 shadow-2xs font-bold">
                        🚖
                      </span>
                    )}
                    {conv.contactType === "LEAD" && (
                      <span className="absolute -bottom-1 -right-1 text-[9px] bg-blue-500 text-white rounded-full px-1 py-0.2 shadow-2xs font-bold">
                        💼
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3
                        className={`text-xs font-bold truncate ${
                          isSelected ? "text-emerald-950 font-black" : "text-gray-900"
                        }`}
                      >
                        {conv.contactName}
                      </h3>
                      <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                        {conv.lastMessageAt
                          ? new Date(conv.lastMessageAt).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-gray-500 truncate mb-1">
                      <span className="font-mono text-gray-400">
                        {formattedPhone}
                      </span>
                      {displayPlate && (
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-950 text-[9px] font-black rounded border border-amber-300 font-mono">
                          🚗 {displayPlate}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-500 truncate font-normal">
                      {conv.lastMessage || "Pas de message récent"}
                    </p>

                    {/* Metadata & Bot Workflow tags */}
                    <div className="flex items-center flex-wrap gap-1 mt-1">
                      {conv.workflowState === "ROUTED_DRIVER_SUPPORT" && (
                        <span className="px-1.5 py-0.2 bg-amber-600 text-white text-[9px] font-extrabold rounded-md">
                          1️⃣ Support Flotte
                        </span>
                      )}
                      {conv.workflowState === "AWAITING_IMMAT" && (
                        <span className="px-1.5 py-0.2 bg-orange-100 text-orange-800 border border-orange-300 text-[9px] font-extrabold rounded-md animate-pulse">
                          ⏳ Saisie Matricule...
                        </span>
                      )}
                      {conv.workflowState === "ROUTED_LEAD_ACQUISITION" && (
                        <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[9px] font-extrabold rounded-md">
                          2️⃣ Acquisition
                        </span>
                      )}
                      {hasArrears && (
                        <span className="px-1.5 py-0.2 bg-red-100 text-red-800 text-[9px] font-extrabold rounded-md flex items-center gap-0.5">
                          ⚠️ {conv.driver?.currentArrearsMAD} MAD
                        </span>
                      )}
                      {conv.lead && (
                        <span className="px-1.5 py-0.2 bg-sky-100 text-sky-800 text-[9px] font-bold rounded-md">
                          {conv.lead.boardColumn}
                        </span>
                      )}
                      {conv.unreadCount > 0 && (
                        <span className="ml-auto px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. CENTER PANE: ULTRA-SPACIOUS ACTIVE CHAT THREAD        */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col bg-[#f0f2f5]/40 relative min-w-0">
        {activeConversation ? (
          <>
            {/* Sleek Active Thread Header */}
            <div className="px-5 py-3 bg-white border-b border-gray-200/80 flex items-center justify-between shadow-2xs z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${
                    activeConversation.contactType === "DRIVER"
                      ? "bg-amber-100 text-amber-800"
                      : activeConversation.contactType === "LEAD"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {activeConversation.contactName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-gray-900 truncate">
                      {activeConversation.contactName}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                        activeConversation.contactType === "DRIVER"
                          ? "bg-amber-100 text-amber-800"
                          : activeConversation.contactType === "LEAD"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {activeConversation.contactType === "DRIVER"
                        ? "🚖 Support Chauffeur"
                        : activeConversation.contactType === "LEAD"
                        ? "💼 Lead Acquisition"
                        : "Contact"}
                    </span>
                    {(activeConversation.matchedPlate || activeConversation.driver?.plateNumber) && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualImmatInput(
                            activeConversation.matchedPlate ||
                              activeConversation.driver?.plateNumber ||
                              ""
                          );
                          setShowImmatModal(true);
                        }}
                        className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-[11px] font-black font-mono flex items-center gap-1 cursor-pointer transition-all"
                        title="Immatriculation rattachée (Cliquer pour modifier)"
                      >
                        <Car className="w-3 h-3 text-amber-700" />
                        <span>
                          {activeConversation.matchedPlate || activeConversation.driver?.plateNumber}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-0.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeConversation.phoneNumber);
                        toast.success("Numéro copié !");
                      }}
                      className="hover:text-navy flex items-center gap-1 cursor-pointer transition-colors"
                      title="Cliquer pour copier le numéro"
                    >
                      <span>{formatDisplayPhone(activeConversation.phoneNumber)}</span>
                      <Copy className="w-3 h-3 text-gray-400" />
                    </button>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      En ligne WhatsApp
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    {is24hWindowOpen ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"
                        title="Fenêtre d'assistance Meta de 24h active : les messages libres via API sont autorisés."
                      >
                        🟢 Fenêtre 24h active (~{hours24hRemaining}h)
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                        title="Ce contact n'a pas écrit depuis plus de 24h. Meta bloque l'envoi direct par API sans modèle pré-approuvé (Code 131047). Utilisez WhatsApp Web pour lui écrire directement sans restriction."
                      >
                        🟠 Fenêtre 24h fermée (Meta API restreinte)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons & Dossier Toggle */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Bot State / Human Mode Toggle */}
                <button
                  onClick={handleToggleBot}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${
                    activeConversation.workflowState === "BOT_PAUSED" ||
                    activeConversation.workflowState === "HUMAN_AGENT"
                      ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                  }`}
                  title={
                    activeConversation.workflowState === "BOT_PAUSED" ||
                    activeConversation.workflowState === "HUMAN_AGENT"
                      ? "Mode Humain actif (Bot en pause sur ce contact). Cliquez pour réactiver le bot."
                      : "Bot automatique actif. Cliquez pour mettre en pause le bot et passer en mode 100% humain."
                  }
                >
                  {activeConversation.workflowState === "BOT_PAUSED" ||
                  activeConversation.workflowState === "HUMAN_AGENT" ? (
                    <>
                      <span className="text-xs">⏸️</span>
                      <span className="hidden lg:inline text-amber-800 font-bold">Mode Humain</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs">🤖</span>
                      <span className="hidden lg:inline text-emerald-800 font-bold">Bot Actif</span>
                    </>
                  )}
                </button>

                {/* Send 2-option Bot Welcome Menu */}
                <button
                  onClick={handleSendWelcomeMenu}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Envoyer le menu interactif WhatsApp (1: Support Chauffeur / 2: Obtenir des informations)"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden lg:inline">Menu (1/2)</span>
                </button>

                {/* Match Immatriculation Button */}
                <button
                  onClick={() => {
                    setManualImmatInput(
                      activeConversation.matchedPlate ||
                        activeConversation.driver?.plateNumber ||
                        ""
                    );
                    setShowImmatModal(true);
                  }}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Identifier le matricule du véhicule et transférer au Support Flotte"
                >
                  <Car className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden md:inline">Immat</span>
                </button>

                {/* Route to Lead Acquisition Button */}
                <button
                  onClick={handleRouteLeadAcquisition}
                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Envoyer vers Lead Acquisition (Créer fiche Prospect)"
                >
                  <span className="text-xs">🎯</span>
                  <span className="hidden xl:inline">Vers Acquisition</span>
                </button>

                <a
                  href={`tel:${activeConversation.phoneNumber}`}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Appel direct"
                >
                  <Phone className="w-3.5 h-3.5 text-navy" />
                  <span className="hidden sm:inline">Appeler</span>
                </a>

                <button
                  onClick={() => setShowSimulateModal(true)}
                  className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-purple-200 cursor-pointer"
                  title="Simuler une réponse du contact pour tester"
                >
                  <span className="text-xs">🤖</span>
                  <span className="hidden md:inline">Simuler</span>
                </button>

                {/* Dossier Toggle Button */}
                <button
                  onClick={() => setShowRightDossier(!showRightDossier)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    showRightDossier
                      ? "bg-navy text-white border-navy shadow-sm"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200"
                  }`}
                  title={showRightDossier ? "Masquer le dossier pour agrandir l'espace de chat" : "Afficher les détails et actions CRM"}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Dossier CRM</span>
                  {activeConversation.driver?.currentArrearsMAD ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  ) : null}
                </button>
              </div>
            </div>

            {/* Chat Message Scroll Area (Wide & High Space) */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-3 scrollbar-thin">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl max-w-md mx-auto text-center space-y-2 border border-gray-200/70 shadow-sm mt-12">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-800">Espace de discussion direct</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Envoyez un message WhatsApp direct à <strong>{activeConversation.contactName}</strong> ou choisissez l&apos;un des modèles prédéfinis ci-dessous.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOutbound = msg.direction === "OUTBOUND";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-3 shadow-xs text-xs relative space-y-1 transition-all ${
                          isOutbound
                            ? "bg-[#d9fdd3] text-gray-900 rounded-tr-xs border border-emerald-300/40"
                            : "bg-white text-gray-900 rounded-tl-xs border border-gray-200/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px] text-gray-500 font-semibold mb-0.5">
                          <span className={isOutbound ? "text-emerald-900 font-bold" : "text-gray-700"}>
                            {msg.sender_name || (isOutbound ? "GoCab Operations" : activeConversation.contactName)}
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono">
                            {new Date(msg.created_at).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Media display (Image / Photo) */}
                        {msg.media_url ? (
                          <div className="relative group my-1.5 overflow-hidden rounded-xl border border-black/10 bg-black/5 max-w-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={resolveMediaUrl(msg.media_url)}
                              alt={msg.text || "Photo WhatsApp"}
                              loading="lazy"
                              className="w-full max-h-72 object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={() => {
                                setLightboxScale(1);
                                setLightboxRotation(0);
                                setLightboxImage({
                                  url: resolveMediaUrl(msg.media_url!),
                                  caption: msg.text && msg.text !== "📷 Photo reçue" ? msg.text : undefined,
                                });
                              }}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                                const parent = (e.currentTarget as HTMLElement).parentElement;
                                const fallback = parent?.querySelector(".media-fallback") as HTMLElement;
                                if (fallback) fallback.style.display = "flex";
                              }}
                            />
                            {/* Fallback if image failed to load / expired */}
                            <div className="media-fallback hidden flex-col items-center justify-center p-6 text-center text-gray-500 bg-gray-50/90 rounded-xl">
                              <Camera className="w-8 h-8 text-gray-400 mb-1.5" />
                              <span className="text-[11px] font-semibold text-gray-700">Photo WhatsApp</span>
                              <span className="text-[9px] text-gray-400 mt-0.5">Média non disponible ou expiré sur WhatsApp</span>
                            </div>

                            {/* Hover Action Overlay */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-xs rounded-lg p-1 shadow-md">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxScale(1);
                                  setLightboxRotation(0);
                                  setLightboxImage({
                                    url: resolveMediaUrl(msg.media_url!),
                                    caption: msg.text && msg.text !== "📷 Photo reçue" ? msg.text : undefined,
                                  });
                                }}
                                className="p-1 rounded text-white/90 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                                title="Agrandir en plein écran"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={resolveMediaUrl(msg.media_url)}
                                download={`photo-whatsapp-${msg.id}.jpg`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded text-white/90 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                                title="Télécharger l'image"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        ) : !msg.media_url && (msg.text?.includes("Photo") || msg.text?.includes("photo") || msg.text?.includes("📷")) ? (
                          <div className="flex items-center gap-2 p-2 my-1 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900">
                            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                              <Camera className="w-4 h-4 text-amber-700" />
                            </div>
                            <div className="text-[11px] flex-1 leading-tight">
                              <div className="font-semibold text-amber-950 flex items-center gap-1.5">
                                <span>Photo WhatsApp reçue</span>
                                <span className="text-[9px] font-normal text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">Mobile</span>
                              </div>
                              <p className="text-[10px] text-amber-800/80 mt-0.5">
                                Image reçue sur l&apos;application mobile WhatsApp.
                              </p>
                            </div>
                          </div>
                        ) : null}

                        {/* Text / Caption */}
                        {msg.text && (msg.text !== "📷 Photo reçue" || !msg.media_url) && (
                          <p className="whitespace-pre-wrap leading-relaxed font-sans text-xs select-text">
                            {msg.text}
                          </p>
                        )}

                        {/* Delivery Status & Inline Retry */}
                        {isOutbound && (
                          <div className="flex items-center justify-end gap-1.5 pt-0.5 text-[10px]">
                            {msg.status === "PENDING" && (
                              <span className="text-gray-400 flex items-center gap-1 font-mono text-[9px]">
                                <Clock className="w-3 h-3 animate-spin" /> Envoi…
                              </span>
                            )}
                            {msg.status === "SENT" && (
                              <span className="text-gray-500 font-bold text-[11px]" title="Envoyé au serveur WhatsApp">
                                ✓
                              </span>
                            )}
                            {msg.status === "DELIVERED" && (
                              <span className="text-gray-600 font-bold text-[11px]" title="Reçu sur le téléphone">
                                ✓✓
                              </span>
                            )}
                            {msg.status === "READ" && (
                              <span className="text-blue-500 font-black text-[11px]" title="Lu par le destinataire">
                                ✓✓
                              </span>
                            )}
                            {msg.status === "FAILED" && (
                              <div className="mt-2 pt-2 border-t border-red-200/80 text-[10px] space-y-1.5 text-left">
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                  <span
                                    className="text-red-700 font-bold flex items-center gap-1 text-[10px] bg-red-100/90 border border-red-200 px-2 py-0.5 rounded-md"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                    {msg.error_message?.includes("131047") || msg.error_message?.includes("24h")
                                      ? "Non distribué (Fenêtre Meta 24h fermée)"
                                      : "Non distribué"}
                                  </span>

                                  <div className="flex items-center gap-2">
                                    <a
                                      href={`https://wa.me/${normalizeWhatsAppPhone(activeConversation.phoneNumber)}?text=${encodeURIComponent(msg.text)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition-all cursor-pointer text-[10px]"
                                      title="Ouvrir instantanément sur WhatsApp Web ou application mobile pour envoyer sans blocage"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      <span>Envoyer via WhatsApp Web</span>
                                    </a>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInputMessage(msg.text);
                                        textareaRef.current?.focus();
                                        toast("Message rechargé dans la zone d'envoi", { icon: "✍️" });
                                      }}
                                      className="text-[10px] text-gray-500 hover:text-gray-800 font-semibold underline cursor-pointer"
                                      title="Reprendre ce texte pour le renvoyer"
                                    >
                                      Recharger
                                    </button>
                                  </div>
                                </div>

                                <p className="text-[10px] text-red-800/90 leading-relaxed font-normal bg-red-50/70 p-1.5 rounded-lg border border-red-200/50">
                                  {msg.error_message?.includes("131047") || msg.error_message?.includes("24h")
                                    ? "Ce contact ne vous a pas écrit durant les dernières 24h. Meta bloque l'envoi direct par API sans modèle pré-approuvé. Cliquez sur 'Envoyer via WhatsApp Web' pour lui transmettre immédiatement."
                                    : msg.error_message || "Échec de transmission par la passerelle WhatsApp."}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Integrated Quick Templates Carousel (Docked Right Above Input) */}
            <div className="px-4 py-2 bg-white/95 border-t border-gray-100 flex items-center gap-2 overflow-x-auto scrollbar-none shadow-2xs">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Modèles :
              </span>
              {GOCAB_WHATSAPP_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => handleApplyTemplate(tpl)}
                  className="px-2.5 py-1 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-gray-700 text-[11px] font-semibold rounded-xl shrink-0 transition-all border border-gray-200 cursor-pointer shadow-2xs"
                >
                  {tpl.title}
                </button>
              ))}
            </div>

            {/* Chat Input Footer */}
            <div className="bg-white border-t border-gray-200/80 p-3 md:p-4">
              {!is24hWindowOpen && (
                <div className="mb-2.5 px-3 py-2 bg-amber-50 border border-amber-200/80 rounded-xl flex items-center justify-between gap-2 text-[11px] text-amber-900 animate-fadeIn">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      <strong>Fenêtre 24h fermée :</strong> Ce contact ne vous a pas écrit durant les dernières 24h. L&apos;API Meta rejettera le texte libre (Code 131047). Utilisez <strong>WhatsApp Web</strong> ci-dessous.
                    </span>
                  </div>
                  <a
                    href={`https://wa.me/${normalizeWhatsAppPhone(activeConversation.phoneNumber)}${inputMessage.trim() ? `?text=${encodeURIComponent(inputMessage.trim())}` : ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 shadow-2xs transition-all"
                    title="Ouvrir directement dans WhatsApp Web"
                  >
                    <ExternalLink className="w-3 h-3" /> Ouvrir Web
                  </a>
                </div>
              )}

              {/* Photo Preview Chip (if an image is selected) */}
              {photoPreviewUrl && (
                <div className="mb-2 px-3 py-2 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-emerald-300 shrink-0 bg-black/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoPreviewUrl}
                        alt="Aperçu photo"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => {
                          setLightboxScale(1);
                          setLightboxRotation(0);
                          setLightboxImage({ url: photoPreviewUrl, caption: selectedPhotoFile?.name });
                        }}
                      />
                    </div>
                    <div className="min-w-0 text-xs">
                      <div className="font-bold text-emerald-950 truncate max-w-xs sm:max-w-md">
                        {selectedPhotoFile?.name || "Photo jointe"}
                      </div>
                      <div className="text-[10px] text-emerald-700 flex items-center gap-1.5 mt-0.5">
                        <span>
                          {selectedPhotoFile
                            ? `${(selectedPhotoFile.size / 1024).toFixed(1)} Ko`
                            : ""}
                        </span>
                        <span>•</span>
                        <span>Prête à être envoyée avec votre message</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedPhoto}
                    className="p-1.5 rounded-xl text-emerald-800 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Supprimer la photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Hidden file input for photos */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                {/* Photo Attachment Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-2xs ${
                    selectedPhotoFile
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20"
                      : "bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-gray-600 border-gray-200"
                  }`}
                  title="Joindre une photo (ou collez avec Ctrl+V)"
                >
                  <Camera className="w-4 h-4" />
                </button>

                <div className="flex-1 bg-gray-100/90 rounded-2xl p-1.5 border border-gray-200 focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all shadow-2xs">
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={
                      selectedPhotoFile
                        ? "Ajouter une légende à la photo... (optionnel, Entrée pour envoyer)"
                        : `Écrivez à ${activeConversation.contactName}... (Entrée pour envoyer, Maj+Entrée pour saut de ligne)`
                    }
                    className="w-full px-3 py-1.5 text-xs bg-transparent focus:outline-none resize-none placeholder:text-gray-400"
                  />
                </div>

                {/* Direct WhatsApp Web Button (Bypasses 24h window restriction) */}
                <a
                  href={`https://wa.me/${normalizeWhatsAppPhone(activeConversation.phoneNumber)}${inputMessage.trim() ? `?text=${encodeURIComponent(inputMessage.trim())}` : ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-2xl bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-gray-600 border border-gray-200 flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-2xs"
                  title="Ouvrir dans WhatsApp Web ou Mobile (sans contrainte de fenêtre 24h Meta)"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* Send via API */}
                <button
                  type="submit"
                  disabled={(!inputMessage.trim() && !selectedPhotoFile) || isSending}
                  className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 disabled:opacity-40 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 transition-all shrink-0 cursor-pointer"
                  title="Envoyer via l'API WhatsApp officielle (soumis à la fenêtre 24h)"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-gray-400">
                <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Ligne WhatsApp vérifiée : +212 6 62 14 51 09
                </span>
                <span className="font-mono hidden sm:inline">Entrée ↵ pour envoyer</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center text-gray-400">
              <MessageCircle className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-gray-700">Sélectionnez une discussion</h3>
            <p className="text-xs text-gray-500 max-w-sm">
              Choisissez un chauffeur ou un lead dans la liste à gauche pour accéder à l&apos;espace de messagerie instantanée WhatsApp.
            </p>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. RIGHT PANE: COLLAPSIBLE CRM DOSSIER                    */}
      {/* ======================================================== */}
      {activeConversation && showRightDossier && (
        <div className="w-80 lg:w-88 border-l border-gray-200/80 bg-white flex flex-col overflow-y-auto p-5 space-y-4 shrink-0 shadow-lg animate-in slide-in-from-right duration-200">
          {/* Dossier Header with Close Button */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-navy" />
              Dossier & Profil CRM
            </span>
            <button
              onClick={() => setShowRightDossier(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
              title="Fermer le dossier"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center pb-3 border-b border-gray-100">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center font-black text-base mb-2 shadow-2xs ${
                activeConversation.contactType === "DRIVER"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {activeConversation.contactName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <h3 className="text-sm font-black text-gray-900">{activeConversation.contactName}</h3>
            <p className="text-xs font-mono text-gray-500">{formatDisplayPhone(activeConversation.phoneNumber)}</p>
          </div>

          {/* DRIVER SPECIFIC CRM DOSSIER */}
          {activeConversation.driver && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-amber-600" />
                  Chauffeur Flotte
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                  {activeConversation.driver.defaultStage || "Actif"}
                </span>
              </div>

              {/* Vehicle & Arrears Cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[9px] font-bold text-gray-400 uppercase">Véhicule</span>
                  <p className="text-xs font-black text-navy mt-0.5">
                    {activeConversation.driver.plateNumber}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {activeConversation.driver.vehicleModel}
                  </p>
                </div>

                <div
                  className={`p-2.5 rounded-xl border ${
                    activeConversation.driver.currentArrearsMAD > 0
                      ? "bg-red-50 border-red-200"
                      : "bg-emerald-50 border-emerald-200"
                  }`}
                >
                  <span className="text-[9px] font-bold text-gray-400 uppercase">Solde Impayé</span>
                  <p
                    className={`text-xs font-black mt-0.5 ${
                      activeConversation.driver.currentArrearsMAD > 0
                        ? "text-red-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {activeConversation.driver.currentArrearsMAD.toLocaleString()} MAD
                  </p>
                  <p className="text-[9px] text-gray-500">
                    {activeConversation.driver.consecutiveUnpaidDays} j. impayés
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">CIN :</span>
                  <span className="font-bold text-gray-800">{activeConversation.driver.cin || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Contrat :</span>
                  <span className="font-bold text-gray-800">{activeConversation.driver.contractType || "Journalier"}</span>
                </div>
              </div>

              {/* Quick WhatsApp Action Triggers */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Actions Rapides</span>
                <button
                  onClick={() => {
                    const tpl = GOCAB_WHATSAPP_TEMPLATES.find((t) => t.id === "PAYMENT_DAILY_REMINDER");
                    if (tpl) handleApplyTemplate(tpl);
                  }}
                  className="w-full py-2 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>💰 Relancer versement (300 MAD)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    const tpl = GOCAB_WHATSAPP_TEMPLATES.find((t) => t.id === "RECOVERY_WARNING");
                    if (tpl) handleApplyTemplate(tpl);
                  }}
                  className="w-full py-2 px-2.5 bg-red-50 hover:bg-red-100 text-red-900 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>🚨 Alerte blocage télématique</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* LEAD SPECIFIC CRM DOSSIER */}
          {activeConversation.lead && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                  <span className="text-sm">🎓</span>
                  Dossier Recrutement
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
                  {activeConversation.lead.boardColumn}
                </span>
              </div>

              <div className="space-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Ville :</span>
                  <span className="font-bold text-gray-800">{activeConversation.lead.city}</span>
                </div>
                {activeConversation.lead.trainingStatus && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Formation :</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      🎓 {activeConversation.lead.trainingStatus}
                    </span>
                  </div>
                )}
                {activeConversation.lead.presenceConfirmed !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Présence :</span>
                    <span
                      className={`font-bold ${
                        activeConversation.lead.presenceConfirmed
                          ? "text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded"
                          : "text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded"
                      }`}
                    >
                      {activeConversation.lead.presenceConfirmed ? "✅ Confirmée" : "⏳ Non confirmée"}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Carte CIN :</span>
                  <span className={`font-bold ${activeConversation.lead.hasCin ? "text-emerald-600" : "text-amber-600"}`}>
                    {activeConversation.lead.hasCin ? "✅ Validée" : "⏳ En attente"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Permis :</span>
                  <span className={`font-bold ${activeConversation.lead.hasPermis ? "text-emerald-600" : "text-amber-600"}`}>
                    {activeConversation.lead.hasPermis ? "✅ Validé" : "⏳ En attente"}
                  </span>
                </div>
                {activeConversation.lead.notes && (
                  <div className="pt-1.5 border-t border-gray-200/60 mt-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Notes :</span>
                    <p className="text-[11px] text-gray-600 italic bg-white p-2 rounded-lg border border-gray-100">
                      {activeConversation.lead.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Actions Recrutement</span>
                <button
                  onClick={() => {
                    const tpl = GOCAB_WHATSAPP_TEMPLATES.find((t) => t.id === "TRAINING_INVITATION");
                    if (tpl) handleApplyTemplate(tpl);
                  }}
                  className="w-full py-2 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>🎓 Convoquer en formation</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    const tpl = GOCAB_WHATSAPP_TEMPLATES.find((t) => t.id === "MISSING_DOCS");
                    if (tpl) handleApplyTemplate(tpl);
                  }}
                  className="w-full py-2 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>📄 Relancer documents</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SIMULATE INBOUND MESSAGE MODAL (TESTING & DEMO)          */}
      {/* ======================================================== */}
      {showSimulateModal && activeConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-md w-full p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2 text-purple-700 font-black text-sm">
                <span>🤖</span>
                <span>Simuler un message entrant</span>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Teste la réception en direct dans le CRM pour{" "}
              <strong>{activeConversation.contactName}</strong>.
            </p>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase">
                Tester le Workflow Bot (1: Support Chauffeur / 2: Infos) :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "menu",
                  "1",
                  "12345-A-6",
                  "2",
                  "Mon véhicule a un voyant moteur allumé",
                  "Je veux des informations sur vos formules",
                ].map((txt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSimulateText(txt)}
                    className="text-[11px] bg-purple-50 text-purple-800 hover:bg-purple-100 px-2 py-0.5 rounded-lg border border-purple-200 text-left transition-all cursor-pointer font-semibold"
                  >
                    &quot;{txt.slice(0, 38)}&quot;
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              value={simulateText}
              onChange={(e) => setSimulateText(e.target.value)}
              placeholder="Texte du message WhatsApp entrant..."
              className="w-full border border-gray-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="px-3.5 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleSimulateInbound(simulateText)}
                disabled={!simulateText.trim()}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Simuler réception</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MATCH IMMATRICULATION MODAL (FLEET PERFORMANCE SUPPORT)  */}
      {/* ======================================================== */}
      {showImmatModal && activeConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fadeIn">
          <form
            onSubmit={handleMatchImmat}
            className="bg-white rounded-3xl shadow-2xl border border-amber-200 max-w-md w-full p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2 text-amber-800 font-black text-sm">
                <Car className="w-4 h-4 text-amber-600" />
                <span>Rattacher Matricule — Support Flotte</span>
              </div>
              <button
                type="button"
                onClick={() => setShowImmatModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Saisissez l&apos;immatriculation du véhicule pour rattacher{" "}
              <strong>{activeConversation.contactName}</strong> au véhicule correspondant dans la Flotte et afficher la discussion au Support Performance Flotte :
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Numéro d&apos;immatriculation (ex: 12345-A-6)
              </label>
              <input
                type="text"
                required
                value={manualImmatInput}
                onChange={(e) => setManualImmatInput(e.target.value)}
                placeholder="12345-A-6"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowImmatModal(false)}
                className="px-3.5 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!manualImmatInput.trim()}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Valider &amp; Transférer au Support</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* NEW CONVERSATION MODAL                                   */}
      {/* ======================================================== */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fadeIn">
          <form
            onSubmit={handleCreateNewConversation}
            className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2 text-emerald-700 font-black text-sm">
                <Plus className="w-4 h-4" />
                <span>Nouvelle Conversation WhatsApp</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Numéro de Téléphone (ex: 0612345678 ou +212612345678)
                </label>
                <input
                  type="text"
                  required
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  placeholder="0612345678"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nom du contact (optionnel - auto-détecté si chauffeur/lead)
                </label>
                <input
                  type="text"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  placeholder="Nom complet"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="px-3.5 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!newChatPhone.trim()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                Démarrer la discussion
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* FULL-SCREEN PHOTO LIGHTBOX MODAL                         */}
      {/* ======================================================== */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col justify-between p-4 select-none animate-fadeIn"
          onClick={() => setLightboxImage(null)}
        >
          {/* Top Bar / Controls */}
          <div
            className="flex items-center justify-between gap-4 text-white p-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 truncate max-w-lg">
              <Camera className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-xs md:text-sm font-semibold truncate text-white/90">
                {lightboxImage.caption || "Photo WhatsApp"}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxScale((s) => Math.max(0.5, s - 0.25))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Dézoomer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setLightboxScale(1);
                  setLightboxRotation(0);
                }}
                className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono text-white transition-colors cursor-pointer"
                title="Réinitialiser le zoom"
              >
                {Math.round(lightboxScale * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setLightboxScale((s) => Math.min(3.5, s + 0.25))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Zoomer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxRotation((r) => (r + 90) % 360)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Pivoter de 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <a
                href={lightboxImage.url}
                download="photo-whatsapp.jpg"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer flex items-center justify-center"
                title="Télécharger l'image"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-red-600 text-white transition-colors cursor-pointer ml-2"
                title="Fermer (Échap)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Centered Image View with scale and rotation */}
          <div
            className="flex-1 flex items-center justify-center p-4 overflow-hidden"
            onClick={() => setLightboxImage(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.url}
              alt={lightboxImage.caption || "Photo WhatsApp"}
              style={{
                transform: `scale(${lightboxScale}) rotate(${lightboxRotation}deg)`,
                transition: "transform 0.15s ease-out",
              }}
              className="max-h-[82vh] max-w-[92vw] object-contain rounded-lg shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Bottom Bar Caption (if present) */}
          {lightboxImage.caption && (
            <div
              className="text-center p-3 text-white/90 text-xs md:text-sm bg-black/40 backdrop-blur-xs rounded-xl mx-auto max-w-xl truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {lightboxImage.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
