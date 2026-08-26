"use client";

/**
 * VehicleExpensesDrawer Component
 *
 * Sliding slide-over drawer displaying fleet financial expenses & repair costs:
 * - Category filters (DD list)
 * - Search by plate
 * - Breakdown totals and KPI summary
 * - One-click fee logging
 */

import { useState, useEffect } from "react";
import {
  X,
  DollarSign,
  Plus,
  Search,
  Filter,
  Trash2,
  Receipt,
  Car,
  Wrench,
  ShieldAlert,
  Calendar,
  Building,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import toast from "react-hot-toast";
import { EXPENSE_CATEGORIES } from "./AddExpenseModal";

interface ExpenseItem {
  id: string;
  vehicle_id: string;
  plate_number: string;
  category: string;
  amount_mad: number;
  description: string | null;
  invoice_number: string | null;
  paid_by: string;
  is_rechargeable: boolean;
  paid_at: string;
  recorded_by: string | null;
  status: string;
  vehicle?: {
    make_model: string;
    status: string;
    assigned_driver_name: string | null;
  } | null;
}

interface VehicleExpensesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal: (vehicle?: any, category?: string) => void;
  filterVehicleId?: string | null;
}

export default function VehicleExpensesDrawer({
  isOpen,
  onClose,
  onOpenAddModal,
  filterVehicleId,
}: VehicleExpensesDrawerProps) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [totalMAD, setTotalMAD] = useState(0);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterVehicleId) params.set("vehicle_id", filterVehicleId);
      if (selectedCategory !== "ALL") params.set("category", selectedCategory);
      if (searchQuery) params.set("plate_number", searchQuery);

      const res = await fetch(`/api/expenses?${params.toString()}`);
      const data = await res.json();
      if (data.expenses) {
        setExpenses(data.expenses);
        setTotalMAD(data.summary?.total_mad || 0);
      }
    } catch (err) {
      toast.error("Erreur de chargement des frais");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchExpenses();
    }
  }, [isOpen, selectedCategory, searchQuery, filterVehicleId]);

  if (!isOpen) return null;

  async function handleDelete(id: string) {
    if (!confirm("Voulez-vous supprimer cette entrée de frais ?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Frais supprimé");
        fetchExpenses();
      }
    } catch (err) {
      toast.error("Erreur de suppression");
    }
  }

  const getCategoryLabel = (key: string) => {
    const found = EXPENSE_CATEGORIES.find((c) => c.key === key);
    return found ? found.label : key;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-navy/40 backdrop-blur-xs animate-fadeIn">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-navy via-[#1e3a5f] to-[#0f1e35] text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gold/20 text-gold rounded-xl border border-gold/30">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Frais & Dépenses Flotte</h2>
                <p className="text-xs text-white/70">
                  Suivi des coûts de réparations, amendes, fourrière et maintenance
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Top KPI & Add Action Bar */}
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-4">
            <div>
              <p className="text-2xs font-semibold text-gray-500 uppercase">Total Dépenses Enregistrées</p>
              <p className="text-2xl font-extrabold text-navy">
                {totalMAD.toLocaleString()} <span className="text-xs font-normal">MAD</span>
              </p>
            </div>

            <button
              onClick={() => onOpenAddModal()}
              className="flex items-center gap-2 px-4 py-2.5 bg-navy hover:bg-navy/90 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 text-gold" />
              <span>Nouveau Frais</span>
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="p-4 bg-white border-b border-gray-100 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Rechercher par immatriculation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              >
                <option value="ALL">Toutes les catégories</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <button
                onClick={fetchExpenses}
                className="p-2 text-gray-400 hover:text-navy hover:bg-gray-100 rounded-xl transition-colors"
                title="Rafraîchir"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Expenses List Table */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
                <span className="text-xs">Chargement des dépenses...</span>
              </div>
            ) : expenses.length === 0 ? (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <Receipt className="w-10 h-10 mx-auto text-gray-300" />
                <p className="text-sm font-semibold text-gray-600">Aucun frais enregistré</p>
                <p className="text-xs text-gray-400">
                  Cliquez sur "Nouveau Frais" pour consigner un paiement ou une réparation.
                </p>
              </div>
            ) : (
              expenses.map((expense) => {
                const dateStr = new Date(expense.paid_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <div
                    key={expense.id}
                    className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-2xs hover:border-navy/30 transition-all flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs bg-navy/5 text-navy px-2 py-0.5 rounded-lg border border-navy/10">
                          {expense.plate_number}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md">
                          {getCategoryLabel(expense.category)}
                        </span>
                        {expense.is_rechargeable && (
                          <span className="text-2xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            Rechargé chauffeur
                          </span>
                        )}
                      </div>

                      {expense.description && (
                        <p className="text-xs text-gray-700">{expense.description}</p>
                      )}

                      <div className="flex items-center gap-3 text-2xs text-gray-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {dateStr}
                        </span>
                        <span>·</span>
                        <span>Payé par : {expense.paid_by}</span>
                        {expense.invoice_number && (
                          <>
                            <span>·</span>
                            <span>Facture : {expense.invoice_number}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end justify-between self-stretch">
                      <p className={`text-base font-extrabold ${expense.amount_mad === 0 ? "text-emerald-600" : "text-navy"}`}>
                        {expense.amount_mad.toLocaleString()} <span className="text-2xs font-normal">MAD</span>
                      </p>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>{expenses.length} dépenses trouvées</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
