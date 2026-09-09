"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import toast from "react-hot-toast";
import { GOCAB_WHATSAPP_TEMPLATES, formatDisplayPhone } from "@/lib/whatsapp";

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
}

interface ConversationItem {
  id: string;
  phoneNumber: string;
  contactName: string;
  contactType: "DRIVER" | "LEAD" | "UNKNOWN";
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

export default function WhatsAppCrmView() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | "DRIVERS" | "LEADS" | "ARREARS" | "UNREAD">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [inputMessage, setInputMessage] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [showRightDossier, setShowRightDossier] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [simulateText, setSimulateText] = useState("");
  const [apiConfig, setApiConfig] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active selected conversation object
  const activeConversation = conversations.find((c) => c.id === selectedConvId) || null;

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

  // Check for target phone requested from Lead Drawer
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const targetPhone = localStorage.getItem("gocab_target_whatsapp_phone");
      if (targetPhone) {
        setSearchQuery(targetPhone);
        localStorage.removeItem("gocab_target_whatsapp_phone");
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

        // If no conversation is selected, pick the first one
        if (!preserveSelection || !selectedConvId) {
          if (list.length > 0 && !selectedConvId) {
            setSelectedConvId(list[0].id);
          }
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

  // Send Message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeConversation || isSending) return;

    const messageText = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);

    // Optimistic UI message insertion
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MessageItem = {
      id: tempId,
      conversation_id: activeConversation.id,
      direction: "OUTBOUND",
      sender_type: "AGENT",
      sender_name: "GoCab Operations",
      text: messageText,
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
              className="w-full pl-8 pr-7 py-1.5 bg-gray-100/80 hover:bg-gray-100 focus:bg-white text-xs rounded-xl border border-transparent focus:border-emerald-500 focus:outline-none transition-all"
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

          {/* Filter Chips */}
          <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-0.5 scrollbar-none">
            {[
              { id: "ALL", label: "Tous" },
              { id: "DRIVERS", label: "Chauffeurs" },
              { id: "LEADS", label: "Leads" },
              { id: "ARREARS", label: "⚠️ Impayés" },
              { id: "UNREAD", label: "Non lus" },
            ].map((tab) => (
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
                      {conv.driver?.plateNumber && (
                        <span className="px-1 py-0.2 bg-gray-100 text-gray-700 text-[9px] font-bold rounded border border-gray-200">
                          {conv.driver.plateNumber}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-500 truncate font-normal">
                      {conv.lastMessage || "Pas de message récent"}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex items-center gap-1 mt-1">
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
                  <div className="flex items-center gap-2">
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
                        ? "🚖 Chauffeur"
                        : activeConversation.contactType === "LEAD"
                        ? "💼 Lead Candidat"
                        : "Contact"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-0.5">
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
                  </div>
                </div>
              </div>

              {/* Action Buttons & Dossier Toggle */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Official verified badge */}
                <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+212 6 62 14 51 09 · Vérifié</span>
                </div>

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

                        <p className="whitespace-pre-wrap leading-relaxed font-sans text-xs select-text">
                          {msg.text}
                        </p>

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
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className="text-red-700 font-semibold flex items-center gap-1 text-[9px] bg-red-100/90 border border-red-200 px-1.5 py-0.5 rounded-md"
                                  title={msg.error_message || "Échec d'envoi"}
                                >
                                  <AlertTriangle className="w-3 h-3 text-red-600" /> Non distribué
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInputMessage(msg.text);
                                    textareaRef.current?.focus();
                                    toast("Message rechargé dans la zone d'envoi", { icon: "✍️" });
                                  }}
                                  className="text-[10px] text-emerald-700 hover:text-emerald-900 font-black underline cursor-pointer"
                                  title="Reprendre ce texte pour le renvoyer"
                                >
                                  Réessayer
                                </button>
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
              <form onSubmit={handleSendMessage} className="flex items-end gap-2.5">
                <div className="flex-1 bg-gray-100/90 rounded-2xl p-1.5 border border-gray-200 focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all shadow-2xs">
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Écrivez à ${activeConversation.contactName}... (Entrée pour envoyer, Maj+Entrée pour saut de ligne)`}
                    className="w-full px-3 py-1.5 text-xs bg-transparent focus:outline-none resize-none placeholder:text-gray-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isSending}
                  className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 disabled:opacity-40 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 transition-all shrink-0 cursor-pointer"
                  title="Envoyer sur WhatsApp"
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
              <span className="text-[10px] font-bold text-gray-400 uppercase">Réponses types :</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "J'ai effectué le versement de 300 MAD ce matin",
                  "Je suis en route pour la formation",
                  "Mon véhicule a un voyant moteur allumé",
                  "Voici la photo de ma CIN recto/verso",
                ].map((txt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSimulateText(txt)}
                    className="text-[11px] bg-purple-50 text-purple-800 hover:bg-purple-100 px-2 py-0.5 rounded-lg border border-purple-200 text-left transition-all cursor-pointer"
                  >
                    &quot;{txt.slice(0, 36)}…&quot;
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
    </div>
  );
}
