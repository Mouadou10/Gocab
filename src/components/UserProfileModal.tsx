"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Camera,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  Shield,
  Trash2,
  Sparkles,
  MapPin,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    image?: string | null;
  };
  onProfileUpdated: (data: { name: string; fullName?: string; image?: string | null }) => void;
}

const PRESET_AVATARS = [
  "👩‍💼",
  "🧑‍💼",
  "👩‍💻",
  "🧑‍💻",
  "🚖",
  "⚡",
  "🛡️",
  "🌟",
  "💼",
  "🚀",
];

export default function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
}: UserProfileModalProps) {
  const [name, setName] = useState(currentUser.name || "");
  const [fullName, setFullName] = useState(currentUser.name || "");
  const [avatarImage, setAvatarImage] = useState<string | null>(currentUser.image || null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load latest profile info from API on open
  useEffect(() => {
    if (!isOpen) return;

    setName(currentUser.name || "");
    setFullName(currentUser.name || "");
    setAvatarImage(currentUser.image || null);
    setIsChangingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    setIsLoading(true);
    fetch("/api/users/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setName(data.user.name || currentUser.name || "");
          setFullName(data.user.fullName || data.user.name || currentUser.name || "");
          if (data.user.image) {
            setAvatarImage(data.user.image);
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Compress & convert uploaded image to compact base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image valide (PNG, JPEG, WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image est trop volumineuse (max 5 Mo)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85);
          setAvatarImage(compressedBase64);
          toast.success("Photo sélectionnée avec succès !", { icon: "📸" });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (preset: string) => {
    setAvatarImage(preset);
    toast.success(`Avatar ${preset} sélectionné !`, { icon: "✨" });
  };

  const handleRemovePhoto = () => {
    setAvatarImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast("Photo supprimée", { icon: "🗑️" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Le nom ne peut pas être vide");
      return;
    }

    if (isChangingPassword) {
      if (!currentPassword) {
        toast.error("Veuillez saisir votre mot de passe actuel");
        return;
      }
      if (newPassword.length < 8) {
        toast.error("Le nouveau mot de passe doit comporter au moins 8 caractères");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error("Les deux nouveaux mots de passe ne correspondent pas");
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        fullName: fullName.trim() || name.trim(),
        image: avatarImage,
      };

      if (isChangingPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Profil mis à jour avec succès !", { icon: "✅" });
        onProfileUpdated({
          name: data.user.name,
          fullName: data.user.fullName,
          image: data.user.image,
        });
        onClose();
      } else {
        toast.error(data.error || "Échec de mise à jour du profil");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur réseau");
    } finally {
      setIsSaving(false);
    }
  };

  // User initials
  const initials = (name || currentUser.name || "Agent")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isPreset = avatarImage && avatarImage.length <= 4;
  const isCustomImage = avatarImage && avatarImage.startsWith("data:image");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden relative">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-navy to-blue-600 flex items-center justify-center text-white shadow-sm shadow-navy/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-900 tracking-tight">
                Mon Profil Agent
              </h2>
              <p className="text-[11px] text-gray-500">
                Personnalisez votre nom, photo et mot de passe
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-thin">
          {/* Avatar Section */}
          <div className="flex flex-col items-center pb-5 border-b border-gray-100">
            <div className="relative group">
              <div className="w-24 h-24 rounded-3xl overflow-hidden bg-gradient-to-tr from-navy/10 via-blue-50 to-indigo-100 flex items-center justify-center border-4 border-white shadow-xl ring-2 ring-gray-100 text-3xl font-black text-navy transition-all">
                {isCustomImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarImage!}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : isPreset ? (
                  <span className="text-4xl select-none">{avatarImage}</span>
                ) : (
                  <span className="text-2xl text-navy font-black tracking-wider">
                    {initials}
                  </span>
                )}
              </div>

              {/* Status Online Pill */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-xs" title="En ligne">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </div>

              {/* Quick upload trigger overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-3xl bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] font-bold cursor-pointer"
              >
                <Camera className="w-5 h-5 mb-0.5" />
                <span>Changer</span>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
            />

            {/* Avatar Action Buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Camera className="w-3.5 h-3.5 text-navy" />
                <span>Importer une photo</span>
              </button>

              {avatarImage && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer"
                  title="Supprimer la photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Avatar Presets */}
            <div className="mt-3 w-full">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block text-center mb-1.5">
                Ou choisissez un avatar prédéfini :
              </span>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {PRESET_AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelectPreset(emoji)}
                    className={`w-8 h-8 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer border ${
                      avatarImage === emoji
                        ? "bg-blue-100 border-blue-400 shadow-xs scale-110"
                        : "bg-gray-50 border-gray-200/80 hover:bg-gray-100"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Identity Fields */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-navy" />
                <span>Nom d&apos;affichage (Affiché sur le CRM & WhatsApp)</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Kaoutar Ouardi"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-navy/20 focus:border-navy focus:outline-none transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span>Nom complet</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Kaoutar Ouardi"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-navy/20 focus:border-navy focus:outline-none transition-all"
              />
            </div>

            {/* Read-only Account Info Badge */}
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Adresse e-mail de connexion</span>
                  <p className="font-mono font-bold text-gray-800 text-xs truncate">
                    {currentUser.email || "agent@gocab.io"}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-navy/10 text-navy">
                  {currentUser.role || "LEAD_ACQUISITION_JR"}
                </span>
                <p className="text-[9px] text-gray-400 mt-0.5 flex items-center justify-end gap-1">
                  <MapPin className="w-2.5 h-2.5" /> Casablanca
                </p>
              </div>
            </div>
          </div>

          {/* Password Security Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black text-gray-900">Sécurité & Mot de Passe</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(!isChangingPassword);
                  if (!isChangingPassword) {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isChangingPassword
                    ? "bg-amber-100 text-amber-900"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {isChangingPassword ? "Annuler le changement" : "Modifier mon mot de passe"}
              </button>
            </div>

            {isChangingPassword && (
              <div className="mt-3 space-y-3 bg-amber-50/50 p-4 rounded-2xl border border-amber-200/80 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Mot de passe actuel
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-10 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Nouveau mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 caractères"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-10 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Confirmer nouveau mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPass ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirmer mot de passe"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-10 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {newPassword && (
                  <div className="text-[10px] space-y-1 pt-1">
                    <p className={`flex items-center gap-1 font-semibold ${newPassword.length >= 8 ? "text-emerald-700" : "text-gray-400"}`}>
                      <Check className="w-3 h-3" /> Minimum 8 caractères
                    </p>
                    <p className={`flex items-center gap-1 font-semibold ${newPassword === confirmPassword && confirmPassword.length > 0 ? "text-emerald-700" : "text-gray-400"}`}>
                      <Check className="w-3 h-3" /> Les mots de passe correspondent
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-gradient-to-tr from-navy to-blue-700 hover:from-slate-900 hover:to-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-navy/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enregistrement…</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Enregistrer mon profil</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
