import { GOCAB_OFFICIAL_LOGO_BASE64 } from "./gocabOfficialLogo";

export interface AttestationPrintData {
  fullName: string;
  cin: string;
  brand: string;
  immat: string;
  chassisNumber: string;
  date: string;
  duration?: string;
  validatorName?: string;
  validatorRole?: string;
}

export function generateAttestationPrintHtml(data: AttestationPrintData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Attestation de Location - ${data.immat || "GoCab"}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 20mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.6;
    }
    .container {
      width: 100%;
      max-width: 180mm;
      min-height: 250mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header {
      margin-bottom: 24px;
    }
    .logo-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-img {
      height: 52px;
      width: auto;
      object-fit: contain;
    }
    .annexe {
      margin-top: 6px;
      font-size: 10pt;
      color: #334155;
      font-style: italic;
      font-family: Georgia, serif;
    }
    .title-box {
      text-align: center;
      margin: 28px 0 24px 0;
    }
    .title {
      font-size: 15pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-decoration: underline;
      text-underline-offset: 4px;
      margin: 0;
    }
    .legal-text {
      text-align: justify;
      font-size: 11pt;
      line-height: 1.7;
      margin-bottom: 18px;
    }
    .driver-box {
      font-size: 11pt;
      font-weight: 700;
      margin: 16px 0 20px 8px;
      line-height: 1.8;
    }
    .specs-list {
      margin: 16px 0 24px 20px;
      font-size: 11pt;
      font-weight: 700;
      line-height: 1.85;
    }
    .specs-list li {
      margin-bottom: 6px;
    }
    .specs-val {
      font-weight: 600;
    }
    .procuration-text {
      text-align: justify;
      font-size: 10.5pt;
      line-height: 1.65;
      margin-bottom: 30px;
    }
    .footer-row {
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 11pt;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="container">
    <div>
      <!-- Header -->
      <div class="header">
        <div class="logo-row">
          <img src="${GOCAB_OFFICIAL_LOGO_BASE64}" alt="GoCab Logo" class="logo-img" />
        </div>
        <div class="annexe">
          Annexe 3 de la CONVENTION DE PARTENARIAT
        </div>
      </div>

      <!-- Title -->
      <div class="title-box">
        <h1 class="title">ATTESTATION DE LOCATION DE VOITURE</h1>
      </div>

      <!-- Legal Intro -->
      <div class="legal-text">
        <p>
          Nous soussignés, <strong>GOCAB RENT</strong> (GOCAB®), SARL au capital de 500.000 DH dont le siège est à Casablanca,
          <strong>84 RUE IBNOU MOUNIR N38 CENTRE ANDALUCIA - Casablanca</strong>, légalement représentée par :
        </p>
        <p style="font-weight: 700; margin: 10px 0;">
          Mr ${data.validatorName || "Hamza RASSID"} (${data.validatorRole || "Gérant"})
        </p>
        <p>
          Attestons par la présente avoir loué à :
        </p>
      </div>

      <!-- Driver Details -->
      <div class="driver-box">
        <div>Nom : <span>${data.fullName || "_________________________"}</span></div>
        <div>CIN : <span>${data.cin || "_________________________"}</span></div>
      </div>

      <!-- Vehicle Specs -->
      <ul class="specs-list">
        <li>Marque véhicule : <span class="specs-val">${data.brand || "_________________________"}</span></li>
        <li>Immatriculation : <span class="specs-val" style="font-family: monospace; color: #1e3a8a;">${data.immat || "_________________________"}</span></li>
        <li>N° de châssis : <span class="specs-val" style="font-family: monospace;">${data.chassisNumber || "_________________________"}</span></li>
        <li>Durée de location : <span class="specs-val">${data.duration || "1 Mois renouvelable après consentement des deux parties (la société et le partenaire)"}</span></li>
      </ul>

      <!-- Procuration Clause -->
      <div class="procuration-text">
        <p>
          Donnons à l'utilisateur de ce véhicule, porteur de la présente, <strong>procuration spéciale</strong> pour nous représenter auprès des autorités locales afin de retirer ce véhicule de la fourrière municipale.
        </p>
        <p style="margin-top: 10px;">
          En foi de quoi, la présente attestation est délivrée à l'intéressé pour servir et valoir ce que de droit.
        </p>
      </div>
    </div>

    <!-- Footer: Date & Signature -->
    <div class="footer-row">
      <div>
        Fait à Casablanca, le <span style="font-weight: 600;">${data.date || ""}</span>
      </div>

      <div style="display: flex; flex-direction: column; align-items: flex-end; min-height: 70px;">
        <div>Signé : ${data.validatorName || "HAMZA RASSID"} (${data.validatorRole || "Gérant"})</div>
        <div style="font-size: 8.5pt; color: #64748b; font-style: italic; margin-top: 6px;">Signature & Cachet</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function printAttestation(data: AttestationPrintData) {
  if (typeof window === "undefined") return;

  const html = generateAttestationPrintHtml(data);

  let iframe = document.getElementById("gocab-attestation-print-iframe") as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "gocab-attestation-print-iframe";
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
      console.error("Print attestation error:", e);
    }
  }, 250);
}
