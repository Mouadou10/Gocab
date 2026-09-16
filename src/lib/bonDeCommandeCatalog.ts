/**
 * Bon de Commande Catalog & Data Types
 * 
 * Predefined services, tires, and mechanical maintenance prices for GoCab Rent.
 */

export interface CatalogItem {
  id: string;
  category: "Entretien" | "Freinage & Batterie" | "Pneumatiques";
  designation: string;
  price_ttc: number;
  price_ht?: number;
  default_qty?: number;
}

export interface BonDeCommandeItem {
  id: string;
  designation: string;
  quantity: number;
  unit_price_ttc: number;
  total_ttc: number;
  is_custom?: boolean;
}

export interface BonDeCommandeData {
  bc_number: string; // Reference, e.g. "T000000/15/09/2026"
  date: string; // e.g. "16-09-2026"
  issuer_name: string; // "GoCab Rent"
  issuer_address: string; // "84 Rue Ibnou Mounir, Centre Andalucia, Maarif – Casablanca"
  issuer_legal: string; // "RC : 707687 / Patente : 35707832 / IF : 70997186"
  issuer_phone: string; // "0662 70 91 79"
  supplier_name: string; // "Hard Auto Services"
  vehicle_make_model: string; // e.g. "Dacia Sandero"
  vehicle_plate: string; // e.g. "26512-Y-6"
  vehicle_mileage: string; // e.g. "40 150 Km"
  vehicle_vin: string; // e.g. "UU1MDJF00876018673"
  items: BonDeCommandeItem[];
  total_ht: number;
  tva_rate: number; // 20%
  tva_amount: number;
  total_ttc: number;
  execution_delay: string; // e.g. "16-09-2026"
  observations: string; // "N/A"
  validator_name: string; // "Hamza RASSID"
  validator_role: string; // "Gérant"
  validated: boolean;
  validated_at?: string | null;
}

/** Predefined catalog items based on GoCab price tables */
export const CATALOG_ITEMS: CatalogItem[] = [
  // Photo 1: Prestations d'entretien & mécaniques
  { id: "vidange_simple", category: "Entretien", designation: "Vidange simple", price_ttc: 510 },
  { id: "vidange_complete", category: "Entretien", designation: "Vidange complète", price_ttc: 960 },
  { id: "adblue", category: "Entretien", designation: "AdBlue", price_ttc: 95 },
  { id: "antigel", category: "Entretien", designation: "Antigel", price_ttc: 20 },
  { id: "essuie_glace", category: "Entretien", designation: "Essuie-glace", price_ttc: 120 },
  
  { id: "plaquette_frein", category: "Freinage & Batterie", designation: "Plaquette de frein", price_ttc: 270 },
  { id: "disque_frein", category: "Freinage & Batterie", designation: "Disque de frein", price_ttc: 500 },
  { id: "batterie_l3", category: "Freinage & Batterie", designation: "Batterie L3", price_ttc: 950 },

  // Photo 2: Offre de prix STE GOCAB (Pneus)
  { id: "pneu_bridgestone", category: "Pneumatiques", designation: "185/65R15 BRIDGESTONE", price_ht: 541.66, price_ttc: 650 },
  { id: "pneu_sailun", category: "Pneumatiques", designation: "185/65R15 SAILUN", price_ht: 466.66, price_ttc: 560 },
  { id: "pneu_dayton", category: "Pneumatiques", designation: "18565R15 DAYTON", price_ht: 491.66, price_ttc: 590 },
];

/** Financial calculation helper */
export function calculateBonDeCommandeTotals(items: BonDeCommandeItem[]) {
  const total_ttc = items.reduce((sum, item) => sum + (Number(item.total_ttc) || 0), 0);
  // In Morocco standard VAT is 20%: Total HT = Total TTC / 1.20
  const total_ht = Math.round((total_ttc / 1.2) * 100) / 100;
  const tva_amount = Math.round((total_ttc - total_ht) * 100) / 100;

  return {
    total_ttc: Math.round(total_ttc * 100) / 100,
    total_ht,
    tva_rate: 20,
    tva_amount,
  };
}

/** Formats today's date as DD-MM-YYYY */
export function getFormattedToday(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
