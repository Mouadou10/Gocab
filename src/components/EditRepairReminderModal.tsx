"use client";

import { useState, useRef } from "react";
import {
  X,
  Camera,
  Upload,
  Trash2,
  Wrench,
  Building,
  DollarSign,
  Calendar,
  Clock,
  MessageSquare,
  Send,
  Plus,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { RepairReminderItem } from "./RepairReminderCard";

export interface RepairPhoto {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  size?: number;
  uploaded_at?: string;
}

export interface RepairCommentItem {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

interface EditRepairReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reminder: RepairReminderItem;
  initialTab?: "photos" | "comments" | "details";
}

const REPAIR_TYPES = [
  { id: "Carrosserie & Peinture", label: "🎨 Carrosserie & Peinture" },
  { id: "Pare-choc & Phares", label: "💡 Pare-chocs, Ailes & Optiques" },
  { id: "Pare-brise & Vitrage", label: "🪟 Pare-brise & Vitrage" },
  { id: "Mécanique & Moteur", label: "⚙️ Mécanique & Diagnostic Moteur" },
  { id: "Pneumatiques & Géométrie", label: "🛞 Pneumatiques & Parallélisme" },
  { id: "Révision avant Visite", label: "🔧 Révision avant Visite Technique" },
  { id: "Autre Réparation", label: "🔨 Autre Réparation Spéciale" },
] as const;

const GARAGE_SUGGESTIONS = [
  "Emergence Auto",
  "Atelier Central GoCab",
  "Garage Atlas Casablanca",
  "Carrosserie Moderne Rabat",
  "Garage Partenaire Sidi Maarouf",
  "Atelier Dépannage Express",
];

export default function EditRepairReminderModal({
  isOpen,
  onClose,
  onSuccess,
  reminder,
  initialTab = "photos",
}: EditRepairReminderModalProps) {
  const { data: session } = useSession();
  const currentUserName = session?.user?.name || "Agent";

  const [activeTab, setActiveTab] = useState<"photos" | "comments" | "details">(initialTab);

  // Photos state
  const [photos, setPhotos] = useState<RepairPhoto[]>(reminder.photos || []);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comments state
  const initialComments: RepairCommentItem[] = (() => {
    if (Array.isArray((reminder as any).comments) && (reminder as any).comments.length > 0) {
      return (reminder as any).comments;
    }
    if (reminder.agent_notes) {
      try {
        const parsed = JSON.parse(reminder.agent_notes);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return [
        {
          id: "note-1",
          author: reminder.created_by || "Agent",
          content: reminder.agent_notes,
          created_at: reminder.created_at || new Date().toISOString(),
        },
      ];
    }
    return [];
  })();

  const [comments, setComments] = useState<RepairCommentItem[]>(initialComments);
  const [newCommentText, setNewCommentText] = useState("");

  // Details state
  const [title, setTitle] = useState(reminder.title || "");
  const [description, setDescription] = useState(reminder.description || "");
  const [repairType, setRepairType] = useState(reminder.repair_type || "Carrosserie & Peinture");
  const [garageName, setGarageName] = useState(reminder.garage_name || "");
  const [estimatedCostMAD, setEstimatedCostMAD] = useState(
    reminder.estimated_cost_mad ? String(reminder.estimated_cost_mad) : ""
  );
  const [reminderDate, setReminderDate] = useState(reminder.reminder_date || "");
  const [reminderTime, setReminderTime] = useState(reminder.reminder_time || "09:00");
  const [priority, setPriority] = useState<"Normal" | "Urgent" | "Critical">(
    reminder.priority || "Normal"
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // HTML5 Canvas image compressor
  const processImageFile = (file: File): Promise<RepairPhoto> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return resolve({
              id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              fileUrl: e.target?.result as string,
              fileType: file.type || "image/jpeg",
              size: file.size,
              uploaded_at: new Date().toISOString(),
            });
          }

          const maxDim = 1600;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve({
            id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            fileUrl: compressedDataUrl,
            fileType: "image/jpeg",
            size: Math.round(compressedDataUrl.length * 0.75),
            uploaded_at: new Date().toISOString(),
          });
        };
        img.onerror = () => reject(new Error("Impossible de décoder l'image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessingPhotos(true);
    try {
      const newItems: RepairPhoto[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        if (!f.type.startsWith("image/")) {
          toast.error(`${f.name} n'est pas une image valide.`);
          continue;
        }
        const item = await processImageFile(f);
        newItems.push(item);
      }
      setPhotos((prev) => [...prev, ...newItems]);
      toast.success(`${newItems.length} nouvelle(s) photo(s) ajoutée(s) !`);
    } catch (err: any) {
      toast.error(err.message || "Erreur de traitement des photos");
    } finally {
      setIsProcessingPhotos(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    toast.success("Photo retirée.");
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) {
      toast.error("Veuillez saisir un texte pour le commentaire.");
      return;
    }
    const newComment: RepairCommentItem = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      author: currentUserName,
      content: newCommentText.trim(),
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [newComment, ...prev]);
    setNewCommentText("");
    toast.success("Commentaire ajouté au suivi !");
  };

  const handleRemoveComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    toast.success("Commentaire supprimé.");
  };

  const handleSaveAll = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim() || reminder.title,
        description: description.trim() || reminder.description,
        repair_type: repairType,
        garage_name: garageName.trim() || null,
        estimated_cost_mad: estimatedCostMAD ? Number(estimatedCostMAD) : 0,
        reminder_date: reminderDate || reminder.reminder_date,
        reminder_time: reminderTime || reminder.reminder_time,
        priority,
        photos,
        comments,
      };

      const res = await fetch(`/api/insurance/repair-reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Échec de l'enregistrement des modifications");
      }

      toast.success("✅ Sinistre et photos mis à jour avec succès !");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error updating repair reminder:", err);
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy via-[#1e3a5f] to-[#0f1e35] p-5 sm:p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Modifier le Sinistre & Rappel Réparation
                </h3>
                <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {reminder.plate_number}
                </span>
                {reminder.vehicle_make_model && (
                  <span className="text-2xs text-gray-300 font-medium">
                    · {reminder.vehicle_make_model}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                Chauffeur : <span className="font-semibold text-white">{reminder.driver_name || "Non assigné"}</span>
                {reminder.driver_phone && <span className="text-amber-300 ml-1">({reminder.driver_phone})</span>}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-gray-200 bg-gray-50/80 px-4 sm:px-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("photos")}
            className={`py-3 px-3 sm:px-4 text-xs font-black transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "photos"
                ? "border-amber-600 text-amber-700 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Photos des Dommages ({photos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("comments")}
            className={`py-3 px-3 sm:px-4 text-xs font-black transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "comments"
                ? "border-amber-600 text-amber-700 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Commentaires & Suivi ({comments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`py-3 px-3 sm:px-4 text-xs font-black transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "details"
                ? "border-amber-600 text-amber-700 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Détails du Sinistre</span>
          </button>
        </div>

        {/* Body content based on tab */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: PHOTOS */}
          {activeTab === "photos" && (
            <div className="space-y-4 animate-fadeIn">
              {/* Dropzone for new photos */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/30 hover:bg-amber-50/70 p-6 rounded-2xl text-center cursor-pointer transition-all space-y-2 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-gray-900">
                    Cliquez ou glissez-déposez des photos ici pour ajouter au sinistre
                  </p>
                  <p className="text-2xs text-gray-500">
                    Supporte les photos JPG, PNG, WEBP (compression automatique haute qualité)
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handlePhotoFiles(e.target.files)}
                  className="hidden"
                />

                {isProcessingPhotos && (
                  <p className="text-xs text-amber-700 font-bold animate-pulse">
                    Compression et traitement des photos en cours...
                  </p>
                )}
              </div>

              {/* Gallery of photos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">
                    Galerie Photos ({photos.length})
                  </h4>
                  <span className="text-3xs text-gray-400">
                    Cliquez sur une photo pour l&apos;agrandir ou supprimez les obsolètes
                  </span>
                </div>

                {photos.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-400">
                    Aucune photo enregistrée pour ce sinistre. Ajoutez-en via le bouton ci-dessus.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {photos.map((photo, index) => (
                      <div
                        key={photo.id || index}
                        className="group relative bg-gray-900 rounded-2xl overflow-hidden aspect-video border border-gray-200 shadow-xs hover:shadow-md transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.fileUrl}
                          alt={photo.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />

                        {/* Overlay Actions */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewPhoto(photo.fileUrl)}
                            className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-xl transition-colors cursor-pointer"
                            title="Agrandir"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(photo.id)}
                            className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-xl transition-colors cursor-pointer"
                            title="Supprimer cette photo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Photo badge number */}
                        <span className="absolute bottom-1.5 left-1.5 text-3xs font-mono font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-md">
                          #{index + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: COMMENTAIRES & SUIVI */}
          {activeTab === "comments" && (
            <div className="space-y-4 animate-fadeIn">
              {/* New comment form */}
              <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
                    <span>Rédiger un Nouveau Commentaire / Note d&apos;Intervention</span>
                  </span>
                  <span className="text-3xs text-gray-500 font-medium">
                    Auteur : <strong className="text-gray-800">{currentUserName}</strong>
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Ex : Accord d'expert obtenu, pièces commandées chez le fournisseur, véhicule prévu en sortie de garage vendredi..."
                  className="w-full p-3 bg-white border border-amber-300 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleAddComment}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter au Suivi</span>
                  </button>
                </div>
              </div>

              {/* Comments Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">
                  Historique des Commentaires ({comments.length})
                </h4>

                {comments.length === 0 ? (
                  <div className="p-6 text-center bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-400">
                    Aucun commentaire consigné pour le moment.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs space-y-1.5 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-navy/10 text-navy flex items-center justify-center text-3xs font-black">
                              <User className="w-3 h-3" />
                            </span>
                            <span className="text-xs font-extrabold text-navy">
                              {c.author || "Agent"}
                            </span>
                            <span className="text-3xs text-gray-400 font-mono">
                              {c.created_at
                                ? new Date(c.created_at).toLocaleDateString("fr-FR", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Récemment"}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveComment(c.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-600 transition-opacity p-1"
                            title="Supprimer ce commentaire"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p className="text-xs text-gray-700 whitespace-pre-wrap pl-8 leading-relaxed">
                          {c.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DÉTAILS DU SINISTRE */}
          {activeTab === "details" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Repair Type */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Type de Réparation
                  </label>
                  <select
                    value={repairType}
                    onChange={(e) => setRepairType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy/20"
                  >
                    {REPAIR_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Niveau de Priorité
                  </label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy/20"
                  >
                    <option value="Normal">🟢 Normal</option>
                    <option value="Urgent">🟠 Urgent</option>
                    <option value="Critical">🔴 Critique</option>
                  </select>
                </div>

                {/* Garage Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Garage / Atelier Cible
                  </label>
                  <input
                    type="text"
                    value={garageName}
                    onChange={(e) => setGarageName(e.target.value)}
                    placeholder="Ex: Emergence Auto, Atelier Central..."
                    list="garage-suggestions-list"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                  <datalist id="garage-suggestions-list">
                    {GARAGE_SUGGESTIONS.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>

                {/* Estimated Cost */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Coût Estimé (MAD)
                  </label>
                  <input
                    type="number"
                    value={estimatedCostMAD}
                    onChange={(e) => setEstimatedCostMAD(e.target.value)}
                    placeholder="Ex: 2500"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>

                {/* Reminder Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Date Prévue de Passage
                  </label>
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>

                {/* Reminder Time */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Heure du Rendez-vous
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Titre du Rappel / Sinistre
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre du dossier"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy/20"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description Détaillée des Dégâts & Travaux
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Détails techniques des réparations à effectuer..."
                  className="w-full p-3 bg-white border border-gray-300 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-2xs text-gray-500">
            <span className="font-semibold">{photos.length} photo(s)</span>
            <span>·</span>
            <span className="font-semibold">{comments.length} commentaire(s)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold border border-gray-200 transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSubmitting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Enregistrement..." : "Enregistrer les Modifications"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox / Zoom Modal for Photo */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-10 right-0 p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewPhoto}
              alt="Photo Dommage"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}
