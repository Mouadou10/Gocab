"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Trash2,
  Eye,
  Download,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Paperclip,
  Calendar,
  User,
  Shield,
  Loader2,
  ZoomIn,
  Search,
  Filter,
} from "lucide-react";
import toast from "react-hot-toast";

export interface VehicleDocument {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  category: "CARTE_GRISE" | "ASSURANCE" | "VISITE_TECHNIQUE" | "VIGNETTE" | "AUTORISATION" | "ATTESTATION" | "PHOTOS_VEHICULE" | "REPARATION" | "AUTRE";
  size?: number | null;
  author?: string | null;
  created_at: string;
}

export const VEHICLE_DOC_CATEGORIES = [
  { id: "CARTE_GRISE", label: "Carte Grise", icon: "📄", badgeColor: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "ASSURANCE", label: "Police d'Assurance", icon: "🛡️", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "VISITE_TECHNIQUE", label: "Visite Technique", icon: "🔍", badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "VIGNETTE", label: "Vignette Taxe", icon: "🏷️", badgeColor: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "AUTORISATION", label: "Autorisation Circulation", icon: "📜", badgeColor: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "ATTESTATION", label: "Attestation / Contrat", icon: "📝", badgeColor: "bg-teal-50 text-teal-700 border-teal-200" },
  { id: "PHOTOS_VEHICULE", label: "Photos du Véhicule", icon: "📸", badgeColor: "bg-rose-50 text-rose-700 border-rose-200" },
  { id: "REPARATION", label: "Devis / Facture Garage", icon: "🔧", badgeColor: "bg-orange-50 text-orange-700 border-orange-200" },
  { id: "AUTRE", label: "Autre Document", icon: "📁", badgeColor: "bg-slate-100 text-slate-700 border-slate-200" },
] as const;

interface VehicleDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: {
    id: string;
    plate_number: string;
    make_model: string;
    assigned_driver_name?: string | null;
    status?: string | null;
    documents?: string | null;
  } | null;
  onDocumentsUpdated?: (updatedDocs: VehicleDocument[]) => void;
}

