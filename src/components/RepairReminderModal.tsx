"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Car,
  Calendar,
  Clock,
  Camera,
  Upload,
  Trash2,
  Wrench,
  AlertTriangle,
  Building,
  DollarSign,
  FileText,
  CheckCircle2,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import RedFlagBadge from "./RedFlagBadge";

export interface RepairPhoto {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  size: number;
  uploaded_at: string;
}

interface VehicleItem {
  id: string;
  plate_number: string;
  make_model?: string;
  hub_city?: string;
  status?: string;
  assigned_driver_name?: string | null;
  assigned_driver_phone?: string | null;
  is_driver_red_flagged?: boolean;
  driver_red_flag_reason?: string | null;
}

interface RepairReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialVehicle?: VehicleItem | null;
  vehicles: VehicleItem[];
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
  "Atelier Central GoCab",
  "Garage Atlas Casablanca",
  "Carrosserie Moderne Rabat",
  "Garage Partenaire Sidi Maarouf",
  "Atelier Dépannage Express",
];

export default function RepairReminderModal({
  isOpen,
  onClose,
  onSuccess,
  initialVehicle,
  vehicles,
}: RepairReminderModalProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [repairType, setRepairType] = useState<string>("Carrosserie & Peinture");
  const [garageName, setGarageName] = useState("");
  const [estimatedCostMAD, setEstimatedCostMAD] = useState("");
  const [priority, setPriority] = useState<"Normal" | "Urgent" | "Critical">("Normal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentNotes, setAgentNotes] = useState("");

  const [photos, setPhotos] = useState<RepairPhoto[]>([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close vehicle dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Pre-fill default date to tomorrow
  useEffect(() => {
    if (isOpen) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
      const dd = String(tomorrow.getDate()).padStart(2, "0");
      setReminderDate(`${yyyy}-${mm}-${dd}`);

      if (initialVehicle) {
        setSelectedVehicleId(initialVehicle.id);
      }
    }
  }, [isOpen, initialVehicle]);

  if (!isOpen) return null;

  const currentVehicle =
    vehicles.find((v) => v.id === selectedVehicleId) || initialVehicle;

  // Filter vehicles for combobox
  const filteredVehicles = vehicles.filter((v) => {
    if (!vehicleSearch.trim()) return true;
    const q = vehicleSearch.toLowerCase().trim();
    return (
      v.plate_number.toLowerCase().includes(q) ||
      (v.make_model && v.make_model.toLowerCase().includes(q)) ||
      (v.assigned_driver_name && v.assigned_driver_name.toLowerCase().includes(q))
    );
  });

  // Shortcut date setters
  const setQuickDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setReminderDate(`${yyyy}-${mm}-${dd}`);
  };

  const setNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setReminderDate(`${yyyy}-${mm}-${dd}`);
  };

  // Image compressor using HTML5 canvas
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
      toast.success(`${newItems.length} photo(s) ajoutée(s) !`);
    } catch (err: any) {
      toast.error(err.message || "Erreur de traitement des photos");
    } finally {
      setIsProcessingPhotos(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVehicleId && !initialVehicle) {
      toast.error("Veuillez sélectionner un véhicule.");
      return;
    }

    if (!reminderDate) {
      toast.error("Veuillez sélectionner une date de rappel.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        vehicle_id: selectedVehicleId || initialVehicle?.id,
        plate_number: currentVehicle?.plate_number,
        driver_name: currentVehicle?.assigned_driver_name,
        driver_phone: currentVehicle?.assigned_driver_phone,
        reminder_date: reminderDate,
        reminder_time: reminderTime || "09:00",
        garage_name: garageName || null,
        repair_type: repairType,
        title:
          title.trim() ||
          `Rappel Réparation ${repairType} - ${currentVehicle?.plate_number}`,
        description:
          description.trim() ||
          `Véhicule planifié pour passage en garage / réparation (${repairType})`,
        photos,
        estimated_cost_mad: estimatedCostMAD ? Number(estimatedCostMAD) : 0,
        priority,
        agent_notes: agentNotes.trim() || null,
      };

      const res = await fetch("/api/insurance/repair-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Échec de l'enregistrement du rappel");
      }

      toast.success(
        `⏰ Rappel de réparation programmé pour le ${reminderDate} (${currentVehicle?.plate_number}) !`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error creating repair reminder:", err);
      toast.error(err.message || "Erreur de création du rappel");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy via-[#1e3a5f] to-[#0f1e35] p-5 sm:p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Programmer un Rappel Réparation Véhicule
              </h2>
              <p className="text-xs text-white/70">
                Planification de passage au garage avec photos de chocs & alerte d&apos;échéance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Section 1: Vehicle Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
              <span>Véhicule Concerné <span className="text-red-500">*</span></span>
              {currentVehicle?.is_driver_red_flagged && (
                <RedFlagBadge reason={currentVehicle.driver_red_flag_reason} />
              )}
            </label>

            {currentVehicle && selectedVehicleId ? (
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 shadow-2xs ${
                  currentVehicle.is_driver_red_flagged
                    ? "bg-red-50/70 border-red-300"
                    : "bg-blue-50/70 border-blue-200"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-xs bg-navy text-white px-2 py-0.5 rounded-lg shadow-2xs">
                      🚗 {currentVehicle.plate_number}
                    </span>
                    <span className="text-xs font-bold text-gray-800">
                      {currentVehicle.make_model || "Véhicule Flotte"}
                    </span>
                    {currentVehicle.is_driver_red_flagged && (
                      <RedFlagBadge reason={currentVehicle.driver_red_flag_reason} />
                    )}
                  </div>
                  <div className="text-2xs text-gray-600 flex items-center gap-2 pt-0.5 flex-wrap">
                    <span>📍 {currentVehicle.hub_city || "Casablanca"}</span>
                    <span>·</span>
                    <span>
                      Chauffeur :{" "}
                      <strong className={currentVehicle.is_driver_red_flagged ? "text-red-700 font-bold" : "text-gray-900"}>
                        {currentVehicle.assigned_driver_name || "Non assigné"}
                      </strong>
                    </span>
                  </div>
                </div>

                {!initialVehicle && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVehicleId("");
                      setVehicleSearch("");
                      setIsDropdownOpen(true);
                    }}
                    className="text-2xs font-bold text-navy bg-white hover:bg-gray-100 px-2.5 py-1.5 rounded-xl border border-gray-200 transition-colors shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <X className="w-3 h-3" />
                    <span>Changer</span>
                  </button>
                )}
              </div>
            ) : (
              <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <Car className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tapez le matricule (ex: 12345-A-6) ou le nom..."
                    value={vehicleSearch}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setVehicleSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-navy/30 focus:border-navy focus:outline-none"
                  />
                </div>

                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-gray-100 animate-fadeIn">
                    {filteredVehicles.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-400">
                        Aucun véhicule trouvé
                      </div>
                    ) : (
                      filteredVehicles.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedVehicleId(v.id);
                            setIsDropdownOpen(false);
                            setVehicleSearch("");
                          }}
                          className={`w-full p-2.5 text-left transition-colors flex items-center justify-between cursor-pointer ${
                            v.is_driver_red_flagged
                              ? "hover:bg-red-50/80 bg-red-50/20"
                              : "hover:bg-blue-50/70"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs bg-navy/5 text-navy px-2 py-0.5 rounded-md border border-navy/10">
                                {v.plate_number}
                              </span>
                              <span className="text-xs font-semibold text-gray-800">
                                {v.make_model || "Véhicule"}
                              </span>
                              {v.is_driver_red_flagged && (
                                <RedFlagBadge reason={v.driver_red_flag_reason} />
                              )}
                            </div>
                            <p className="text-3xs text-gray-500">
                              📍 {v.hub_city || "Casablanca"} · Chauffeur: {v.assigned_driver_name || "Sans chauffeur"}
                            </p>
                          </div>
                          <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {v.status || "Actif"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Photo Attachment / Damage Photos */}
          <div className="space-y-2 p-4 bg-gray-50/70 rounded-2xl border border-gray-200/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-navy" />
                <span>Photos de Dommages & Pièces à Réparer ({photos.length})</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPhotos}
                className="text-2xs font-bold text-navy bg-white hover:bg-navy/5 px-2.5 py-1 rounded-xl border border-gray-200 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Ajouter Photos</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handlePhotoFiles(e.target.files)}
              className="hidden"
            />

            {/* Dropzone / Upload area */}
            {photos.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-navy/50 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-white/70"
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-700">
                  Cliquez ou glissez les photos du véhicule ici
                </p>
                <p className="text-3xs text-gray-400 mt-1">
                  Chocs, carrosserie, pare-chocs, vitrage ou devis garage (JPEG, PNG, WebP)
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="relative group rounded-xl overflow-hidden border border-gray-200 bg-black aspect-video flex items-center justify-center shadow-2xs"
                  >
                    <img
                      src={p.fileUrl}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(p.id)}
                        className="p-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        title="Supprimer la photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed border-gray-300 hover:border-navy text-gray-400 hover:text-navy flex flex-col items-center justify-center gap-1 aspect-video text-xs font-bold transition-colors bg-white/50 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-3xs">Ajouter</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 3: Reminder Date & Time */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-navy" />
                <span>Date de Rappel pour le Dépôt <span className="text-red-500">*</span></span>
              </label>
              {/* Quick shortcut pills */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="text-3xs font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-navy/10 hover:text-navy transition-colors"
                >
                  Demain
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(3)}
                  className="text-3xs font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-navy/10 hover:text-navy transition-colors"
                >
                  +3 jours
                </button>
                <button
                  type="button"
                  onClick={setNextMonday}
                  className="text-3xs font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-navy/10 hover:text-navy transition-colors"
                >
                  Lundi Prochain
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(7)}
                  className="text-3xs font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-navy/10 hover:text-navy transition-colors"
                >
                  +1 semaine
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-navy focus:ring-2 focus:ring-navy/30 focus:outline-none"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-navy/30 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Repair Type & Target Garage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Type d&apos;Intervention
              </label>
              <select
                value={repairType}
                onChange={(e) => setRepairType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-navy/30 focus:outline-none"
              >
                {REPAIR_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Garage / Atelier Cible
              </label>
              <input
                type="text"
                list="garage-suggestions"
                placeholder="ex: Garage Atlas ou Atelier GoCab"
                value={garageName}
                onChange={(e) => setGarageName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-navy/30 focus:outline-none"
              />
              <datalist id="garage-suggestions">
                {GARAGE_SUGGESTIONS.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Section 5: Estimated Cost & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Coût Estimé (MAD)
              </label>
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="0.00"
                  value={estimatedCostMAD}
                  onChange={(e) => setEstimatedCostMAD(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-navy focus:ring-2 focus:ring-navy/30 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Priorité du Rappel
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-navy/30 focus:outline-none"
              >
                <option value="Normal">🟢 Normal (Prévu sous 3-7 jours)</option>
                <option value="Urgent">🟠 Urgent (Sécurité / À déposer demain)</option>
                <option value="Critical">🔴 Critique (Immobilisation requise)</option>
              </select>
            </div>
          </div>

          {/* Section 6: Description & Work Details */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Détails des Réparations / Instructions Garage
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Remplacement pare-choc avant droit suite accrochage, retouche aile, phare fissuré..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-800 focus:ring-2 focus:ring-navy/30 focus:outline-none"
            />
          </div>

          {/* Section 7: Internal Agent Note */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Note Interne Agent
            </label>
            <input
              type="text"
              placeholder="Ex: Chauffeur prévenu par WhatsApp, apporter bon de commande..."
              value={agentNotes}
              onChange={(e) => setAgentNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-800 focus:ring-2 focus:ring-navy/30 focus:outline-none"
            />
          </div>

          {/* Submit & Cancel Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedVehicleId || !reminderDate}
              className="px-6 py-2.5 bg-navy hover:bg-navy/90 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-amber-300" />
              <span>{isSubmitting ? "Enregistrement..." : "Programmer le Rappel"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
