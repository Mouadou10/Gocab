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
  X,
  Zap,
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
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [simulateText, setSimulateText] = useState("");
  const [apiConfig, setApiConfig] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active selected conversation object
  const activeConversation = conversations.find((c) => c.id === selectedConvId) || null;

  // Auto scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      if (res.ok && data.success) {
        // Replace optimistic with real message
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (data.message as MessageItem) : m))
        );
        fetchConversations(true);
        if (data.mode === "META_CLOUD_API") {
          toast.success("Message transmis via Meta WhatsApp API", { icon: "✅" });
        }
      } else {
        toast.error(data.error || "Erreur lors de l'envoi du message");
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "FAILED" } : m))
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur réseau");
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "FAILED" } : m))
      );
    } finally {
      setIsSending(false);
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
    <div className="flex-1 flex overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-xl min-h-[calc(100vh-8.5rem)]">
      {/* ======================================================== */}
      {/* 1. LEFT PANE: CONVERSATION LIST & SEARCH & FILTERS       */}
      {/* ======================================================== */}
      <div className="w-80 lg:w-96 flex flex-col border-r border-gray-200/80 bg-white shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
                WhatsApp CRM
                {apiConfig?.isLiveConfigured ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800" title="Connecté à Meta Graph API">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-100 text-sky-800" title="Mode direct GoCab CRM actif">
                    <Zap className="w-2.5 h-2.5" />
                    CRM
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-gray-500 font-medium">Ligne directe chauffeurs & leads</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchConversations(true)}
              title="Rafraîchir les conversations"
              className="p-2 rounded-xl text-gray-500 hover:text-navy hover:bg-gray-100 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowNewChatModal(true)}
              title="Nouvelle conversation"
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher nom, téléphone, matricule..."
              className="w-full pl-9 pr-8 py-2 bg-gray-100/80 hover:bg-gray-100 focus:bg-white text-xs rounded-xl border border-transparent focus:border-emerald-500 focus:outline-none transition-all"
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
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "ALL", label: "Tous" },
              { id: "DRIVERS", label: "Chauffeurs" },
              { id: "LEADS", label: "Leads" },
              { id: "ARREARS", label: "⚠️ Impayés" },
              { id: "UNREAD", label: "🔴 Non lus" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
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
                Cliquez sur le bouton + pour contacter un chauffeur.
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
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all border-l-4 ${
                    isSelected
                      ? "bg-emerald-50/50 border-emerald-500"
                      : "border-transparent hover:bg-gray-50/80"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs ${
                        conv.contactType === "DRIVER"
                          ? "bg-amber-100 text-amber-800 ring-2 ring-amber-400/30"
                          : conv.contactType === "LEAD"
                          ? "bg-blue-100 text-blue-800 ring-2 ring-blue-400/30"
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
                      <span className="absolute -bottom-1 -right-1 text-[10px] bg-amber-500 text-white rounded-full p-0.5" title="Chauffeur GoCab">
                        🚖
                      </span>
                    )}
                    {conv.contactType === "LEAD" && (
                      <span className="absolute -bottom-1 -right-1 text-[10px] bg-blue-500 text-white rounded-full p-0.5" title="Candidat Lead">
                        💼
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3
                        className={`text-xs font-bold truncate ${
                          isSelected ? "text-navy" : "text-gray-900"
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

                    <div className="flex items-center gap-1 text-[11px] text-gray-500 truncate mb-1">
                      <span className="font-mono text-gray-400 text-[10px]">
                        {formattedPhone}
                      </span>
                      {conv.driver?.plateNumber && (
                        <span className="px-1.5 py-0.2 bg-gray-100 text-gray-700 text-[9px] font-bold rounded-md border border-gray-200">
                          {conv.driver.plateNumber}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-500 truncate font-normal">
                      {conv.lastMessage || "Pas de message récent"}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {hasArrears && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-extrabold rounded-md flex items-center gap-0.5">
                          ⚠️ {conv.driver?.currentArrearsMAD} MAD
                        </span>
                      )}
                      {conv.lead && (
                        <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 text-[9px] font-bold rounded-md">
                          {conv.lead.boardColumn}
                        </span>
                      )}
                      {conv.unreadCount > 0 && (
                        <span className="ml-auto w-4 h-4 bg-emerald-600 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse">
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
      {/* 2. CENTER PANE: ACTIVE CHAT THREAD & INPUT               */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col bg-[#efeae2]/40 relative">
        {activeConversation ? (
          <>
            {/* Active Thread Header */}
            <div className="px-6 py-3.5 bg-white border-b border-gray-200/80 flex items-center justify-between shadow-xs z-10">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs ${
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
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-gray-900">
                      {activeConversation.contactName}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
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
                  <p className="text-xs text-gray-500 font-mono flex items-center gap-2">
                    <span>{formatDisplayPhone(activeConversation.phoneNumber)}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-emerald-600 font-semibold">En ligne WhatsApp</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${activeConversation.phoneNumber}`}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-navy" />
                  <span>Appeler</span>
                </a>
                <a
                  href={`https://wa.me/${activeConversation.phoneNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-emerald-200"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  <span>WhatsApp Web</span>
                </a>
                <button
                  onClick={() => setShowSimulateModal(true)}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-purple-200 cursor-pointer"
                  title="Simuler une réponse du chauffeur pour tester le flux"
                >
                  <span className="text-xs">🤖</span>
                  <span>Simuler Réponse</span>
                </button>
              </div>
            </div>

            {/* Quick Templates Bar */}
            <div className="px-6 py-2 bg-white/90 border-b border-gray-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                <span>✨</span>
                Modèles Rapides :
              </span>
              {GOCAB_WHATSAPP_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => handleApplyTemplate(tpl)}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-100 hover:text-emerald-900 text-gray-700 text-[11px] font-semibold rounded-lg shrink-0 transition-all border border-gray-200/60 cursor-pointer"
                >
                  {tpl.title}
                </button>
              ))}
            </div>

            {/* Chat Message Scroll Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-3.5">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl max-w-md mx-auto text-center space-y-2 border border-gray-200/50 shadow-sm mt-8">
                  <MessageCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                  <h4 className="text-xs font-bold text-gray-800">Début de la conversation</h4>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Envoyez un message direct ou utilisez l&apos;un de nos modèles prédéfinis pour relancer ce contact.
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
                        className={`max-w-[78%] rounded-2xl p-3.5 shadow-sm text-xs relative space-y-1 ${
                          isOutbound
                            ? "bg-[#dcf8c6] text-gray-900 rounded-tr-none border border-emerald-200/50"
                            : "bg-white text-gray-900 rounded-tl-none border border-gray-200/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px] text-gray-500 font-semibold mb-0.5">
                          <span>{msg.sender_name || (isOutbound ? "GoCab" : activeConversation.contactName)}</span>
                          <span className="text-[9px] text-gray-400">
                            {new Date(msg.created_at).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <p className="whitespace-pre-wrap leading-relaxed font-sans">{msg.text}</p>

                        {/* Status Icon */}
                        {isOutbound && (
                          <div className="flex items-center justify-end gap-1 pt-1 text-[10px]">
                            {msg.status === "PENDING" && <Clock className="w-3 h-3 text-gray-400 animate-spin" />}
                            {msg.status === "SENT" && <Check className="w-3 h-3 text-gray-400" />}
                            {msg.status === "DELIVERED" && <span className="text-gray-400 font-bold text-[11px] leading-none">✓✓</span>}
                            {msg.status === "READ" && <span className="text-blue-500 font-bold text-[11px] leading-none">✓✓</span>}
                            {msg.status === "FAILED" && (
                              <span className="text-red-500 font-bold flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" /> Échec
                              </span>
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

            {/* Chat Input Footer */}
            <div className="p-4 bg-white border-t border-gray-200/80">
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <div className="flex-1 bg-gray-100/90 rounded-2xl p-1.5 border border-gray-200 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                  <textarea
                    rows={2}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Écrivez votre message WhatsApp... (Entrée pour envoyer, Maj+Entrée pour saut de ligne)"
                    className="w-full px-3 py-1.5 text-xs bg-transparent focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isSending}
                  className="w-11 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 transition-all shrink-0 cursor-pointer"
                  title="Envoyer le message WhatsApp"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center text-gray-400">
              <MessageCircle className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-gray-700">Aucune conversation sélectionnée</h3>
            <p className="text-xs text-gray-500 max-w-sm">
              Sélectionnez une discussion dans la liste de gauche pour échanger en direct avec un chauffeur ou un lead.
            </p>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. RIGHT PANE: CRM DOSSIER (DRIVER OR LEAD CONTEXT)       */}
      {/* ======================================================== */}
      {activeConversation && (
        <div className="w-80 lg:w-88 border-l border-gray-200/80 bg-white flex flex-col overflow-y-auto p-5 space-y-5 shrink-0">
          <div className="text-center pb-4 border-b border-gray-100">
            <div
              className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center font-black text-lg mb-2 shadow-sm ${
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
            <h3 className="text-sm font-extrabold text-gray-900">{activeConversation.contactName}</h3>
            <p className="text-xs font-mono text-gray-500">{formatDisplayPhone(activeConversation.phoneNumber)}</p>
          </div>

          {/* DRIVER SPECIFIC CRM DOSSIER */}
          {activeConversation.driver && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-amber-600" />
                  Dossier Chauffeur
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                  {activeConversation.driver.defaultStage || "Actif"}
                </span>
              </div>

              {/* Vehicle & Arrears Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Véhicule</span>
                  <p className="text-xs font-black text-navy mt-0.5">
                    {activeConversation.driver.plateNumber}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {activeConversation.driver.vehicleModel}
                  </p>
                </div>

                <div
                  className={`p-3 rounded-2xl border ${
                    activeConversation.driver.currentArrearsMAD > 0
                      ? "bg-red-50 border-red-200"
                      : "bg-emerald-50 border-emerald-200"
                  }`}
                >
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Solde Impayé</span>
                  <p
                    className={`text-xs font-black mt-0.5 ${
                      activeConversation.driver.currentArrearsMAD > 0
                        ? "text-red-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {activeConversation.driver.currentArrearsMAD.toLocaleString()} MAD
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {activeConversation.driver.consecutiveUnpaidDays} j. sans versement
                  </p>
                </div>
              </div>

              <div className="space-y-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">CIN Chauffeur :</span>
                  <span className="font-bold text-gray-800">{activeConversation.driver.cin || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Type de Contrat :</span>
                  <span className="font-bold text-gray-800">{activeConversation.driver.contractType || "Journalier"}</span>
                </div>
              </div>

              {/* Quick WhatsApp Action Triggers */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase">Actions Rapides</span>
                <button
                  onClick={() => {
                    const tpl = GOCAB_WHATSAPP_TEMPLATES.find((t) => t.id === "PAYMENT_DAILY_REMINDER");
                    if (tpl) handleApplyTemplate(tpl);
                  }}
                  className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>💰 Relancer versement (300 MAD)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    const tpl = GOCAB_WHATSAPP_TEMPLATES.find((t) => t.id === "RECOVERY_WARNING");
                    if (tpl) handleApplyTemplate(tpl);
                  }}
                  className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>🚨 Alerte blocage télématique</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* LEAD SPECIFIC CRM DOSSIER */}
          {activeConversation.lead && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-sm">🎓</span>
                  Dossier Recrutement Lead
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
                  {activeConversation.lead.boardColumn}
                </span>
              </div>

              <div className="space-y-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-xs">
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
                  <span className="text-gray-500">Permis de conduire :</span>
                  <span className={`font-bold ${activeConversation.lead.hasPermis ? "text-emerald-600" : "text-amber-600"}`}>
                    {activeConversation.lead.hasPermis ? "✅ Validé" : "⏳ En attente"}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase">Actions Recrutement</span>
                <button
                  onClick={() => {
                    const tpl = GOCAB_WHATSAPP_TEMPLATES.find((t) => t.id === "TRAINING_INVITATION");
                    if (tpl) handleApplyTemplate(tpl);
                  }}
                  className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>🎓 Convoquer en formation</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    const tpl = GOCAB_WHATSAPP_TEMPLATES.find((t) => t.id === "MISSING_DOCS");
                    if (tpl) handleApplyTemplate(tpl);
                  }}
                  className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>📄 Relancer documents manquants</span>
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
          <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-purple-700 font-black text-sm">
                <span>🤖</span>
                <span>Simuler un message entrant du chauffeur</span>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Permet de tester instantanément la réception en direct dans le CRM, comme si{" "}
              <strong>{activeConversation.contactName}</strong> vous répondait sur WhatsApp.
            </p>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-500">Réponses rapides suggérées :</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "J'ai effectué le versement de 300 MAD ce matin par Wafacash",
                  "Je suis en route pour l'agence pour la formation",
                  "Mon véhicule a un voyant moteur allumé",
                  "Voici la photo de ma CIN recto/verso",
                ].map((txt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSimulateText(txt)}
                    className="text-[11px] bg-purple-50 text-purple-800 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 text-left transition-all cursor-pointer"
                  >
                    &quot;{txt.slice(0, 38)}...&quot;
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              value={simulateText}
              onChange={(e) => setSimulateText(e.target.value)}
              placeholder="Texte du message WhatsApp entrant..."
              className="w-full border border-gray-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleSimulateInbound(simulateText)}
                disabled={!simulateText.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
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
            className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-emerald-700 font-black text-sm">
                <Plus className="w-5 h-5" />
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!newChatPhone.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
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
