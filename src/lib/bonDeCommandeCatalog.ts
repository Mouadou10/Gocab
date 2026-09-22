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
  issuer_address: string; // "84 Rue Ibnou Mounir, Centre Andalucia"
  issuer_city?: string; // "Maarif – Casablanca"
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
  {
    id: "filtre_a_huile",
    category: "Entretien",
    designation: "Filtre à Huile",
    price_ttc: 50,
  },
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

import { GOCAB_OFFICIAL_LOGO_BASE64 } from "./gocabOfficialLogo";

/**
 * Generates an isolated, pixel-perfect A4 HTML string for printing the official Bon de Commande.
 */
export function generateBonDeCommandePrintHtml(data: BonDeCommandeData): string {
  const totals = calculateBonDeCommandeTotals(data.items || []);

  const rows = (data.items || []).map((item, idx) => `
    <tr>
      <td style="padding: 7px 10px; border: 1px solid #1f2937; text-align: center; font-weight: 700;">${idx + 1}</td>
      <td style="padding: 7px 10px; border: 1px solid #1f2937; font-weight: 600;">${item.designation || ""}</td>
      <td style="padding: 7px 10px; border: 1px solid #1f2937; text-align: center;">${item.quantity}</td>
      <td style="padding: 7px 10px; border: 1px solid #1f2937; text-align: right; font-family: monospace;">${Number(item.unit_price_ttc || 0).toFixed(2)}</td>
      <td style="padding: 7px 10px; border: 1px solid #1f2937; text-align: right; font-family: monospace; font-weight: 700;">${Number(item.total_ttc || 0).toFixed(2)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Bon de Commande ${data.bc_number ? "N° " + data.bc_number : ""}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 10.5pt;
      line-height: 1.35;
    }
    .container {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 2px solid #111827;
    }
    .logo {
      height: 52px;
      width: auto;
      object-fit: contain;
    }
    .title {
      font-size: 17pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
      text-align: right;
      color: #111827;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #d1d5db;
      font-size: 10pt;
    }
    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding: 12px 0;
      border-bottom: 1px solid #d1d5db;
      font-size: 9.5pt;
    }
    .section-title {
      font-size: 9.5pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      color: #111827;
    }
    .vehicle-section {
      padding: 10px 0;
      border-bottom: 1px solid #d1d5db;
    }
    .vehicle-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 24px;
      font-size: 9.5pt;
    }
    .vehicle-row {
      display: flex;
      justify-content: space-between;
    }
    .vehicle-label {
      color: #4b5563;
      font-weight: 500;
    }
    .vehicle-value {
      font-weight: 700;
      color: #111827;
    }
    .items-section {
      padding: 12px 0 6px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }
    th {
      background-color: #f3f4f6 !important;
      border: 1px solid #111827;
      padding: 7px 8px;
      font-weight: 800;
      text-align: left;
      color: #111827;
    }
    td {
      border: 1px solid #1f2937;
    }
    .recap-container {
      display: flex;
      justify-content: flex-end;
      padding: 10px 0 12px 0;
    }
    .recap-box {
      width: 260px;
      border: 1px solid #111827;
      font-size: 9.5pt;
    }
    .recap-header {
      background-color: #f3f4f6 !important;
      padding: 5px 10px;
      font-weight: 900;
      text-transform: uppercase;
      border-bottom: 1px solid #111827;
    }
    .recap-body {
      padding: 8px 10px;
    }
    .recap-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      color: #374151;
    }
    .recap-total {
      display: flex;
      justify-content: space-between;
      font-size: 11pt;
      font-weight: 900;
      color: #1e3a8a;
      border-top: 1px solid #d1d5db;
      padding-top: 5px;
      margin-top: 5px;
    }
    .conditions-section {
      padding: 10px 0;
      border-top: 1px solid #d1d5db;
      font-size: 9.5pt;
    }
    .conditions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .validation-section {
      padding-top: 14px;
      border-top: 1px solid #d1d5db;
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .validation-info {
      font-size: 9.5pt;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header with Official Logo -->
    <div class="header">
      <img src="${GOCAB_OFFICIAL_LOGO_BASE64}" alt="GoCab Logo" class="logo" />
      <h1 class="title">BON DE COMMANDE</h1>
    </div>

    <!-- Meta row -->
    <div class="meta-row">
      <div>
        <strong>N° BC :</strong>
        <span style="font-family: monospace; font-weight: 700; color: #1e3a8a; margin-left: 6px;">
          ${data.bc_number || "—"}
        </span>
      </div>
      <div>
        <strong>Date :</strong>
        <span style="font-weight: 600; margin-left: 6px;">
          ${data.date || ""}
        </span>
      </div>
    </div>

    <!-- Émetteur & Fournisseur -->
    <div class="parties-grid">
      <div>
        <div class="section-title">ÉMETTEUR</div>
        <div style="font-weight: 700;">${data.issuer_name || "GoCab Rent"}</div>
        <div style="color: #4b5563;">${data.issuer_address || "84 Rue Ibnou Mounir, Centre Andalucia"}</div>
        ${data.issuer_city ? `<div style="color: #4b5563;">${data.issuer_city}</div>` : `<div style="color: #4b5563;">Maarif – Casablanca</div>`}
        <div style="color: #4b5563; margin-top: 3px;">${data.issuer_legal || "RC : 707687 / Patente : 35707832 / IF : 70997186"}</div>
        <div style="color: #4b5563;">Tél. : ${data.issuer_phone || "0662 70 91 79"}</div>
      </div>
      <div>
        <div class="section-title">FOURNISSEUR</div>
        <div style="font-weight: 700; font-size: 11pt; color: #111827;">${data.supplier_name || "Hard Auto Services"}</div>
      </div>
    </div>

    <!-- Véhicule Concerné -->
    <div class="vehicle-section">
      <div class="section-title">VÉHICULE CONCERNÉ</div>
      <div class="vehicle-grid">
        <div class="vehicle-row">
          <span class="vehicle-label">Marque / Modèle :</span>
          <span class="vehicle-value">${data.vehicle_make_model || "—"}</span>
        </div>
        <div class="vehicle-row">
          <span class="vehicle-label">Immatriculation :</span>
          <span class="vehicle-value" style="font-family: monospace; color: #1e3a8a;">${data.vehicle_plate || "—"}</span>
        </div>
        <div class="vehicle-row">
          <span class="vehicle-label">Kilométrage :</span>
          <span class="vehicle-value">${data.vehicle_mileage || "—"}</span>
        </div>
        <div class="vehicle-row">
          <span class="vehicle-label">N° Châssis (VIN) :</span>
          <span class="vehicle-value" style="font-family: monospace;">${data.vehicle_vin || "—"}</span>
        </div>
      </div>
    </div>

    <!-- Détail de la commande -->
    <div class="items-section">
      <div class="section-title">DÉTAIL DE LA COMMANDE</div>
      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">N°</th>
            <th>Désignation de la prestation</th>
            <th style="width: 65px; text-align: center;">Qté</th>
            <th style="width: 125px; text-align: right;">P.U. TTC (MAD)</th>
            <th style="width: 135px; text-align: right;">Montant TTC (MAD)</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5" style="text-align: center; padding: 14px; color: #9ca3af; font-style: italic;">Aucune prestation sélectionnée</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Récapitulatif -->
    <div class="recap-container">
      <div class="recap-box">
        <div class="recap-header">RÉCAPITULATIF</div>
        <div class="recap-body">
          <div class="recap-row">
            <span>Total HT :</span>
            <span style="font-family: monospace; font-weight: 600;">${totals.total_ht.toFixed(2)} MAD</span>
          </div>
          <div class="recap-row">
            <span>TVA (20%) :</span>
            <span style="font-family: monospace; font-weight: 600;">${totals.tva_amount.toFixed(2)} MAD</span>
          </div>
          <div class="recap-total">
            <span>Total TTC :</span>
            <span style="font-family: monospace; text-decoration: underline;">${totals.total_ttc.toFixed(2)} MAD</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Conditions & Observations -->
    <div class="conditions-section">
      <div class="section-title">CONDITIONS & OBSERVATIONS</div>
      <div class="conditions-grid">
        <div>
          <span style="color: #4b5563; display: block; font-size: 8.5pt;">Délai d'exécution souhaité :</span>
          <strong style="font-size: 9.5pt;">${data.execution_delay || data.date || "Immédiat"}</strong>
        </div>
        <div>
          <span style="color: #4b5563; display: block; font-size: 8.5pt;">Observations :</span>
          <strong style="font-size: 9.5pt;">${data.observations || "N/A"}</strong>
        </div>
      </div>
    </div>

    <!-- Validation & Cachet -->
    <div class="validation-section">
      <div class="validation-info">
        <div class="section-title">VALIDATION</div>
        <div style="font-weight: 700;">Pour GoCab Rent</div>
        <div>Nom & Prénom : <strong>${data.validator_name || "Hamza RASSID"}</strong></div>
        <div>Qualité : <span>${data.validator_role || "Gérant"}</span></div>
        <div>Date : <span>${data.date || ""}</span></div>
        <div style="color: #6b7280; font-style: italic; margin-top: 4px;">Signature & Cachet</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Executes a bulletproof print action using a hidden iframe.
 * Never produces blank pages, does not depend on parent container overflow/styles.
 */
export function printBonDeCommande(data: BonDeCommandeData) {
  if (typeof window === "undefined") return;

  const html = generateBonDeCommandePrintHtml(data);

  let iframe = document.getElementById("gocab-print-iframe") as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "gocab-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    const printWin = window.open("", "_blank", "width=850,height=1000");
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 300);
    }
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Print error:", e);
    }
  }, 250);
}

