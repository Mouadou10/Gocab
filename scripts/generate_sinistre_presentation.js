/**
 * Presentation Generator — GoCab Morocco Sinistre, Assurance & Garage Lifecycle
 *
 * Redesigned to match the high-end editorial aesthetic of the reference design
 * (dark/light contrast split layouts, geometric color blocking, radial hub diagram,
 * donut chart infographic, dual-tone typography, horizontal accent bands) while strictly
 * respecting the GoCab brand color chart (Navy #35588F, Deep Navy #162447, Olive #5D6B2D,
 * and warm glowing Amber-Gold #F59E0B / #E5A93C).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const userUploadsDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\4a835044-d1db-4c36-a40a-a23ba766abfb\\.user_uploaded';
const logoPath = path.join(process.cwd(), 'public', 'gocab-official-logo.png');

function getBase64Image(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
      const b64 = fs.readFileSync(filePath).toString('base64');
      return `data:${mime};base64,${b64}`;
    }
  } catch (err) {
    console.error('Error reading image:', filePath, err);
  }
  return '';
}

const logoBase64 = getBase64Image(logoPath);
const screenshotDossierBase64 = getBase64Image(path.join(userUploadsDir, 'media_1794312679374_5d0d2e01.jpg'));
const screenshotTimelineBase64 = getBase64Image(path.join(userUploadsDir, 'media_1794316219672_23b563e1.png'));
const screenshotHeaderBase64 = getBase64Image(path.join(userUploadsDir, 'media_1794311817530_ad6c6284.png'));
const screenshotWhatsAppBase64 = getBase64Image(path.join(userUploadsDir, 'media_1794332771334_85d2b177.jpg'));
const screenshotBrandStatusBase64 = getBase64Image(path.join(userUploadsDir, 'media_1794584013282_98b195f3.jpg'));
const screenshotRappelsBase64 = getBase64Image(path.join(userUploadsDir, 'media_1794312794728_3545072e.png'));

console.log('Loaded media assets:', {
  logo: Boolean(logoBase64),
  dossier: Boolean(screenshotDossierBase64),
  timeline: Boolean(screenshotTimelineBase64),
  header: Boolean(screenshotHeaderBase64),
  whatsapp: Boolean(screenshotWhatsAppBase64),
  brandStatus: Boolean(screenshotBrandStatusBase64),
  rappels: Boolean(screenshotRappelsBase64),
});

const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>GoCab Morocco — Workflow Sinistre, Assurance & Garage (Tech & Ops Guide)</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    @page {
      size: 16in 9in;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #0B0F17;
      color: #F8FAFC;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }

    /* ─── 16:9 Widescreen Presentation Slide Base ─── */
    .slide {
      width: 16in;
      height: 9in;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 0.5in 0.75in 0.5in 0.75in;
    }

    /* ─── GoCab Signature Color Palette & Themes ─── */
    :root {
      --gc-navy: #35588F;
      --gc-navy-deep: #162447;
      --gc-navy-dark: #0F172A;
      --gc-olive: #5D6B2D;
      --gc-olive-light: #708A28;
      --gc-olive-glow: #8FA838;
      --gc-gold: #F59E0B;
      --gc-gold-warm: #E5A93C;
      --gc-slate-dark: #0B0F17;
      --gc-slate-card: #121824;
      --gc-light-bg: #F8FAFC;
      --gc-light-card: #FFFFFF;
      --gc-border-dark: rgba(255, 255, 255, 0.08);
      --gc-border-light: rgba(15, 23, 42, 0.08);
    }

    .bg-dark {
      background: #0B0F17;
      color: #F8FAFC;
    }

    .bg-light {
      background: #F8FAFC;
      color: #0F172A;
    }

    .bg-brand-vibrant {
      background: linear-gradient(135deg, #162447 0%, #1F3B6E 55%, #35588F 100%);
      color: #FFFFFF;
    }

    .bg-olive-vibrant {
      background: linear-gradient(135deg, #2D3A16 0%, #435420 50%, #5D6B2D 100%);
      color: #FFFFFF;
    }

    /* ─── Horizontal Accent Band (Inspiration Hallmark) ─── */
    .accent-bar {
      position: absolute;
      left: 0;
      bottom: 0;
      width: 100%;
      height: 10px;
      background: linear-gradient(90deg, #35588F 0%, #5D6B2D 50%, #F59E0B 100%);
      box-shadow: 0 -2px 14px rgba(245, 158, 11, 0.35);
      z-index: 20;
    }

    .accent-bar-top {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 6px;
      background: linear-gradient(90deg, #F59E0B 0%, #5D6B2D 50%, #35588F 100%);
      z-index: 20;
    }

    /* ─── Slide Header Component ─── */
    .slide-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding-bottom: 0.25in;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      position: relative;
      z-index: 10;
    }

    .slide-header.light-mode {
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-logo {
      height: 38px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
    }

    .header-title-block {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-brand {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #F8FAFC;
    }

    .light-mode .header-brand {
      color: #0F172A;
    }

    .header-sep {
      color: rgba(255, 255, 255, 0.25);
      font-weight: 300;
    }

    .light-mode .header-sep {
      color: rgba(15, 23, 42, 0.25);
    }

    .header-pill {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 5px 14px;
      border-radius: 9999px;
      background: rgba(53, 88, 143, 0.2);
      border: 1px solid rgba(53, 88, 143, 0.45);
      color: #93C5FD;
    }

    .light-mode .header-pill {
      background: rgba(53, 88, 143, 0.08);
      border: 1px solid rgba(53, 88, 143, 0.25);
      color: #1E3A8A;
    }

    .slide-number {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #94A3B8;
      padding: 6px 14px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .light-mode .slide-number {
      color: #64748B;
      background: rgba(15, 23, 42, 0.04);
      border: 1px solid rgba(15, 23, 42, 0.08);
    }

    /* ─── High Contrast Two-Tone Titles ─── */
    .title-hero {
      font-size: 44px;
      font-weight: 900;
      line-height: 1.12;
      letter-spacing: -0.025em;
      text-transform: uppercase;
    }

    .title-section {
      font-size: 36px;
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .highlight-gold {
      color: #F59E0B;
      text-shadow: 0 0 24px rgba(245, 158, 11, 0.3);
    }

    .highlight-navy {
      color: #60A5FA;
    }

    .highlight-olive {
      color: #8FA838;
      text-shadow: 0 0 20px rgba(143, 168, 56, 0.3);
    }

    .light-mode .highlight-navy {
      color: #35588F;
    }

    .light-mode .highlight-olive {
      color: #5D6B2D;
    }

    .light-mode .highlight-gold {
      color: #D97706;
    }

    .subtitle-lead {
      font-size: 17px;
      font-weight: 500;
      line-height: 1.55;
      color: #94A3B8;
      max-width: 680px;
    }

    .light-mode .subtitle-lead {
      color: #475569;
    }

    /* ─── Slide Footer Component ─── */
    .slide-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding-top: 0.2in;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      position: relative;
      z-index: 10;
      font-size: 11px;
      color: #64748B;
      font-weight: 500;
    }

    .light-mode .slide-footer {
      border-top: 1px solid rgba(15, 23, 42, 0.08);
      color: #94A3B8;
    }

    /* ─── Glass & Card Containers ─── */
    .card-dark {
      background: #121824;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    }

    .card-light {
      background: #FFFFFF;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
    }

    .card-glow-gold {
      background: #141A29;
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 12px 35px rgba(245, 158, 11, 0.12);
    }

    .card-glow-navy {
      background: #121929;
      border: 1px solid rgba(53, 88, 143, 0.45);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 12px 35px rgba(53, 88, 143, 0.2);
    }

    /* ─── Circular Badges & Stat Nodes (Inspiration Signature) ─── */
    .stat-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
    }

    .circle-gold {
      background: linear-gradient(135deg, #F59E0B, #D97706);
      color: #0F172A;
    }

    .circle-navy {
      background: linear-gradient(135deg, #35588F, #1E3A8A);
      color: #FFFFFF;
    }

    .circle-olive {
      background: linear-gradient(135deg, #708A28, #5D6B2D);
      color: #FFFFFF;
    }

    .pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      letter-spacing: 0.04em;
    }

    .pill-gold {
      background: rgba(245, 158, 11, 0.15);
      color: #F59E0B;
      border: 1px solid rgba(245, 158, 11, 0.35);
    }

    .pill-navy {
      background: rgba(53, 88, 143, 0.18);
      color: #93C5FD;
      border: 1px solid rgba(53, 88, 143, 0.35);
    }

    .pill-olive {
      background: rgba(93, 107, 45, 0.2);
      color: #BEF264;
      border: 1px solid rgba(93, 107, 45, 0.4);
    }

    /* ─── Radial Hub Diagram Styles (Slide 5 Inspiration) ─── */
    .hub-container {
      position: relative;
      width: 100%;
      height: 480px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .hub-center {
      position: absolute;
      width: 160px;
      height: 160px;
      border-radius: 50%;
      background: linear-gradient(135deg, #162447 0%, #35588F 100%);
      border: 4px solid #F59E0B;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 40px rgba(245, 158, 11, 0.35);
      z-index: 5;
      text-align: center;
      padding: 12px;
    }

    .hub-node {
      position: absolute;
      width: 250px;
      padding: 16px 20px;
      border-radius: 16px;
      background: #121824;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
      z-index: 4;
      transition: all 0.3s ease;
    }

    .hub-node-tl { top: 20px; left: 80px; }
    .hub-node-tr { top: 20px; right: 80px; }
    .hub-node-bl { bottom: 20px; left: 80px; }
    .hub-node-br { bottom: 20px; right: 80px; }

    /* ─── Donut Chart (Slide 6 Inspiration) ─── */
    .donut-chart-box {
      width: 240px;
      height: 240px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .donut-center-stat {
      position: absolute;
      text-align: center;
    }

    /* ─── Image Frame Treatments ─── */
    .screenshot-frame {
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
      background: #0B0F17;
      display: block;
      width: 100%;
      object-fit: cover;
    }

    .screenshot-frame-light {
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.1);
      box-shadow: 0 14px 35px rgba(15, 23, 42, 0.08);
      background: #FFFFFF;
      display: block;
      width: 100%;
      object-fit: cover;
    }

    /* Grid Layout Helpers */
    .grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 36px;
      align-items: center;
      width: 100%;
      flex: 1;
    }

    .grid-3col {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 24px;
      align-items: stretch;
      width: 100%;
      flex: 1;
    }

    .grid-2x3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 18px;
      width: 100%;
      flex: 1;
    }
  </style>
</head>
<body>

  <!-- ========================================================
       SLIDE 01: HERO COVER (Inspired by Slide 1 in Design Grid)
       Dark Matte + Glowing Ambient Light + Two-Tone Title
       ======================================================== -->
  <div class="slide bg-dark">
    <div class="accent-bar"></div>
    <div class="slide-header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="GoCab">` : ''}
        <div class="header-title-block">
          <span class="header-brand">GOCAB MOROCCO</span>
          <span class="header-sep">/</span>
          <span class="header-pill">INGÉNIERIE & OPÉRATIONS</span>
        </div>
      </div>
      <div class="slide-number">SLIDE 01 / 10</div>
    </div>

    <div class="grid-2col" style="padding-top: 15px; padding-bottom: 15px;">
      <!-- Left Column: Typography & Badges -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div style="display: inline-flex; align-items: center; gap: 8px;">
          <span class="pill-badge pill-gold">● WORKFLOW TECHNIQUE V2.4</span>
          <span class="pill-badge pill-navy">PORTAIL SINISTRES & FLOTTE</span>
        </div>

        <h1 class="title-hero">
          CYCLE DE VIE<br>
          <span class="highlight-gold">SINISTRE & ASSURANCE</span><br>
          <span class="highlight-olive">& TRAVAUX GARAGE</span>
        </h1>

        <p class="subtitle-lead">
          Guide exhaustif d'architecture logicielle et de réalité terrain au Maroc :
          de la déclaration sur la route par le chauffeur jusqu'à la restitution du véhicule
          par le garage conventionné et la réactivation de la télématique.
        </p>

        <div style="display: flex; align-items: center; gap: 20px; margin-top: 10px;">
          <div class="stat-circle circle-gold">
            <span style="font-size: 24px; line-height: 1;">8</span>
            <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em;">Étapes</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 13px; font-weight: 700; color: #F8FAFC;">Écosystème Connecté GoCab</span>
            <span style="font-size: 11px; color: #94A3B8;">Chauffeurs • Assureurs (Sanlam) • Experts • Garages (Émergence)</span>
            <span style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #F59E0B;">Next.js 14 • Turso SQLite • 360dialog WhatsApp API</span>
          </div>
        </div>
      </div>

      <!-- Right Column: Visual Preview Card -->
      <div style="position: relative;">
        <div style="position: absolute; -top: 20px; -right: 20px; width: 320px; height: 320px; background: radial-gradient(circle, rgba(245, 158, 11, 0.15), transparent 70%); border-radius: 50%; z-index: 1;"></div>
        <div class="card-glow-gold" style="position: relative; z-index: 2; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #EF4444; display: inline-block;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
              <span style="font-size: 11px; font-weight: 700; color: #CBD5E1; margin-left: 6px;">CRM Live — Dossier Sinistre Actif</span>
            </div>
            <span class="pill-badge pill-gold">WW028110 • Dacia Logan</span>
          </div>
          ${screenshotDossierBase64 ? `<img src="${screenshotDossierBase64}" class="screenshot-frame" style="height: 310px; object-position: top center;" alt="Dossier CRM">` : ''}
          <div style="margin-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #94A3B8;">
            <span>Gestionnaire : <strong>Mehdi Elyattouti</strong></span>
            <span>Carrosserie : <strong>Garage Émergence</strong></span>
            <span>Compagnie : <strong>Sanlam Maroc</strong></span>
          </div>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>GOCAB TECHNOLOGIES MOROCCO — DOCUMENT TECHNIQUE & OPÉRATIONNEL CONFIDENTIEL</span>
      <span class="font-mono">ENV: PRODUCTION • HORODATAGE: 2026-11-13</span>
    </div>
  </div>


  <!-- ========================================================
       SLIDE 02: PROBLEM & FIELD CHALLENGE (Inspired by Slide 2)
       High-Contrast Split Panel: Dark Challenge + Vibrant Stat
       ======================================================== -->
  <div class="slide bg-dark">
    <div class="accent-bar"></div>
    <div class="slide-header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="GoCab">` : ''}
        <div class="header-title-block">
          <span class="header-brand">GOCAB MOROCCO</span>
          <span class="header-sep">/</span>
          <span class="header-pill">RÉALITÉS DU TERRAIN</span>
        </div>
      </div>
      <div class="slide-number">SLIDE 02 / 10</div>
    </div>

    <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 32px; align-items: stretch; flex: 1; padding: 15px 0;">
      <!-- Left Panel: Problem Statement & Bullets -->
      <div class="card-dark" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="pill-badge pill-gold" style="margin-bottom: 12px;">DÉFI OPÉRATIONNEL #1</span>
          <h2 class="title-section">
            POURQUOI L'IMMOBILISATION DU VÉHICULE EST LE <span class="highlight-gold">COÛT MAJEUR</span> AU MAROC
          </h2>
          <p style="font-size: 14px; color: #94A3B8; line-height: 1.6; margin-bottom: 24px;">
            Dans le modèle de location-gérance et VTC/Taxi au Maroc, chaque jour d'arrêt au garage génère
            une perte nette de revenus pour le chauffeur et pour la flotte GoCab.
          </p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; gap: 16px; align-items: flex-start; padding: 14px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border-left: 4px solid #F59E0B;">
            <div style="font-size: 20px;">⏱️</div>
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #F8FAFC;">Lenteur d'Instruction d'Expertise</div>
              <div style="font-size: 12px; color: #94A3B8; line-height: 1.4;">
                Délai moyen initial de 8 à 14 jours entre le sinistre et la visite contradictoire de l'expert mandaté par Sanlam.
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 16px; align-items: flex-start; padding: 14px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border-left: 4px solid #60A5FA;">
            <div style="font-size: 20px;">📦</div>
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #F8FAFC;">Goulot d'Étranglement sur les Pièces Détachées</div>
              <div style="font-size: 12px; color: #94A3B8; line-height: 1.4;">
                Les carrosseries marocaines attendent souvent les pièces d'origine Dacia/Renault, gelant les travaux sans visibilité.
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 16px; align-items: flex-start; padding: 14px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border-left: 4px solid #8FA838;">
            <div style="font-size: 20px;">📉</div>
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #F8FAFC;">Perte Sèche Journalière de 350 à 450 MAD</div>
              <div style="font-size: 12px; color: #94A3B8; line-height: 1.4;">
                Immobilisation = perte de redevance journalière + risque de départ du chauffeur vers des flottes concurrentes.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Vibrant Color-Block Stat Banner (Inspiration Signature) -->
      <div class="card-glow-navy" style="background: linear-gradient(145deg, #162447 0%, #1E3A8A 50%, #35588F 100%); display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden;">
        <div style="position: absolute; right: -40px; bottom: -40px; width: 220px; height: 220px; background: radial-gradient(circle, rgba(245, 158, 11, 0.25), transparent 70%); border-radius: 50%;"></div>

        <div>
          <span class="pill-badge" style="background: rgba(255, 255, 255, 0.15); color: #FFFFFF; border: 1px solid rgba(255, 255, 255, 0.3);">OBJECTIF CRM GOCAB</span>
          <div style="margin-top: 20px;">
            <div style="font-size: 56px; font-weight: 900; line-height: 1; color: #FFFFFF; letter-spacing: -0.03em;">
              46 j <span style="font-size: 24px; color: #F59E0B;">➔</span> 14 j
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #F59E0B; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.05em;">
              Réduction du Temps Moyen d'Arrêt
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 14px; position: relative; z-index: 2;">
          <div style="padding: 12px 16px; background: rgba(0, 0, 0, 0.25); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="font-size: 11px; text-transform: uppercase; color: #93C5FD; font-weight: 700;">Flotte sous Surveillance</div>
            <div style="font-size: 22px; font-weight: 800; color: #FFFFFF; margin-top: 2px;">Casablanca & Rabat</div>
          </div>

          <div style="padding: 12px 16px; background: rgba(0, 0, 0, 0.25); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="font-size: 11px; text-transform: uppercase; color: #93C5FD; font-weight: 700;">Partenaire Carrosserie Actuel</div>
            <div style="font-size: 20px; font-weight: 800; color: #F59E0B; margin-top: 2px;">Garage Émergence</div>
          </div>

          <div style="padding: 12px 16px; background: rgba(0, 0, 0, 0.25); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="font-size: 11px; text-transform: uppercase; color: #93C5FD; font-weight: 700;">Superviseurs Opérations Dédiés</div>
            <div style="font-size: 16px; font-weight: 700; color: #FFFFFF; margin-top: 2px;">Mehdi Elyattouti & Mohamed Aziz</div>
          </div>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>ANALYSE DES PERFORMANCES FLOTTE MAROC — OBJECTIF OPÉRATIONNEL CRM</span>
      <span class="font-mono">KPI: DOWNTIME REDUCTION • TARGET -69%</span>
    </div>
  </div>


  <!-- ========================================================
       SLIDE 03: PHASE 1 — FIELD REALITY & CHAUFFEUR (Slide 3)
       Dark Interior Aesthetic + Glowing Accent Ribbon
       ======================================================== -->
  <div class="slide bg-dark">
    <div class="accent-bar"></div>
    <div class="slide-header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="GoCab">` : ''}
        <div class="header-title-block">
          <span class="header-brand">GOCAB MOROCCO</span>
          <span class="header-sep">/</span>
          <span class="header-pill">PHASE 1 : ACCIDENT & TERRAIN</span>
        </div>
      </div>
      <div class="slide-number">SLIDE 03 / 10</div>
    </div>

    <div class="grid-2col" style="padding: 15px 0;">
      <!-- Left: Moroccan Field Procedure -->
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div>
          <span class="pill-badge pill-olive">PROTOCOLE CHAUFFEUR GOCAB</span>
          <h2 class="title-section" style="margin-top: 8px;">
            LE CONSTAT AMIABLE & <span class="highlight-olive">SÉCURISATION DU VÉHICULE</span>
          </h2>
          <p style="font-size: 14px; color: #94A3B8; line-height: 1.55;">
            Dès la collision, le chauffeur doit respecter scrupuleusement la réglementation marocaine
            et les directives de la flotte sous peine de déchéance de garantie assurance.
          </p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div class="card-dark" style="padding: 14px 18px; border-left: 3px solid #8FA838;">
            <div style="font-size: 13px; font-weight: 700; color: #BEF264;">1. Constat Amiable Bilingue (Arabe / Français)</div>
            <div style="font-size: 12px; color: #94A3B8; margin-top: 3px;">
              Remplissage contradictoire sur place avec la partie adverse (croquis précis, cases cochées, immatriculations, signature).
            </div>
          </div>

          <div class="card-dark" style="padding: 14px 18px; border-left: 3px solid #F59E0B;">
            <div style="font-size: 13px; font-weight: 700; color: #F59E0B;">2. Alerte WhatsApp Instantanée à la Flotte</div>
            <div style="font-size: 12px; color: #94A3B8; margin-top: 3px;">
              Envoi direct des 4 photos du véhicule + photo du constat au superviseur de permanence (Hamza / Ayoub Rassid).
            </div>
          </div>

          <div class="card-dark" style="padding: 14px 18px; border-left: 3px solid #60A5FA;">
            <div style="font-size: 13px; font-weight: 700; color: #93C5FD;">3. Dépannage & Remorquage Agréé</div>
            <div style="font-size: 12px; color: #94A3B8; margin-top: 3px;">
              Si non roulant, transport direct vers <strong>Garage Émergence</strong> (Casablanca) ou hub agréé Rabat.
            </div>
          </div>

          <div class="card-dark" style="padding: 14px 18px; border-left: 3px solid #EF4444;">
            <div style="font-size: 13px; font-weight: 700; color: #FCA5A5;">4. Délai Légal Strict de Déclaration : 5 Jours Ouvrés</div>
            <div style="font-size: 12px; color: #94A3B8; margin-top: 3px;">
              Dépôt physique du constat original auprès de la compagnie d'assurance Sanlam.
            </div>
          </div>
        </div>
      </div>

      <!-- Right: CRM System Intake -->
      <div class="card-glow-navy" style="display: flex; flex-direction: column; gap: 16px; padding: 22px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #93C5FD; letter-spacing: 0.05em;">
            IMPLÉMENTATION LOGICIELLE CRM
          </span>
          <span class="pill-badge pill-gold">POST /api/accidents</span>
        </div>

        <div style="background: #0B0F17; border-radius: 12px; padding: 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #CBD5E1; line-height: 1.6; border: 1px solid rgba(255, 255, 255, 0.08);">
          <span style="color: #60A5FA;">model</span> <span style="color: #F59E0B;">AccidentReport</span> {<br>
          &nbsp;&nbsp;id&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #93C5FD;">String</span>&nbsp;&nbsp;&nbsp;&nbsp;@id @default(uuid())<br>
          &nbsp;&nbsp;vehicle_plate&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #93C5FD;">String</span>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748B;">// ex: "WW028110"</span><br>
          &nbsp;&nbsp;driver_name&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #93C5FD;">String</span>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748B;">// "CHETOUI MOHAMED HASSAN"</span><br>
          &nbsp;&nbsp;city&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #93C5FD;">String</span>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748B;">// Casablanca | Rabat</span><br>
          &nbsp;&nbsp;insurance_company&nbsp;<span style="color: #93C5FD;">String</span>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748B;">// "Sanlam"</span><br>
          &nbsp;&nbsp;assigned_garage&nbsp;&nbsp;&nbsp;<span style="color: #93C5FD;">String</span>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748B;">// "Emergence"</span><br>
          &nbsp;&nbsp;garage_status&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #93C5FD;">String</span>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748B;">// "NEW_ACCIDENT"</span><br>
          &nbsp;&nbsp;days_in_status&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #93C5FD;">Int</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@default(0)<br>
          }
        </div>

        <div style="display: flex; gap: 12px;">
          <div style="flex: 1; padding: 12px; background: rgba(255, 255, 255, 0.04); border-radius: 10px;">
            <div style="font-size: 10px; color: #94A3B8; text-transform: uppercase;">Alerte WhatsApp Manager</div>
            <div style="font-size: 13px; font-weight: 700; color: #F59E0B; margin-top: 2px;">Automatisée 16:11</div>
          </div>
          <div style="flex: 1; padding: 12px; background: rgba(255, 255, 255, 0.04); border-radius: 10px;">
            <div style="font-size: 10px; color: #94A3B8; text-transform: uppercase;">Compteur d'Arrêt</div>
            <div style="font-size: 13px; font-weight: 700; color: #BEF264; margin-top: 2px;">Démarrage Jour J</div>
          </div>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>PROCÉDURE DÉCLARATIVE MAROC — INTÉGRATION BASE DE DONNÉES PRISMA</span>
      <span class="font-mono">API: POST /API/ACCIDENTS • EVENT: ACCIDENT_REGISTERED</span>
    </div>
  </div>


  <!-- ========================================================
       SLIDE 04: PHASE 2 — DOCUMENT INTAKE (Slide 4 Light Grid)
       Crisp Studio Light + 2x3 Document Cards + Upload UI
       ======================================================== -->
  <div class="slide bg-light">
    <div class="accent-bar-top"></div>
    <div class="slide-header light-mode">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="GoCab">` : ''}
        <div class="header-title-block">
          <span class="header-brand">GOCAB MOROCCO</span>
          <span class="header-sep">/</span>
          <span class="header-pill">PHASE 2 : PIÈCES & DOCUMENTS</span>
        </div>
      </div>
      <div class="slide-number">SLIDE 04 / 10</div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 16px; flex: 1; padding: 15px 0;">
      <div>
        <span class="pill-badge pill-navy" style="margin-bottom: 8px;">AUDIT & CONFORMITÉ DU DOSSIER</span>
        <h2 class="title-section" style="color: #0F172A; margin-bottom: 4px;">
          LES 6 DOCUMENTS OBLIGATOIRES <span class="highlight-navy">POUR DÉBLOQUER L'EXPERTISE</span>
        </h2>
        <p class="subtitle-lead">
          L'assureur Sanlam et l'expert refusent tout chiffrage si le dossier documentaire n'est pas exhaustif à 100%.
        </p>
      </div>

      <!-- 2x3 Grid of Required Moroccan Documents -->
      <div class="grid-2x3">
        <div class="card-light" style="padding: 16px; border-left: 4px solid #35588F;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 18px;">📋</span>
            <span class="pill-badge pill-navy">OBLIGATOIRE</span>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A;">Constat Amiable Recto/Verso</div>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px; line-height: 1.4;">
            Copie haute résolution avec signature des 2 conducteurs et croquis de l'accident.
          </div>
        </div>

        <div class="card-light" style="padding: 16px; border-left: 4px solid #5D6B2D;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 18px;">🚗</span>
            <span class="pill-badge pill-olive">CARTE GRISE</span>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A;">Carte Grise GoCab Rent</div>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px; line-height: 1.4;">
            Vérification de la validité du certificat d'immatriculation et du propriétaire légal.
          </div>
        </div>

        <div class="card-light" style="padding: 16px; border-left: 4px solid #F59E0B;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 18px;">🪪</span>
            <span class="pill-badge pill-gold">CHAUFFEUR</span>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A;">Permis de Conduire Marocain</div>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px; line-height: 1.4;">
            Catégorie B valide du chauffeur déclaré au contrat de location (ex: Chetoui M.).
          </div>
        </div>

        <div class="card-light" style="padding: 16px; border-left: 4px solid #35588F;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 18px;">📸</span>
            <span class="pill-badge pill-navy">4 ANGLES</span>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A;">Photos Dégâts & Véhicule</div>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px; line-height: 1.4;">
            Face avant, arrière, côtés, gros plan sur le point d'impact et immatriculation lisible.
          </div>
        </div>

        <div class="card-light" style="padding: 16px; border-left: 4px solid #5D6B2D;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 18px;">🏢</span>
            <span class="pill-badge pill-olive">CONTRAT</span>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A;">Police d'Assurance Sanlam</div>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px; line-height: 1.4;">
            Attestation d'assurance en cours de validité (ex: POL-984210-2026).
          </div>
        </div>

        <div class="card-light" style="padding: 16px; border-left: 4px solid #F59E0B;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 18px;">📄</span>
            <span class="pill-badge pill-gold">DEVIS</span>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A;">Devis Émergence & PEC</div>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px; line-height: 1.4;">
            Chiffrage carrossier + lettre de prise en charge avec franchise stipulée.
          </div>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>STOCKAGE SÉCURISÉ CLOUDINARY CDN AVEC LIENS EXPIRABLES CHIFFRÉS</span>
      <span class="font-mono">INTEGRITY: 6/6 VERIFIED • STORAGE: CLOUDINARY ASSETS</span>
    </div>
  </div>


  <!-- ========================================================
       SLIDE 05: PHASE 3 — TRIPARTITE HUB DIAGRAM (Inspiration)
       Central Glowing Hub + 4 Satellite Nodes with Connecting Lines
       ======================================================== -->
  <div class="slide bg-dark">
    <div class="accent-bar"></div>
    <div class="slide-header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="GoCab">` : ''}
        <div class="header-title-block">
          <span class="header-brand">GOCAB MOROCCO</span>
          <span class="header-sep">/</span>
          <span class="header-pill">ÉCOSYSTÈME TRIPARTITE</span>
        </div>
      </div>
      <div class="slide-number">SLIDE 05 / 10</div>
    </div>

    <div style="display: flex; flex-direction: column; flex: 1; align-items: center; justify-content: center;">
      <div style="text-align: center; margin-bottom: 10px;">
        <span class="pill-badge pill-gold" style="margin-bottom: 6px;">ARCHITECTURE RELATIONNELLE</span>
        <h2 class="title-section" style="font-size: 30px; margin-bottom: 4px;">
          LE NŒUD DE SYNCHRONISATION <span class="highlight-gold">GOCAB CRM</span>
        </h2>
        <p style="font-size: 13px; color: #94A3B8;">
          4 intervenants interconnectés en temps réel avec des droits d'accès granulaires stricts.
        </p>
      </div>

      <!-- Radial Infographic Hub (Slide 5 Style in Design Inspiration) -->
      <div class="hub-container">
        <!-- SVG Connecting Lines -->
        <svg style="position: absolute; width: 100%; height: 100%; z-index: 1;" viewBox="0 0 1000 480">
          <line x1="500" y1="240" x2="250" y2="90" stroke="#35588F" stroke-width="3" stroke-dasharray="6 6" />
          <line x1="500" y1="240" x2="750" y2="90" stroke="#F59E0B" stroke-width="3" stroke-dasharray="6 6" />
          <line x1="500" y1="240" x2="250" y2="390" stroke="#5D6B2D" stroke-width="3" stroke-dasharray="6 6" />
          <line x1="500" y1="240" x2="750" y2="390" stroke="#60A5FA" stroke-width="3" stroke-dasharray="6 6" />
        </svg>

        <!-- Center Node: GoCab Core -->
        <div class="hub-center">
          ${logoBase64 ? `<img src="${logoBase64}" style="height: 34px; margin-bottom: 4px;" alt="GoCab">` : ''}
          <div style="font-size: 14px; font-weight: 900; color: #FFFFFF;">GOCAB CRM</div>
          <div style="font-size: 9px; color: #F59E0B; font-weight: 700; text-transform: uppercase;">Moteur LiveSync</div>
        </div>

        <!-- Node 1: GoCab Operations (Top-Left) -->
        <div class="hub-node hub-node-tl" style="border-left: 4px solid #35588F;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; font-weight: 800; color: #60A5FA;">1. GESTIONNAIRE FLOTTE</span>
            <span style="font-size: 16px;">👤</span>
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #FFFFFF; margin-top: 4px;">Mehdi Elyattouti / M. Aziz</div>
          <div style="font-size: 11px; color: #94A3B8; margin-top: 3px;">
            Déclaration initiale, validation du dossier, contact chauffeur et clic de confirmation « Créé sur Fleet ».
          </div>
        </div>

        <!-- Node 2: Assurance Company (Top-Right) -->
        <div class="hub-node hub-node-tr" style="border-left: 4px solid #F59E0B;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; font-weight: 800; color: #F59E0B;">2. ASSURANCE COMPAGNIE</span>
            <span style="font-size: 16px;">🛡️</span>
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #FFFFFF; margin-top: 4px;">Sanlam / AtlantaSanad</div>
          <div style="font-size: 11px; color: #94A3B8; margin-top: 3px;">
            Attribution du N° de sinistre officiel, mandat de mission à l'expert et accord de Prise en Charge (PEC).
          </div>
        </div>

        <!-- Node 3: Expert Cabinet (Bottom-Left) -->
        <div class="hub-node hub-node-bl" style="border-left: 4px solid #5D6B2D;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; font-weight: 800; color: #BEF264;">3. CABINET D'EXPERTISE</span>
            <span style="font-size: 16px;">🔍</span>
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #FFFFFF; margin-top: 4px;">Expert Indépendant Agréé</div>
          <div style="font-size: 11px; color: #94A3B8; margin-top: 3px;">
            Visite physique au garage, chiffrage des heures de tôlerie/peinture et validation du devis pièces.
          </div>
        </div>

        <!-- Node 4: Repair Body Shop (Bottom-Right) -->
        <div class="hub-node hub-node-br" style="border-left: 4px solid #60A5FA;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; font-weight: 800; color: #93C5FD;">4. CARROSSERIE CONVENTIONNÉE</span>
            <span style="font-size: 16px;">🔧</span>
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #FFFFFF; margin-top: 4px;">Garage Émergence (Casablanca)</div>
          <div style="font-size: 11px; color: #94A3B8; margin-top: 3px;">
            Réception du véhicule, mise à jour de la timeline 8 étapes, exécution des réparations et bon de sortie.
          </div>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>TOPOLOGIE DE COMMUNICATION MULTI-INTERVENANTS — TEMPS RÉEL PRISMA + WEBSOCKETS</span>
      <span class="font-mono">PROTOCOL: REST / WEBSOCKET • AUTH: RBAC SCOPED TOKEN</span>
    </div>
  </div>


  <!-- ========================================================
       SLIDE 06: PHASE 4 — 8-STEP TIMELINE & DONUT (Slide 6 Style)
       Bold Saturated Color-Block + Donut Chart + Real Timeline UI
       ======================================================== -->
  <div class="slide bg-brand-vibrant">
    <div class="accent-bar"></div>
    <div class="slide-header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="GoCab">` : ''}
        <div class="header-title-block">
          <span class="header-brand">GOCAB MOROCCO</span>
          <span class="header-sep">/</span>
          <span class="header-pill" style="background: rgba(255, 255, 255, 0.2); color: #FFFFFF; border-color: rgba(255, 255, 255, 0.4);">
            CHRONOLOGIE EN 8 ÉTAPES
          </span>
        </div>
      </div>
      <div class="slide-number" style="background: rgba(255, 255, 255, 0.1); color: #FFFFFF; border-color: rgba(255, 255, 255, 0.2);">
        SLIDE 06 / 10
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 32px; align-items: center; flex: 1; padding: 15px 0;">
      <!-- Left: Donut Chart Distribution of Downtime (Slide 6 in Reference) -->
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
        <span class="pill-badge" style="background: rgba(245, 158, 11, 0.25); color: #F59E0B; border: 1px solid #F59E0B; margin-bottom: 8px;">
          RÉPARTITION DU TEMPS EN GARAGE
        </span>
        <h3 style="font-size: 22px; font-weight: 800; color: #FFFFFF; margin-bottom: 16px;">
          OÙ PASSENT LES JOURS D'ARRÊT ?
        </h3>

        <!-- Donut Chart SVG -->
        <div class="donut-chart-box">
          <svg width="220" height="220" viewBox="0 0 42 42">
            <circle class="donut-hole" cx="21" cy="21" r="15.91549430918954" fill="transparent"></circle>
            <circle class="donut-ring" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="rgba(255,255,255,0.15)" stroke-width="5"></circle>
            <!-- 25% Expertise (Amber) -->
            <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#F59E0B" stroke-width="5" stroke-dasharray="25 75" stroke-dashoffset="25"></circle>
            <!-- 35% Pièces détachées (Navy Deep) -->
            <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#60A5FA" stroke-width="5" stroke-dasharray="35 65" stroke-dashoffset="0"></circle>
            <!-- 25% Tôlerie & Peinture (Olive) -->
            <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#8FA838" stroke-width="5" stroke-dasharray="25 75" stroke-dashoffset="65"></circle>
            <!-- 15% Prise en Charge Finale (Red/Purple) -->
            <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#EC4899" stroke-width="5" stroke-dasharray="15 85" stroke-dashoffset="40"></circle>
          </svg>
          <div class="donut-center-stat">
            <div style="font-size: 28px; font-weight: 900; color: #FFFFFF;">100%</div>
            <div style="font-size: 9px; text-transform: uppercase; color: #CBD5E1; font-weight: 700;">Traçabilité</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; margin-top: 14px; text-align: left; font-size: 11px;">
          <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span> <span>25% Visite Expert</span></div>
          <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #60A5FA; display: inline-block;"></span> <span>35% Attente Pièces</span></div>
          <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #8FA838; display: inline-block;"></span> <span>25% Tôlerie/Peinture</span></div>
          <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #EC4899; display: inline-block;"></span> <span>15% Accord PEC Final</span></div>
        </div>
      </div>

      <!-- Right: Real CRM 8-Step Interactive Timeline Component -->
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 18px; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 13px; font-weight: 800; color: #FFFFFF; text-transform: uppercase;">
              COMPOSANT CRM : AVANCEMENT DU VÉHICULE AU GARAGE
            </span>
            <span class="pill-badge pill-gold">8 ÉTAPES LINÉAIRES</span>
          </div>

          ${screenshotTimelineBase64 ? `<img src="${screenshotTimelineBase64}" class="screenshot-frame" style="height: auto; max-height: 140px;" alt="Timeline Garage">` : ''}

          <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px;">
            <div style="padding: 8px 12px; background: rgba(255, 255, 255, 0.08); border-radius: 8px;">
              <strong style="color: #F59E0B;">#1-2 : GoCab & Assureur</strong><br>
              <span style="color: #E2E8F0;">Déclaration + Ordre de mission garage.</span>
            </div>
            <div style="padding: 8px 12px; background: rgba(255, 255, 255, 0.08); border-radius: 8px;">
              <strong style="color: #60A5FA;">#3-4 : Garage & Expert</strong><br>
              <span style="color: #E2E8F0;">Dépôt photos/devis + validation chiffrage.</span>
            </div>
            <div style="padding: 8px 12px; background: rgba(255, 255, 255, 0.08); border-radius: 8px;">
              <strong style="color: #BEF264;">#5-6 : Carrosserie Émergence</strong><br>
              <span style="color: #E2E8F0;">Démarrage des travaux + attente PEC final.</span>
            </div>
            <div style="padding: 8px 12px; background: rgba(255, 255, 255, 0.08); border-radius: 8px;">
              <strong style="color: #F472B6;">#7-8 : Restitution & Flotte</strong><br>
              <span style="color: #E2E8F0;">Véhicule prêt + réactivation chauffeur.</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="slide-footer" style="border-color: rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.7);">
      <span>MACHINE À ÉTATS FINIS — VALIDATION PAR INTERVENANT MANDATÉ</span>
      <span class="font-mono">STATE-MACHINE: 8 STRICT STEPS • AUDIT LOG: ON-CHANGE</span>
    </div>
  </div>


  <!-- ========================================================
       SLIDE 07: REAL CRM CASE STUDY — WW028110 (Slide 7 Style)
       3-Panel Split Layout: Identity + Screenshot + Automations
       ======================================================== -->
  <div class="slide bg-dark">
    <div class="accent-bar"></div>
    <div class="slide-header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="GoCab">` : ''}
        <div class="header-title-block">
          <span class="header-brand">GOCAB MOROCCO</span>
          <span class="header-sep">/</span>
          <span class="header-pill">CAS RÉEL EN PRODUCTION</span>
        </div>
      </div>
      <div class="slide-number">SLIDE 07 / 10</div>
    </div>

    <div style="display: grid; grid-template-columns: 0.8fr 1.4fr 0.8fr; gap: 20px; align-items: stretch; flex: 1; padding: 15px 0;">
      <!-- Panel 1: Vehicle & Driver Identity -->
      <div class="card-dark" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="pill-badge pill-gold" style="margin-bottom: 10px;">VÉHICULE EN ARRÊT</span>
          <div style="font-size: 32px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.02em;">WW028110</div>
          <div style="font-size: 14px; font-weight: 700; color: #F59E0B; margin-top: 2px;">DACIA LOGAN (2025)</div>
          <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">📍 Casablanca • Flotte Taxi/VTC</div>
        </div>

        <div style="padding: 14px; background: rgba(255, 255, 255, 0.04); border-radius: 12px; border-left: 3px solid #60A5FA;">
          <div style="font-size: 10px; text-transform: uppercase; color: #94A3B8;">Chauffeur Titulaire</div>
          <div style="font-size: 14px; font-weight: 800; color: #FFFFFF; margin-top: 2px;">CHETOUI MOHAMED HASSAN</div>
          <div style="font-size: 11px; color: #93C5FD; font-family: 'JetBrains Mono', monospace; margin-top: 2px;">+212 612 514 285</div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px;">
            <span style="color: #94A3B8;">Compagnie :</span>
            <strong style="color: #FFFFFF;">Sanlam Maroc</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px;">
            <span style="color: #94A3B8;">Carrosserie :</span>
            <strong style="color: #F59E0B;">Garage Émergence</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94A3B8;">Statut CRM :</span>
            <strong style="color: #BEF264;">Nouveau Sinistre</strong>
          </div>
        </div>
      </div>

      <!-- Panel 2: Real Full Screen CRM Dossier (Center Hero) -->
      <div class="card-glow-gold" style="padding: 12px; display: flex; flex-direction: column; justify-content: center;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 0 4px;">
          <span style="font-size: 11px; font-weight: 800; color: #F59E0B; text-transform: uppercase;">
            DOSSIER GOCAB CRM : WW028110
          </span>
          <span style="font-size: 10px; color: #94A3B8;">Capture Authentique de Production</span>
        </div>
        ${screenshotDossierBase64 ? `<img src="${screenshotDossierBase64}" class="screenshot-frame" style="height: 380px; object-position: top center;" alt="Dossier Réel">` : ''}
      </div>

      <!-- Panel 3: Actionable Automations & Fleet Trigger -->
      <div class="card-dark" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="pill-badge pill-navy" style="margin-bottom: 10px;">SYNCHRONISATION FLOTTE</span>
          <h4 style="font-size: 16px; font-weight: 800; color: #FFFFFF;">Bannière Gestionnaire Mehdi Elyattouti</h4>
          <p style="font-size: 11px; color: #94A3B8; margin-top: 6px; line-height: 1.4;">
            Le CRM alerte automatiquement le gestionnaire de flotte sur WhatsApp (16:11) jusqu'à ce que le sinistre soit créé sur GoCab Fleet.
          </p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="padding: 10px 14px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 10px; color: #10B981; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span>✓</span> <span>Bouton « Créé sur GoCab Fleet »</span>
          </div>
          <div style="padding: 10px 14px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 10px; color: #F59E0B; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span>🔄</span> <span>Relancer WhatsApp</span>
          </div>
          <div style="padding: 10px 14px; background: rgba(53, 88, 143, 0.2); border: 1px solid rgba(53, 88, 143, 0.45); border-radius: 10px; color: #93C5FD; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span>💾</span> <span>Enregistrer Dossier Assureur</span>
          </div>
        </div>

        <div style="font-size: 10px; color: #64748B; line-height: 1.4;">
          * Évite les doublons administratifs et assure le suivi comptable de la franchise.
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>DONNÉES FLOTTE GOCAB MAROC — IDENTIFIANT UNIQUE IMMATRICULATION WW028110</span>
      <span class="font-mono">RECORD_ID: WW028110 • FLEET_MANAGER: MEHDI_ELYATTOUTI</span>
    </div>
  </div>


  <!-- ========================================================
       SLIDE 08: ASSURANCE PORTAL & RBAC SECURITY (Slide 8 Style)
       Editorial Split Layout: Light Access View + Dark Security
       ======================================================== -->
  <div class="slide bg-dark">
    <div class="accent-bar"></div>
    <div class="slide-header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="GoCab">` : ''}
        <div class="header-title-block">
          <span class="header-brand">GOCAB MOROCCO</span>
          <span class="header-sep">/</span>
          <span class="header-pill">SÉCURITÉ & ACCÈS TIERS (RBAC)</span>
        </div>
      </div>
      <div class="slide-number">SLIDE 08 / 10</div>
    </div>

    <div class="grid-2col" style="padding: 15px 0;">
      <!-- Left: Scoped External Access (Light Contrast Card) -->
      <div class="card-light" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span class="pill-badge pill-olive">RÔLE SÉCURISÉ : ASSURANCE</span>
            <span style="font-size: 11px; font-weight: 700; color: #0F172A;">PORTAIL PARTAGÉ</span>
          </div>

          <h3 style="font-size: 24px; font-weight: 900; color: #0F172A; line-height: 1.25;">
            ACCÈS RESTREINT POUR L'AGENT D'ASSURANCE SANLAM
          </h3>

          <p style="font-size: 13px; color: #475569; margin-top: 8px; line-height: 1.5;">
            L'assureur externe et le cabinet d'expertise ont un accès direct au CRM pour renseigner le statut
            du sinistre, mais avec un cloisonnement étanche des données financières.
          </p>
        </div>

        <div style="margin: 18px 0; padding: 14px; background: #F8FAFC; border-radius: 12px; border: 1px dashed #CBD5E1;">
          <div style="font-size: 12px; font-weight: 800; color: #0F172A; margin-bottom: 6px;">🔒 Masquage Strict des Éléments Confidentiels :</div>
          <ul style="font-size: 12px; color: #64748B; padding-left: 20px; line-height: 1.6;">
            <li><strong>Bouton Rappels Réparations</strong> complètement masqué (${screenshotRappelsBase64 ? `<img src="${screenshotRappelsBase64}" style="height: 16px; vertical-align: middle;" alt="Rappels">` : '4 dû(s)'}).</li>
            <li>Aucun accès aux soldes d'impayés chauffeurs ni au bilan financier de la flotte.</li>
            <li>Aucun accès aux modules Acquisition, Leads, ou Direction Générale.</li>
          </ul>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 10px;">
          <span>Compteur jours d'arrêt : <strong>Dès l'apparition sur la page</strong></span>
          <span class="pill-badge pill-gold">0 j Arrêt Moyen</span>
        </div>
      </div>

      <!-- Right: Technical Enforcement & Code Matrix -->
      <div class="card-glow-navy" style="display: flex; flex-direction: column; justify-content: space-between; padding: 24px;">
        <div>
          <span class="pill-badge pill-gold" style="margin-bottom: 12px;">IMPLÉMENTATION AUTHENTIFICATION</span>
          <h3 style="font-size: 22px; font-weight: 800; color: #FFFFFF;">
            CONTRÔLE D'ACCÈS RBAC AU NIVEAU DE L'API
          </h3>
          <p style="font-size: 13px; color: #94A3B8; margin-top: 6px; line-height: 1.5;">
            Sécurisation côté serveur dans les Route Handlers Next.js et middleware de session.
          </p>
        </div>

        <div style="background: #0B0F17; border-radius: 12px; padding: 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #CBD5E1; line-height: 1.6; border: 1px solid rgba(255, 255, 255, 0.08);">
          <span style="color: #60A5FA;">// Role-Based Authorization Enforcement</span><br>
          <span style="color: #F59E0B;">const</span> session = <span style="color: #60A5FA;">await</span> getServerSession(authOptions);<br>
          <br>
          <span style="color: #60A5FA;">if</span> (session?.user?.role === <span style="color: #BEF264;">"ASSURANCE"</span>) {<br>
          &nbsp;&nbsp;<span style="color: #64748B;">// Restrict query to Sinistres only</span><br>
          &nbsp;&nbsp;<span style="color: #64748B;">// Omit internal notes, debts, repair reminders</span><br>
          &nbsp;&nbsp;<span style="color: #F59E0B;">return</span> NextResponse.json({<br>
          &nbsp;&nbsp;&nbsp;&nbsp;accidents: filteredAccidents,<br>
          &nbsp;&nbsp;&nbsp;&nbsp;permissions: { hideReminders: <span style="color: #BEF264;">true</span> }<br>
          &nbsp;&nbsp;});<br>
          }
        </div>

        <div style="display: flex; gap: 12px; font-size: 11px;">
          <div style="flex: 1; padding: 10px; background: rgba(255, 255, 255, 0.04); border-radius: 8px;">
            <div style="color: #94A3B8;">Session Token</div>
            <div style="color: #FFFFFF; font-weight: 700; margin-top: 2px;">JWT Chiffré HS256</div>
          </div>
          <div style="flex: 1; padding: 10px; background: rgba(255, 255, 255, 0.04); border-radius: 8px;">
            <div style="color: #94A3B8;">Audit Trail</div>
            <div style="color: #F59E0B; font-weight: 700; margin-top: 2px;">Traçabilité par IP/Agent</div>
          </div>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>ARCHITECTURE SÉCURISÉE MULTI-TENANT — ISOLATION DES DONNÉES SENSIBLES</span>
      <span class="font-mono">SECURITY: RBAC RESTRICTED • ENDPOINT: /API/ACCIDENTS?ROLE=ASSURANCE</span>
    </div>
  </div>


  <!-- ========================================================
       SLIDE 09: WHATSAPP CLOUD API & LIVE SYNC (Slide 9 Style)
       Modern Layout with Floating Circular Metric Badges
       ======================================================== -->
  <div class="slide bg-dark">
    <div class="accent-bar"></div>
    <div class="slide-header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="GoCab">` : ''}
        <div class="header-title-block">
          <span class="header-brand">GOCAB MOROCCO</span>
          <span class="header-sep">/</span>
          <span class="header-pill">COMMUNICATION AUTOMATISÉE</span>
        </div>
      </div>
      <div class="slide-number">SLIDE 09 / 10</div>
    </div>

    <div class="grid-2col" style="padding: 15px 0;">
      <!-- Left: WhatsApp Real Interface Screenshot -->
      <div class="card-glow-navy" style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">💬</span>
            <span style="font-size: 12px; font-weight: 800; color: #FFFFFF;">WHATSAPP CRM INTEGRATION</span>
          </div>
          <span class="pill-badge pill-olive">API 360DIALOG VÉRIFIÉE</span>
        </div>

        ${screenshotWhatsAppBase64 ? `<img src="${screenshotWhatsAppBase64}" class="screenshot-frame" style="height: 330px; object-position: top center;" alt="WhatsApp CRM">` : ''}

        <div style="margin-top: 10px; font-size: 11px; color: #94A3B8; display: flex; justify-content: space-between;">
          <span>Ligne WhatsApp officielle : <strong>+212 6 62 14 51 09</strong></span>
          <span style="color: #BEF264;">● Bot Actif • Session Live</span>
        </div>
      </div>

      <!-- Right: Floating Circular Metric Badges & Capabilities -->
      <div style="display: flex; flex-direction: column; justify-content: space-between; gap: 16px;">
        <div>
          <span class="pill-badge pill-gold" style="margin-bottom: 8px;">MÉTROLOGIE & DISPONIBILITÉ</span>
          <h3 class="title-section" style="font-size: 28px;">
            ALERTE INSTANTANÉE & <span class="highlight-gold">SYNCHRONISATION EN DIRECT</span>
          </h3>
          <p style="font-size: 13px; color: #94A3B8; line-height: 1.5;">
            L'ensemble des intervenants (gestionnaires, experts, carrossiers) est notifié en continu
            sans quitter le CRM grâce aux webhooks Meta Cloud API.
          </p>
        </div>

        <!-- Metric Badges Row (Inspired by Slide 9 in Reference) -->
        <div style="display: flex; gap: 20px; align-items: center;">
          <div class="stat-circle circle-gold">
            <span style="font-size: 22px; font-weight: 900;">0s</span>
            <span style="font-size: 9px; text-transform: uppercase;">Latence</span>
          </div>
          <div class="stat-circle circle-navy">
            <span style="font-size: 20px; font-weight: 900;">100%</span>
            <span style="font-size: 9px; text-transform: uppercase;">Délivré</span>
          </div>
          <div class="stat-circle circle-olive">
            <span style="font-size: 20px; font-weight: 900;">24/7</span>
            <span style="font-size: 9px; text-transform: uppercase;">Webhooks</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div class="card-dark" style="padding: 12px 16px; border-left: 3px solid #F59E0B;">
            <div style="font-size: 12px; font-weight: 700; color: #FFFFFF;">Templates Validés Meta Business</div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">
              Modèles officiels d'invitation et convocation géolocalisée (Rabat, Casablanca, Kénitra).
            </div>
          </div>

          <div class="card-dark" style="padding: 12px 16px; border-left: 3px solid #60A5FA;">
            <div style="font-size: 12px; font-weight: 700; color: #FFFFFF;">LiveSync BroadcastChannel</div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">
              Mise à jour instantanée des écrans de tous les agents connectés lors d'une modification de statut.
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>INTÉGRATION CLOUD API META — GESTION DE LA FENÊTRE DE MESSAGERIE 24H</span>
      <span class="font-mono">PROVIDER: 360DIALOG • WEBHOOK: /API/WHATSAPP/WEBHOOK</span>
    </div>
  </div>


  <!-- ========================================================
       SLIDE 10: FULL TECHNICAL ARCHITECTURE & ROADMAP (Slide 10)
       High-Impact Atmospheric Closing Slide + Stack Specs
       ======================================================== -->
  <div class="slide bg-dark" style="background: radial-gradient(circle at 80% 20%, rgba(53, 88, 143, 0.25), rgba(11, 15, 23, 1) 70%);">
    <div class="accent-bar"></div>
    <div class="slide-header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="GoCab">` : ''}
        <div class="header-title-block">
          <span class="header-brand">GOCAB MOROCCO</span>
          <span class="header-sep">/</span>
          <span class="header-pill">ARCHITECTURE TECHNIQUE GLOBALE</span>
        </div>
      </div>
      <div class="slide-number">SLIDE 10 / 10</div>
    </div>

    <div class="grid-2col" style="padding: 15px 0;">
      <!-- Left: Technology Stack -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <span class="pill-badge pill-gold" style="margin-bottom: 8px;">STACK TECHNIQUE PRODUCTION</span>
          <h2 class="title-section" style="font-size: 32px;">
            ARCHITECTURE SYSTÈME & <span class="highlight-gold">FLUX DE DONNÉES</span>
          </h2>
          <p style="font-size: 13px; color: #94A3B8; line-height: 1.5;">
            Conçue pour garantir une haute disponibilité, une latence sous les 100ms et une conformité RGPD/CNDP marocaine.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="card-dark" style="padding: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #60A5FA; font-weight: 700;">Frontend & SSR</div>
            <div style="font-size: 15px; font-weight: 800; color: #FFFFFF; margin-top: 2px;">Next.js 14 App Router</div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 4px;">React 19 Server Components & TailwindCSS.</div>
          </div>

          <div class="card-dark" style="padding: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #F59E0B; font-weight: 700;">Base de Données</div>
            <div style="font-size: 15px; font-weight: 800; color: #FFFFFF; margin-top: 2px;">Turso SQLite Cloud</div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 4px;">Réplication Edge avec failover local dev.db.</div>
          </div>

          <div class="card-dark" style="padding: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #8FA838; font-weight: 700;">ORM & Migrations</div>
            <div style="font-size: 15px; font-weight: 800; color: #FFFFFF; margin-top: 2px;">Prisma 7.9 LibSQL</div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 4px;">Schéma strict, transactions atomiques.</div>
          </div>

          <div class="card-dark" style="padding: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #EC4899; font-weight: 700;">CDN & Médias</div>
            <div style="font-size: 15px; font-weight: 800; color: #FFFFFF; margin-top: 2px;">Cloudinary CDN</div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 4px;">Compression à la volée des constats et photos.</div>
          </div>
        </div>
      </div>

      <!-- Right: Roadmap & SLAs -->
      <div class="card-glow-gold" style="display: flex; flex-direction: column; justify-content: space-between; padding: 24px;">
        <div>
          <span class="pill-badge pill-gold" style="margin-bottom: 10px;">ENGAGEMENTS DE SERVICE (SLA)</span>
          <h3 style="font-size: 22px; font-weight: 900; color: #FFFFFF;">
            OBJECTIFS INGÉNIERIE & LIVRABLES SQUAD
          </h3>
          <p style="font-size: 13px; color: #CBD5E1; margin-top: 6px; line-height: 1.5;">
            Le système transforme la gestion des sinistres d'un goulot d'étranglement administratif
            en un avantage concurrentiel automatisé pour GoCab.
          </p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; margin: 16px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(0,0,0,0.25); border-radius: 10px;">
            <span style="font-size: 12px; color: #FFFFFF; font-weight: 600;">Délai moyen de transmission à l'expert</span>
            <strong style="font-size: 14px; color: #F59E0B;">&lt; 24 Heures</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(0,0,0,0.25); border-radius: 10px;">
            <span style="font-size: 12px; color: #FFFFFF; font-weight: 600;">Traçabilité documentaire complète</span>
            <strong style="font-size: 14px; color: #BEF264;">100% Digitalisée</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(0,0,0,0.25); border-radius: 10px;">
            <span style="font-size: 12px; color: #FFFFFF; font-weight: 600;">Temps de réponse WhatsApp</span>
            <strong style="font-size: 14px; color: #93C5FD;">Instantané (API)</strong>
          </div>
        </div>

        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 11px; color: #94A3B8;">
            Signé : <strong>Équipe Technique & Produit GoCab</strong>
          </div>
          <span class="pill-badge pill-gold">PRÊT POUR DÉPLOIEMENT</span>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>GOCAB PLATFORM ENGINEERING — DÉPLOIEMENT CONTINU PRODUCTION VERCEL</span>
      <span class="font-mono">STATUS: DEPLOYED • REVISION: 2026.11.V2</span>
    </div>
  </div>

</body>
</html>
`;

// Output file paths
const tempHtmlPath = path.join(process.env.TEMP || 'C:\\Users\\Dell\\AppData\\Local\\Temp', 'gocab_sinistre_presentation.html');
const tempPdfPath = path.join(process.env.TEMP || 'C:\\Users\\Dell\\AppData\\Local\\Temp', 'gocab_sinistre_presentation.pdf');

const artifactPdfPath = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\4a835044-d1db-4c36-a40a-a23ba766abfb\\GoCab_Workflow_Sinistre_Assurance_Garage.pdf';
const artifactHtmlPath = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\4a835044-d1db-4c36-a40a-a23ba766abfb\\GoCab_Workflow_Sinistre_Assurance_Garage.html';

const workspacePdfPath = path.join(process.cwd(), 'GoCab_Workflow_Sinistre_Assurance_Garage.pdf');
const workspaceHtmlPath = path.join(process.cwd(), 'GoCab_Workflow_Sinistre_Assurance_Garage.html');

fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
console.log('Wrote presentation HTML to:', tempHtmlPath);

// Chrome executable path on Windows
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!fs.existsSync(chromePath)) {
  console.error('Chrome executable not found at:', chromePath);
  process.exit(1);
}

console.log('Running Chrome Headless PDF export...');
const cmd = `"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${tempPdfPath}" "${tempHtmlPath}"`;

try {
  execSync(cmd, { stdio: 'inherit' });
  const pdfBytes = fs.readFileSync(tempPdfPath);
  console.log(`✅ Successfully generated presentation PDF! (${pdfBytes.length} bytes)`);

  // Copy to artifacts and workspace
  fs.writeFileSync(artifactPdfPath, pdfBytes);
  fs.writeFileSync(artifactHtmlPath, htmlContent, 'utf-8');
  fs.writeFileSync(workspacePdfPath, pdfBytes);
  fs.writeFileSync(workspaceHtmlPath, htmlContent, 'utf-8');

  console.log('📁 Saved to Artifact PDF:', artifactPdfPath);
  console.log('📁 Saved to Artifact HTML:', artifactHtmlPath);
  console.log('📁 Saved to Workspace PDF:', workspacePdfPath);
  console.log('📁 Saved to Workspace HTML:', workspaceHtmlPath);
} catch (err) {
  console.error('Error generating PDF with Chrome:', err);
  process.exit(1);
}