export default function VehicleDocumentsModal({
  isOpen,
  onClose,
  vehicle,
  onDocumentsUpdated,
}: VehicleDocumentsModalProps) {
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<VehicleDocument["category"]>("CARTE_GRISE");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<"ALL" | "IMAGE" | "PDF">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents when modal opens or vehicle changes
  useEffect(() => {
    if (!isOpen || !vehicle?.id) {
      setDocuments([]);
      setPreviewDoc(null);
      return;
    }

    // Try parsing from vehicle prop first
    if (vehicle.documents) {
      try {
        const parsed = JSON.parse(vehicle.documents);
        if (Array.isArray(parsed)) {
          setDocuments(parsed);
        }
      } catch {
        // fallback to fetch
      }
    }

    // Fetch fresh from backend
    fetchDocuments(vehicle.id);
  }, [isOpen, vehicle?.id]);

  const fetchDocuments = async (vehicleId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/documents`);
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      if (Array.isArray(data.documents)) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error("Failed to load vehicle docs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !vehicle) return null;

  // Process files: optimize images with canvas, keep PDFs as dataUrl
  const processFile = (file: File): Promise<{ name: string; fileType: string; size: number; fileUrl: string }> => {
    return new Promise((resolve, reject) => {
      // 1. PDF
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        if (file.size > 15 * 1024 * 1024) {
          return reject(new Error(`Le fichier PDF "${file.name}" dépasse 15 Mo.`));
        }
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            fileType: "application/pdf",
            size: file.size,
            fileUrl: reader.result as string,
          });
        };
        reader.onerror = () => reject(new Error("Erreur de lecture du PDF."));
        reader.readAsDataURL(file);
        return;
      }

      // 2. Photos (JPEG, PNG, WEBP)
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const maxDim = 1600;
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
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              return resolve({
                name: file.name,
                fileType: file.type || "image/jpeg",
                size: file.size,
                fileUrl: reader.result as string,
              });
            }
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL("image/jpeg", 0.82);
            const approxSize = Math.round((compressed.length * 3) / 4);
            const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            resolve({
              name: cleanName,
              fileType: "image/jpeg",
              size: approxSize,
              fileUrl: compressed,
            });
          };
          img.onerror = () => {
            resolve({
              name: file.name,
              fileType: file.type || "image/jpeg",
              size: file.size,
              fileUrl: reader.result as string,
            });
          };
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Erreur de lecture de l'image."));
        reader.readAsDataURL(file);
        return;
      }

      // 3. Fallback generic
      if (file.size > 10 * 1024 * 1024) {
        return reject(new Error(`Le fichier "${file.name}" est trop volumineux (max 10 Mo).`));
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          name: file.name,
          fileType: file.type || "application/octet-stream",
          size: file.size,
          fileUrl: reader.result as string,
        });
      };
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
      reader.readAsDataURL(file);
    });
  };

  const handleFilesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const toastId = toast.loading(`Téléversement de ${files.length} document(s)...`);

    try {
      const processedDocs: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const res = await processFile(file);
          processedDocs.push({
            ...res,
            category: uploadCategory,
          });
        } catch (err: any) {
          toast.error(err.message || `Impossible de lire ${file.name}`);
        }
      }

      if (processedDocs.length === 0) {
        toast.dismiss(toastId);
        setIsUploading(false);
        return;
      }

      const res = await fetch(`/api/vehicles/${vehicle.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: processedDocs }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Échec de l'enregistrement des documents");
      }

      const data = await res.json();
      setDocuments(data.documents);
      if (onDocumentsUpdated) {
        onDocumentsUpdated(data.documents);
      }
      toast.success(`${processedDocs.length} document(s) enregistré(s) avec succès !`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur de téléversement", { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (docId: string, docName: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer "${docName}" ?`)) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}/documents?documentId=${docId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Erreur lors de la suppression");
      const data = await res.json();
      setDocuments(data.documents);
      if (onDocumentsUpdated) {
        onDocumentsUpdated(data.documents);
      }
      if (previewDoc?.id === docId) {
        setPreviewDoc(null);
      }
      toast.success("Document supprimé");
    } catch (err: any) {
      toast.error(err.message || "Impossible de supprimer le document");
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return "Taille inconnue";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const isImageDoc = (doc: VehicleDocument) => {
    return (
      doc.fileType.startsWith("image/") ||
      doc.fileUrl.startsWith("data:image/") ||
      /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.name)
    );
  };

  const isPdfDoc = (doc: VehicleDocument) => {
    return (
      doc.fileType === "application/pdf" ||
      doc.fileUrl.startsWith("data:application/pdf") ||
      doc.name.toLowerCase().endsWith(".pdf")
    );
  };

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    if (filterCategory !== "ALL" && doc.category !== filterCategory) return false;
    if (filterType === "IMAGE" && !isImageDoc(doc)) return false;
    if (filterType === "PDF" && !isPdfDoc(doc)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = doc.name.toLowerCase().includes(q);
      const matchCat = doc.category.toLowerCase().includes(q);
      const matchAuthor = (doc.author || "").toLowerCase().includes(q);
      if (!matchName && !matchCat && !matchAuthor) return false;
    }
    return true;
  });

  const photoCount = documents.filter(isImageDoc).length;
  const pdfCount = documents.filter(isPdfDoc).length;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-navy/10 text-navy flex items-center justify-center shrink-0">
                <Paperclip className="w-5 h-5 text-navy" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-navy tracking-tight truncate">
                    Documents du Véhicule : <span className="font-mono text-blue-600">{vehicle.plate_number}</span>
                  </h3>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {vehicle.make_model}
                  </span>
                  {vehicle.assigned_driver_name && (
                    <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {vehicle.assigned_driver_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consulter, prévisualiser et ajouter des photos (carte grise, état) ou documents PDF réglementaires.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer shrink-0 ml-2"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 overflow-y-auto space-y-5 flex-1">
            {/* 1. Upload Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFilesUpload(e.dataTransfer.files);
              }}
              className={`rounded-2xl border-2 border-dashed p-4 sm:p-5 transition-all ${
                isDragging
                  ? "border-navy bg-blue-50/70 scale-[0.99]"
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 text-navy mt-0.5">
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 text-navy animate-spin" />
                    ) : (
                      <UploadCloud className="w-5 h-5 text-navy" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Ajouter un nouveau document</span>
                      <span className="text-2xs font-normal text-slate-500">(Photos JPG, PNG ou PDF)</span>
                    </h4>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      Glissez vos fichiers ici ou cliquez sur le bouton. Les photos sont automatiquement optimisées.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Category select */}
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                    <span className="text-2xs font-semibold text-slate-500">Type :</span>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as any)}
                      disabled={isUploading}
                      className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                    >
                      {VEHICLE_DOC_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Upload button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3 py-1.5 bg-navy hover:bg-navy/90 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Téléversement...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Choisir un fichier</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handleFilesUpload(e.target.files)}
                  />
                </div>
              </div>
            </div>

            {/* 2. Filter Bar & Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory("ALL");
                    setFilterType("ALL");
                  }}
                  className={`px-3 py-1 rounded-xl font-bold transition-all ${
                    filterCategory === "ALL" && filterType === "ALL"
                      ? "bg-navy text-white shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  Tous ({documents.length})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType((prev) => (prev === "IMAGE" ? "ALL" : "IMAGE"))}
                  className={`px-2.5 py-1 rounded-xl font-medium transition-all flex items-center gap-1 ${
                    filterType === "IMAGE"
                      ? "bg-rose-600 text-white shadow-2xs font-bold"
                      : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60"
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  <span>Photos ({photoCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType((prev) => (prev === "PDF" ? "ALL" : "PDF"))}
                  className={`px-2.5 py-1 rounded-xl font-medium transition-all flex items-center gap-1 ${
                    filterType === "PDF"
                      ? "bg-red-600 text-white shadow-2xs font-bold"
                      : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/60"
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>PDF ({pdfCount})</span>
                </button>

                {/* Category dropdown filter */}
                <div className="relative inline-block ml-1">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded-xl border-none focus:outline-hidden cursor-pointer"
                  >
                    <option value="ALL">Toutes catégories</option>
                    {VEHICLE_DOC_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-56 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par nom..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-navy transition-colors"
                />
              </div>
            </div>

            {/* 3. Documents Grid */}
            {isLoading ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-navy" />
                <p className="text-xs">Chargement des documents...</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="py-14 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="text-sm font-bold text-slate-700">Aucun document trouvé</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {documents.length === 0
                    ? "Aucun document ni photo n'a encore été ajouté pour ce véhicule. Utilisez la zone ci-dessus pour téléverser votre premier fichier."
                    : "Aucun document ne correspond à vos filtres actuels."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredDocs.map((doc) => {
                  const isImg = isImageDoc(doc);
                  const isPdf = isPdfDoc(doc);
                  const categoryInfo = VEHICLE_DOC_CATEGORIES.find((c) => c.id === doc.category) || {
                    id: doc.category,
                    label: doc.category,
                    icon: "📁",
                    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
                  };

                  return (
                    <div
                      key={doc.id}
                      className="group bg-white rounded-xl border border-slate-200 hover:border-navy/40 hover:shadow-md transition-all flex flex-col overflow-hidden relative"
                    >
                      {/* Thumbnail / Header Area */}
                      <div
                        onClick={() => setPreviewDoc(doc)}
                        className="relative h-32 bg-slate-100 cursor-pointer overflow-hidden flex items-center justify-center border-b border-slate-100"
                      >
                        {isImg ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={doc.fileUrl}
                              alt={doc.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-bold">
                              <Eye className="w-4 h-4" />
                              <span>Agrandir</span>
                            </div>
                          </>
                        ) : isPdf ? (
                          <div className="flex flex-col items-center justify-center text-red-600 gap-1.5 p-3 text-center">
                            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                              <FileText className="w-6 h-6 text-red-600" />
                            </div>
                            <span className="text-2xs font-bold text-red-700 uppercase tracking-wider">Document PDF</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5 p-3 text-center">
                            <Paperclip className="w-8 h-8 text-slate-400" />
                            <span className="text-2xs font-semibold">Fichier</span>
                          </div>
                        )}

                        {/* Category Badge Top-Left */}
                        <div className="absolute top-2 left-2 z-10">
                          <span
                            className={`text-3xs font-bold px-2 py-0.5 rounded-full border shadow-2xs flex items-center gap-1 ${categoryInfo.badgeColor} backdrop-blur-xs`}
                          >
                            <span>{categoryInfo.icon}</span>
                            <span className="truncate max-w-[120px]">{categoryInfo.label}</span>
                          </span>
                        </div>
                      </div>

                      {/* File Info */}
                      <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <p
                            onClick={() => setPreviewDoc(doc)}
                            className="text-xs font-bold text-slate-800 truncate hover:text-navy cursor-pointer"
                            title={doc.name}
                          >
                            {doc.name}
                          </p>
                          <div className="flex items-center gap-2 text-3xs text-slate-500 mt-1 flex-wrap">
                            <span>{formatFileSize(doc.size)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              {new Date(doc.created_at).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          {doc.author && (
                            <p className="text-3xs text-slate-400 mt-0.5 truncate flex items-center gap-1">
                              <User className="w-2.5 h-2.5" />
                              <span>{doc.author}</span>
                            </p>
                          )}
                        </div>

                        {/* Actions Toolbar */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="text-navy hover:text-blue-700 font-bold text-2xs flex items-center gap-1 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Aperçu</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <a
                              href={doc.fileUrl}
                              download={doc.name}
                              className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                              title="Télécharger"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>

                            <button
                              type="button"
                              onClick={() => handleDelete(doc.id, doc.name)}
                              disabled={deletingId === doc.id}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                              title="Supprimer"
                            >
                              {deletingId === doc.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>
              Total : <strong className="text-slate-700">{documents.length}</strong> document(s) enregistré(s)
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox / Full Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="min-w-0 pr-4">
                <h4 className="text-sm font-bold truncate text-white">{previewDoc.name}</h4>
                <p className="text-2xs text-slate-400 mt-0.5">
                  {formatFileSize(previewDoc.size)} • Ajouté le{" "}
                  {new Date(previewDoc.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {previewDoc.author ? ` par ${previewDoc.author}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewDoc.fileUrl}
                  download={previewDoc.name}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Télécharger</span>
                </a>

                {isPdfDoc(previewDoc) && (
                  <a
                    href={previewDoc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ouvrir dans un onglet</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-950 min-h-[400px]">
              {isImageDoc(previewDoc) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewDoc.fileUrl}
                  alt={previewDoc.name}
                  className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              ) : isPdfDoc(previewDoc) ? (
                <iframe
                  src={previewDoc.fileUrl}
                  title={previewDoc.name}
                  className="w-full h-[75vh] rounded-lg border border-slate-800 bg-white"
                />
              ) : (
                <div className="text-center py-12 space-y-3">
                  <FileText className="w-16 h-16 text-slate-500 mx-auto" />
                  <p className="text-sm text-slate-300">Aperçu direct non disponible pour ce type de fichier.</p>
                  <a
                    href={previewDoc.fileUrl}
                    download={previewDoc.name}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white rounded-xl text-xs font-bold"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger le fichier</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
