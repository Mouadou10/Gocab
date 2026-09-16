"use client";

import React, { useState, useEffect } from "react";
import {
  CATALOG_ITEMS,
  BonDeCommandeData,
  BonDeCommandeItem,
  calculateBonDeCommandeTotals,
  getFormattedToday,
  CatalogItem,
  printBonDeCommande,
} from "@/lib/bonDeCommandeCatalog";
import { GOCAB_OFFICIAL_LOGO_BASE64 } from "@/lib/gocabOfficialLogo";
import { Printer, Check, Plus, Trash2, X, Car, FileText, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

interface BonDeCommandeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: BonDeCommandeData) => void;
  initialData?: Partial<BonDeCommandeData> | null;
  readOnly?: boolean;
}

export default function BonDeCommandeModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  readOnly = false,
}: BonDeCommandeModalProps) {
  const [bcNumber, setBcNumber] = useState<string>(initialData?.bc_number || "");
  const [date, setDate] = useState<string>(initialData?.date || getFormattedToday());
  const [supplierName, setSupplierName] = useState<string>(initialData?.supplier_name || "Hard Auto Services");
  
  // Vehicle details
  const [vehicleMakeModel, setVehicleMakeModel] = useState<string>(initialData?.vehicle_make_model || "");
  const [vehiclePlate, setVehiclePlate] = useState<string>(initialData?.vehicle_plate || "");
  const [vehicleMileage, setVehicleMileage] = useState<string>(initialData?.vehicle_mileage || "");
  const [vehicleVin, setVehicleVin] = useState<string>(initialData?.vehicle_vin || "");

  // Line items
  const [items, setItems] = useState<BonDeCommandeItem[]>(initialData?.items && initialData.items.length > 0 ? initialData.items : []);

  // Extra conditions
  const [executionDelay, setExecutionDelay] = useState<string>(initialData?.execution_delay || getFormattedToday());
  const [observations, setObservations] = useState<string>(initialData?.observations || "N/A");

  // Signatory
  const [validatorName, setValidatorName] = useState<string>(initialData?.validator_name || "Hamza RASSID");
  const [validatorRole, setValidatorRole] = useState<string>(initialData?.validator_role || "Gérant");
  const [isValidated, setIsValidated] = useState<boolean>(initialData?.validated || false);

  // UI state
  const [showCatalogTray, setShowCatalogTray] = useState<boolean>(!readOnly);
  const [customDesignation, setCustomDesignation] = useState<string>("");
  const [customPriceTTC, setCustomPriceTTC] = useState<string>("");

  useEffect(() => {
    if (initialData) {
      if (initialData.bc_number !== undefined) setBcNumber(initialData.bc_number || "");
      if (initialData.date) setDate(initialData.date);
      if (initialData.supplier_name) setSupplierName(initialData.supplier_name);
      if (initialData.vehicle_make_model) setVehicleMakeModel(initialData.vehicle_make_model);
      if (initialData.vehicle_plate) setVehiclePlate(initialData.vehicle_plate);
      if (initialData.vehicle_mileage) setVehicleMileage(initialData.vehicle_mileage);
      if (initialData.vehicle_vin) setVehicleVin(initialData.vehicle_vin);
      if (initialData.items && initialData.items.length > 0) setItems(initialData.items);
      if (initialData.execution_delay) setExecutionDelay(initialData.execution_delay);
      if (initialData.observations) setObservations(initialData.observations);
      if (initialData.validator_name) setValidatorName(initialData.validator_name);
      if (initialData.validator_role) setValidatorRole(initialData.validator_role);
      if (initialData.validated !== undefined) setIsValidated(initialData.validated);
    }
  }, [initialData]);

  if (!isOpen) return null;

  const totals = calculateBonDeCommandeTotals(items);

  // Add from catalog
  const handleAddCatalogItem = (catItem: CatalogItem) => {
    const existingIndex = items.findIndex((i) => i.designation === catItem.designation);
    if (existingIndex >= 0) {
      const updated = [...items];
      const newQty = updated[existingIndex].quantity + 1;
      updated[existingIndex].quantity = newQty;
      updated[existingIndex].total_ttc = Math.round(newQty * updated[existingIndex].unit_price_ttc * 100) / 100;
      setItems(updated);
      toast.success(`Quantité augmentée pour "${catItem.designation}"`);
    } else {
      const newItem: BonDeCommandeItem = {
        id: "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        designation: catItem.designation,
        quantity: catItem.default_qty || 1,
        unit_price_ttc: catItem.price_ttc,
        total_ttc: catItem.price_ttc,
      };
      setItems([...items, newItem]);
      toast.success(`"${catItem.designation}" ajouté au Bon de Commande`);
    }
  };

  // Add custom line
  const handleAddCustomItem = () => {
    if (!customDesignation.trim()) {
      toast.error("Veuillez saisir une désignation.");
      return;
    }
    const priceNum = parseFloat(customPriceTTC);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Veuillez saisir un tarif valide en TTC.");
      return;
    }
    const newItem: BonDeCommandeItem = {
      id: "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      designation: customDesignation.trim(),
      quantity: 1,
      unit_price_ttc: priceNum,
      total_ttc: priceNum,
      is_custom: true,
    };
    setItems([...items, newItem]);
    setCustomDesignation("");
    setCustomPriceTTC("");
    toast.success(`Ligne personnalisée ajoutée`);
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    const updated = [...items];
    updated[index].quantity = newQty;
    updated[index].total_ttc = Math.round(newQty * updated[index].unit_price_ttc * 100) / 100;
    setItems(updated);
  };

  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    if (newPrice < 0) return;
    const updated = [...items];
    updated[index].unit_price_ttc = newPrice;
    updated[index].total_ttc = Math.round(updated[index].quantity * newPrice * 100) / 100;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
  };

  const getCurrentData = (): BonDeCommandeData => {
    return {
      bc_number: bcNumber.trim(),
      date,
      issuer_name: "GoCab Rent",
      issuer_address: "84 Rue Ibnou Mounir, Centre Andalucia, Maarif – Casablanca",
      issuer_legal: "RC : 707687 / Patente : 35707832 / IF : 70997186",
      issuer_phone: "0662 70 91 79",
      supplier_name: supplierName.trim() || "Hard Auto Services",
      vehicle_make_model: vehicleMakeModel.trim(),
      vehicle_plate: vehiclePlate.trim(),
      vehicle_mileage: vehicleMileage.trim(),
      vehicle_vin: vehicleVin.trim(),
      items,
      total_ht: totals.total_ht,
      tva_rate: totals.tva_rate,
      tva_amount: totals.tva_amount,
      total_ttc: totals.total_ttc,
      execution_delay: executionDelay.trim() || date,
      observations: observations.trim() || "N/A",
      validator_name: validatorName.trim() || "Hamza RASSID",
      validator_role: validatorRole.trim() || "Gérant",
      validated: true,
      validated_at: new Date().toISOString(),
    };
  };

  const handleValidateAndSave = () => {
    const data = getCurrentData();
    setIsValidated(true);
    if (onSave) {
      onSave(data);
    }
  };

  const handlePrint = () => {
    const data = getCurrentData();
    printBonDeCommande(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-xs">
      {/* Main Modal Container */}
      <div className="relative w-full max-w-4xl bg-gray-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] bg-white">
        {/* Modal Top Bar (Screen only) */}
        <div className="no-print bg-navy px-6 py-4 flex items-center justify-between text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-white/10 rounded-xl text-lg">📝</span>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Bon de Commande — GoCab Rent</span>
                {isValidated && (
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-emerald-400/30 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Validé
                  </span>
                )}
              </h2>
              <p className="text-xs text-white/70">
                Génération, chiffrage automatique HT/TTC et validation avant impression
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Imprimer ou enregistrer en PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 print:p-0 print:overflow-visible">
          {/* Catalog & Quick Picker Tray (Screen only) */}
          {!readOnly && (
            <div className="no-print bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-navy flex items-center gap-1.5">
                    <span>🏷️</span> Catalogue Tarifs & Prestations
                  </span>
                  <span className="text-3xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-semibold">
                    Cliquez pour ajouter directement
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCatalogTray(!showCatalogTray)}
                  className="text-xs text-gray-500 hover:text-navy font-semibold flex items-center gap-1"
                >
                  {showCatalogTray ? (
                    <>
                      <span>Masquer</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Afficher</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {showCatalogTray && (
                <div className="space-y-3 pt-1 border-t border-gray-100 animate-fadeIn">
                  {/* Category groups */}
                  <div>
                    <span className="text-3xs font-black uppercase text-gray-400 tracking-wider">
                      Entretien courant (TTC)
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {CATALOG_ITEMS.filter((i) => i.category === "Entretien").map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleAddCatalogItem(item)}
                          className="px-2.5 py-1.5 bg-blue-50/80 hover:bg-blue-100 text-blue-900 border border-blue-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                        >
                          <span>{item.designation}</span>
                          <span className="font-mono font-bold bg-white px-1.5 py-0.2 rounded text-blue-700 border border-blue-200 text-3xs">
                            {item.price_ttc} DH
                          </span>
                          <Plus className="w-3 h-3 text-blue-500 group-hover:scale-125 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-3xs font-black uppercase text-gray-400 tracking-wider">
                      Freinage & Batterie (TTC)
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {CATALOG_ITEMS.filter((i) => i.category === "Freinage & Batterie").map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleAddCatalogItem(item)}
                          className="px-2.5 py-1.5 bg-amber-50/80 hover:bg-amber-100 text-amber-950 border border-amber-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                        >
                          <span>{item.designation}</span>
                          <span className="font-mono font-bold bg-white px-1.5 py-0.2 rounded text-amber-800 border border-amber-200 text-3xs">
                            {item.price_ttc} DH
                          </span>
                          <Plus className="w-3 h-3 text-amber-600 group-hover:scale-125 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-3xs font-black uppercase text-gray-400 tracking-wider">
                      Pneumatiques (TTC standard)
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {CATALOG_ITEMS.filter((i) => i.category === "Pneumatiques").map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleAddCatalogItem(item)}
                          className="px-2.5 py-1.5 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-950 border border-emerald-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                        >
                          <span>{item.designation}</span>
                          <span className="font-mono font-bold bg-white px-1.5 py-0.2 rounded text-emerald-800 border border-emerald-200 text-3xs">
                            {item.price_ttc} DH
                          </span>
                          <Plus className="w-3 h-3 text-emerald-600 group-hover:scale-125 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add custom service */}
                  <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600">Autre prestation :</span>
                    <input
                      type="text"
                      placeholder="Ex: Remplacement filtre à air..."
                      value={customDesignation}
                      onChange={(e) => setCustomDesignation(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs text-gray-800 focus:ring-1 focus:ring-navy outline-none flex-1 min-w-[180px] bg-white"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="Prix TTC"
                        value={customPriceTTC}
                        onChange={(e) => setCustomPriceTTC(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs text-gray-800 w-24 focus:ring-1 focus:ring-navy outline-none bg-white font-mono"
                      />
                      <span className="text-xs text-gray-500 font-semibold">DH</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomItem}
                      className="px-3 py-1 bg-navy hover:bg-navy/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* THE OFFICIAL BON DE COMMANDE SHEET (Exact Template Match)  */}
          {/* ========================================================= */}
          <div
            id="bon-de-commande-print-area"
            className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-gray-900 font-sans print:p-0 print:border-0 print:shadow-none mx-auto max-w-[210mm] min-h-[280mm] flex flex-col justify-between"
          >
            {/* Document Header */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b-2 border-gray-800">
                <div className="flex items-center gap-3">
                  {/* Official GoCab Logo */}
                  <img
                    src={GOCAB_OFFICIAL_LOGO_BASE64}
                    alt="GoCab Logo"
                    className="h-14 w-auto object-contain"
                  />
                </div>
                <div className="text-right">
                  <h1 className="text-xl font-black tracking-tight text-gray-900 uppercase">
                    BON DE COMMANDE
                  </h1>
                </div>
              </div>

              {/* Ref N° BC and Date Row */}
              <div className="flex items-center justify-between py-3 text-sm border-b border-gray-300">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">N° BC :</span>
                  {!readOnly ? (
                    <input
                      type="text"
                      value={bcNumber}
                      onChange={(e) => setBcNumber(e.target.value)}
                      placeholder="Saisir la réf manuellement (ex: T000000/15/09/2026)"
                      className="border border-blue-300 rounded px-2 py-0.5 text-xs font-mono font-bold text-blue-900 w-64 focus:ring-1 focus:ring-navy outline-none bg-blue-50/40 print:border-none print:bg-transparent print:p-0 print:w-auto"
                    />
                  ) : (
                    <span className="font-mono font-bold text-blue-900 underline">
                      {bcNumber || "—"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">Date :</span>
                  {!readOnly ? (
                    <input
                      type="text"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-0.5 text-xs font-semibold text-gray-800 w-28 text-right focus:ring-1 focus:ring-navy outline-none bg-white print:border-none print:bg-transparent print:p-0"
                    />
                  ) : (
                    <span className="font-semibold text-gray-800">{date}</span>
                  )}
                </div>
              </div>

              {/* ÉMETTEUR & FOURNISSEUR */}
              <div className="grid grid-cols-2 gap-6 py-4 border-b border-gray-300 text-xs">
                <div>
                  <h3 className="font-black text-gray-900 uppercase tracking-wider mb-1.5">
                    ÉMETTEUR
                  </h3>
                  <p className="font-bold text-gray-900">GoCab Rent</p>
                  <p className="text-gray-600">84 Rue Ibnou Mounir, Centre Andalucia</p>
                  <p className="text-gray-600">Maarif – Casablanca</p>
                  <p className="text-gray-600 mt-1">RC : 707687 / Patente : 35707832 / IF : 70997186</p>
                  <p className="text-gray-600">Tél. : 0662 70 91 79</p>
                </div>

                <div>
                  <h3 className="font-black text-gray-900 uppercase tracking-wider mb-1.5">
                    FOURNISSEUR
                  </h3>
                  {!readOnly ? (
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="font-bold text-gray-900 border border-gray-300 rounded px-2 py-1 text-xs w-full focus:ring-1 focus:ring-navy outline-none bg-white print:border-none print:p-0"
                    />
                  ) : (
                    <p className="font-bold text-gray-900">{supplierName}</p>
                  )}
                </div>
              </div>

              {/* VÉHICULE CONCERNÉ */}
              <div className="py-4 border-b border-gray-300">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span>VÉHICULE CONCERNÉ</span>
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-medium">Marque / Modèle :</span>
                    {!readOnly ? (
                      <input
                        type="text"
                        value={vehicleMakeModel}
                        onChange={(e) => setVehicleMakeModel(e.target.value)}
                        placeholder="Ex: Dacia Sandero"
                        className="font-bold text-gray-900 border border-gray-300 rounded px-2 py-0.5 text-xs w-48 text-right bg-white print:border-none print:p-0"
                      />
                    ) : (
                      <span className="font-bold text-gray-900">{vehicleMakeModel || "—"}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-medium">Immatriculation :</span>
                    {!readOnly ? (
                      <input
                        type="text"
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value)}
                        placeholder="Ex: 26512-Y-6"
                        className="font-mono font-bold text-navy border border-gray-300 rounded px-2 py-0.5 text-xs w-48 text-right bg-white print:border-none print:p-0"
                      />
                    ) : (
                      <span className="font-mono font-bold text-navy">{vehiclePlate || "—"}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-medium">Kilométrage :</span>
                    {!readOnly ? (
                      <input
                        type="text"
                        value={vehicleMileage}
                        onChange={(e) => setVehicleMileage(e.target.value)}
                        placeholder="Ex: 40 150 Km"
                        className="font-semibold text-gray-900 border border-gray-300 rounded px-2 py-0.5 text-xs w-48 text-right bg-white print:border-none print:p-0"
                      />
                    ) : (
                      <span className="font-semibold text-gray-900">{vehicleMileage || "—"}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-medium">N° Châssis (VIN) :</span>
                    {!readOnly ? (
                      <input
                        type="text"
                        value={vehicleVin}
                        onChange={(e) => setVehicleVin(e.target.value)}
                        placeholder="Ex: UU1MDJF00876018673"
                        className="font-mono text-xs text-gray-900 border border-gray-300 rounded px-2 py-0.5 w-48 text-right bg-white print:border-none print:p-0"
                      />
                    ) : (
                      <span className="font-mono text-xs text-gray-900">{vehicleVin || "—"}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* DÉTAIL DE LA COMMANDE TABLE */}
              <div className="py-4">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-2.5">
                  DÉTAIL DE LA COMMANDE
                </h3>

                <div className="border border-gray-800 rounded-sm overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-800 font-bold text-gray-900">
                        <th className="py-2 px-3 w-10 text-center border-r border-gray-300">N°</th>
                        <th className="py-2 px-3 border-r border-gray-300">Désignation de la prestation</th>
                        <th className="py-2 px-3 w-16 text-center border-r border-gray-300">Qté</th>
                        <th className="py-2 px-3 w-28 text-right border-r border-gray-300">P.U. TTC (MAD)</th>
                        <th className="py-2 px-3 w-28 text-right">Montant TTC (MAD)</th>
                        {!readOnly && <th className="no-print py-2 px-2 w-10 text-center"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                      {items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={readOnly ? 5 : 6}
                            className="py-6 text-center text-gray-400 italic"
                          >
                            Aucune prestation sélectionnée. Choisissez dans le catalogue ci-dessus.
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-3 text-center font-bold text-gray-700 border-r border-gray-300">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-gray-900 border-r border-gray-300">
                              {item.designation}
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-gray-300">
                              {!readOnly ? (
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                                  className="w-12 text-center border border-gray-300 rounded px-1 py-0.5 text-xs font-semibold bg-white print:border-none print:p-0"
                                />
                              ) : (
                                <span>{item.quantity.toFixed(2).replace(".", ",")}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono border-r border-gray-300">
                              {!readOnly ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.unit_price_ttc}
                                  onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                                  className="w-20 text-right border border-gray-300 rounded px-1 py-0.5 text-xs font-mono font-semibold bg-white print:border-none print:p-0"
                                />
                              ) : (
                                <span>{item.unit_price_ttc.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                              {item.total_ttc.toFixed(2)}
                            </td>
                            {!readOnly && (
                              <td className="no-print py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-gray-400 hover:text-red-500 p-1"
                                  title="Supprimer cette ligne"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RÉCAPITULATIF FINANCIALS */}
              <div className="flex justify-end py-2">
                <div className="w-64 border border-gray-800 rounded-sm overflow-hidden text-xs">
                  <div className="bg-gray-100 px-3 py-1.5 font-black text-gray-900 uppercase border-b border-gray-800">
                    RÉCAPITULATIF
                  </div>
                  <div className="p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-gray-700">
                      <span>Total HT :</span>
                      <span className="font-mono font-semibold">{totals.total_ht.toFixed(2)} MAD</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-700">
                      <span>TVA (20%) :</span>
                      <span className="font-mono font-semibold">{totals.tva_amount.toFixed(2)} MAD</span>
                    </div>
                    <div className="flex items-center justify-between font-black text-sm text-gray-900 pt-1.5 border-t border-gray-300">
                      <span>Total TTC :</span>
                      <span className="font-mono text-navy underline decoration-2 underline-offset-2">
                        {totals.total_ttc.toFixed(2)} MAD
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CONDITIONS & OBSERVATIONS */}
              <div className="py-3 border-t border-gray-300 text-xs">
                <h3 className="font-black text-gray-900 uppercase tracking-wider mb-2">
                  CONDITIONS & OBSERVATIONS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-600 block mb-0.5">Délai d&apos;exécution souhaité :</span>
                    {!readOnly ? (
                      <input
                        type="text"
                        value={executionDelay}
                        onChange={(e) => setExecutionDelay(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-0.5 text-xs font-semibold text-gray-800 w-full bg-white print:border-none print:p-0"
                      />
                    ) : (
                      <span className="font-semibold text-gray-800">{executionDelay}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-600 block mb-0.5">Observations :</span>
                    {!readOnly ? (
                      <input
                        type="text"
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-0.5 text-xs font-semibold text-gray-800 w-full bg-white print:border-none print:p-0"
                      />
                    ) : (
                      <span className="font-semibold text-gray-800">{observations}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* VALIDATION SECTION & OFFICIAL STAMP */}
            <div className="pt-6 border-t border-gray-300 mt-6">
              <div className="flex justify-between items-end">
                <div className="text-xs space-y-1">
                  <h3 className="font-black text-gray-900 uppercase tracking-wider mb-2">
                    VALIDATION
                  </h3>
                  <p className="font-bold text-gray-900">Pour GoCab Rent</p>
                  <p className="text-gray-700">
                    Nom & Prénom :{" "}
                    {!readOnly ? (
                      <input
                        type="text"
                        value={validatorName}
                        onChange={(e) => setValidatorName(e.target.value)}
                        className="border border-gray-300 rounded px-1.5 py-0.2 text-xs font-bold text-gray-900 bg-white print:border-none print:p-0"
                      />
                    ) : (
                      <span className="font-bold">{validatorName}</span>
                    )}
                  </p>
                  <p className="text-gray-700">
                    Qualité :{" "}
                    {!readOnly ? (
                      <input
                        type="text"
                        value={validatorRole}
                        onChange={(e) => setValidatorRole(e.target.value)}
                        className="border border-gray-300 rounded px-1.5 py-0.2 text-xs font-semibold text-gray-900 bg-white print:border-none print:p-0"
                      />
                    ) : (
                      <span className="font-semibold">{validatorRole}</span>
                    )}
                  </p>
                  <p className="text-gray-700">
                    Date : <span className="font-semibold">{date}</span>
                  </p>
                  <p className="text-gray-500 italic pt-1">Signature & Cachet</p>
                </div>

                {/* Official GoCab Morocco Stamp Reproduction matching Photo 3 */}
                <div className="relative p-3 border-2 border-blue-800/80 rounded-2xl bg-blue-50/20 text-blue-900 font-sans text-center transform -rotate-3 select-none pointer-events-none w-56 shadow-2xs">
                  <div className="text-[11px] font-black tracking-widest uppercase text-blue-950">
                    GOCAB MOROCCO
                  </div>
                  <div className="text-[9px] font-semibold leading-tight text-blue-800 mt-0.5">
                    332, Bd. Brahim Roudani<br />
                    Etage 5, N°21<br />
                    Casablanca
                  </div>
                  {/* Stylized authentic stamp signature stroke */}
                  <svg
                    className="absolute inset-0 w-full h-full text-blue-700/60 pointer-events-none"
                    viewBox="0 0 200 80"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M 30 55 C 60 20, 80 70, 110 35 C 130 15, 150 65, 175 40" strokeLinecap="round" />
                    <path d="M 40 45 C 80 50, 120 40, 160 50" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar Actions (Screen only) */}
        <div className="no-print bg-white border-t border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-600">Total Commande :</span>
            <span className="font-mono font-black text-navy text-sm bg-navy/5 px-2.5 py-1 rounded-lg border border-navy/10">
              {totals.total_ttc.toLocaleString()} MAD TTC
            </span>
            <span className="text-2xs text-gray-400">
              ({totals.total_ht.toLocaleString()} HT + 20% TVA)
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={handleValidateAndSave}
                className="px-5 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Valider le Bon de Commande</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
