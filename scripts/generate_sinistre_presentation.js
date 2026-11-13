/**
 * Presentation Generator — GoCab Morocco Sinistre, Assurance & Garage Lifecycle
 *
 * Generates an executive & technical presentation deck in PDF format (16:9 widescreen)
 * for the engineering & product team, explaining field operations in Morocco and
 * the CRM technical implementation, with embedded real CRM screenshots.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths to media assets
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

console.log('Loaded media assets:', {
  logo: Boolean(logoBase64),
  dossier: Boolean(screenshotDossierBase64),
  timeline: Boolean(screenshotTimelineBase64),
  header: Boolean(screenshotHeaderBase64),
  whatsapp: Boolean(screenshotWhatsAppBase64),
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
      background-color: #0E1621;
      color: #E2E8F0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .slide {
      width: 16in;
      height: 9in;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      background: #0B141E;
      padding: 0.55in 0.75in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Gradient backgrounds for specific slide types */
    .slide-cover {
      background: radial-gradient(circle at 80% 20%, rgba(13, 148, 136, 0.22) 0%, rgba(11, 20, 30, 0.98) 70%),
                  radial-gradient(circle at 15% 85%, rgba(37, 99, 235, 0.18) 0%, rgba(11, 20, 30, 0.98) 60%),
                  #080E16;
    }

    .slide-tech {
      background: radial-gradient(circle at 90% 90%, rgba(59, 130, 246, 0.12) 0%, rgba(11, 20, 30, 1) 75%),
                  #0B141E;
    }

    .slide-ops {
      background: radial-gradient(circle at 10% 10%, rgba(245, 158, 11, 0.12) 0%, rgba(11, 20, 30, 1) 75%),
                  #0B141E;
    }

    /* Cards & Containers */
    .card {
      background: rgba(18, 29, 43, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 18px 22px;
      backdrop-filter: blur(12px);
    }

    .card-accent {
      background: rgba(22, 38, 56, 0.9);
      border: 1px solid rgba(13, 148, 136, 0.3);
      border-radius: 16px;
      padding: 18px 22px;
    }

    .card-warning {
      background: rgba(45, 30, 16, 0.85);
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-radius: 16px;
      padding: 18px 22px;
    }

    .card-code {
      background: #080D14;
      border: 1px solid #1E293B;
      border-radius: 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      color: #93C5FD;
      padding: 16px;
      line-height: 1.55;
    }

    /* Header & Footer */
    .slide-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 12px;
      margin-bottom: 14px;
    }

    .slide-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .slide-category-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .badge-teal {
      background: rgba(13, 148, 136, 0.2);
      color: #2DD4BF;
      border: 1px solid rgba(45, 212, 191, 0.35);
    }

    .badge-amber {
      background: rgba(245, 158, 11, 0.2);
      color: #FBBF24;
      border: 1px solid rgba(251, 191, 36, 0.35);
    }

    .badge-blue {
      background: rgba(59, 130, 246, 0.2);
      color: #93C5FD;
      border: 1px solid rgba(147, 197, 253, 0.35);
    }

    .badge-purple {
      background: rgba(168, 85, 247, 0.2);
      color: #D8B4FE;
      border: 1px solid rgba(216, 180, 254, 0.35);
    }

    .slide-title {
      font-size: 26px;
      font-weight: 800;
      color: #F8FAFC;
      letter-spacing: -0.02em;
    }

    .slide-subtitle {
      font-size: 13px;
      color: #94A3B8;
      margin-top: 2px;
    }

    .slide-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 10px;
      margin-top: 12px;
      font-size: 11px;
      color: #64748B;
      font-weight: 500;
    }

    /* Grid Layouts */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
    }

    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }

    .grid-60-40 {
      display: grid;
      grid-template-columns: 1.25fr 0.85fr;
      gap: 20px;
    }

    .grid-50-50 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    /* Typography Utilities */
    h3 {
      font-size: 16px;
      font-weight: 700;
      color: #F1F5F9;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    p, li {
      font-size: 13px;
      line-height: 1.55;
      color: #CBD5E1;
    }

    ul {
      list-style-position: inside;
      margin-left: 2px;
    }

    li {
      margin-bottom: 5px;
    }

    strong {
      color: #FFFFFF;
      font-weight: 700;
    }

    .mono {
      font-family: 'JetBrains Mono', monospace;
    }

    /* Stat Pill */
    .stat-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px 14px;
      text-align: center;
    }

    .stat-val {
      font-size: 24px;
      font-weight: 800;
      color: #38BDF8;
      font-family: 'JetBrains Mono', monospace;
    }

    .stat-val-amber {
      color: #F59E0B;
    }

    .stat-val-emerald {
      color: #10B981;
    }

    .stat-val-rose {
      color: #F43F5E;
    }

    .stat-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #94A3B8;
      letter-spacing: 0.05em;
      margin-top: 2px;
    }

    /* Screenshots Frame */
    .screenshot-frame {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55);
      background: #000;
      display: flex;
      flex-direction: column;
    }

    .screenshot-bar {
      background: #1E293B;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .dot-red { background: #EF4444; }
    .dot-yellow { background: #F59E0B; }
    .dot-green { background: #10B981; }

    .screenshot-img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: cover;
    }

    .step-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: rgba(30, 41, 59, 0.7);
      border-radius: 10px;
      border-left: 3px solid #38BDF8;
      font-size: 12px;
    }

    .step-num {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #0284C7;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 11px;
      flex-shrink: 0;
    }
  </style>
</head>
<body>

  <!-- ============================================================== -->
  <!-- SLIDE 1: COVER & EXECUTIVE SUMMARY -->
  <!-- ============================================================== -->
  <section class="slide slide-cover">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      ${logoBase64 ? `<img src="${logoBase64}" style="height: 48px; object-fit: contain;" alt="GoCab">` : `<div style="font-size: 28px; font-weight: 900; color: #38BDF8;">GoCab</div>`}
      <div style="text-align: right;">
        <span class="slide-category-badge badge-teal">Executive &amp; Technical Presentation</span>
        <div style="font-size: 12px; color: #64748B; margin-top: 4px;">Écosystème Flotte &amp; Opérations Maroc (Casablanca / Rabat)</div>
      </div>
    </div>

    <div style="margin-top: -30px;">
      <div style="display: inline-block; padding: 4px 14px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 9999px; font-size: 12px; font-weight: 700; color: #38BDF8; margin-bottom: 14px;">
        ENGINEERING &amp; FIELD OPS MASTER ARCHITECTURE
      </div>
      <h1 style="font-size: 46px; font-weight: 900; line-height: 1.15; letter-spacing: -0.03em; color: #FFFFFF; max-width: 13in;">
        Cycle de Vie Complet d'un Sinistre Flotte : <br>
        <span style="background: linear-gradient(90deg, #38BDF8, #2DD4BF); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          Du Choc Terrain au Garage, à l'Expertise &amp; au Rétablissement CRM
        </span>
      </h1>
      <p style="font-size: 16px; color: #94A3B8; margin-top: 14px; max-width: 11.5in; line-height: 1.6;">
        Guide de référence exhaustif pour l'équipe technique expliquant les réalités opérationnelles du marché marocain (chauffeurs, constats amiables, cabinets d'expertise, garages agréés comme Emergence, assureurs comme Sanlam) et leur traduction intégrale dans le CRM GoCab.
      </p>
    </div>

    <div class="grid-4" style="margin-top: 10px;">
      <div class="stat-box">
        <div class="stat-val">8 Étapes</div>
        <div class="stat-label">Cycle Garage Canonique</div>
      </div>
      <div class="stat-box">
        <div class="stat-val stat-val-emerald">&lt; 24h</div>
        <div class="stat-label">Déclaration &amp; Ordre Mission</div>
      </div>
      <div class="stat-box">
        <div class="stat-val stat-val-amber">100% Digital</div>
        <div class="stat-label">Constats, Devis &amp; PEC</div>
      </div>
      <div class="stat-box">
        <div class="stat-val stat-val-rose">13 Véhicules</div>
        <div class="stat-label">Encours Maintenance / Sinistres</div>
      </div>
    </div>

    <div class="slide-footer">
      <span>GoCab ERP — Document d'Architecture Fonctionnelle &amp; Technique</span>
      <span>Novembre 2026 • Confidential Tech Team Documentation</span>
      <span>Slide 1 / 10</span>
    </div>
  </section>

  <!-- ============================================================== -->
  <!-- SLIDE 2: MOROCCAN OPERATIONAL REALITIES & STAKEHOLDERS -->
  <!-- ============================================================== -->
  <section class="slide slide-ops">
    <div class="slide-header">
      <div class="slide-header-left">
        <span class="slide-category-badge badge-amber">Contexte Opérationnel Maroc</span>
        <div>
          <div class="slide-title">Les Réalités du Terrain Marocain &amp; les 6 Intervenants Clés</div>
          <div class="slide-subtitle">Comment un accident se gère concrètement entre Casablanca, Rabat et les acteurs institutionnels</div>
        </div>
      </div>
      <div class="mono" style="font-size: 11px; color: #64748B;">OPS-REALITY-MA</div>
    </div>

    <div class="grid-3" style="flex: 1; align-items: stretch;">
      <!-- Col 1: Chauffeur & Terrain -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="color: #38BDF8;"><span>🚗</span> 1. Chauffeur &amp; Constat Amiable</h3>
          <p style="margin-bottom: 10px;">
            Le chauffeur GoCab en circulation (ex: Dacia Logan 2025) a l'obligation légale et contractuelle d'établir un <strong>Constat Amiable</strong> avec le tiers et de préserver les éléments de preuve immédiats.
          </p>
          <div class="step-pill" style="margin-bottom: 8px;">
            <div class="step-num">A</div>
            <div><strong>Urgence &amp; Sécurité :</strong> Appel d'assistance ou superviseur terrain GoCab immédiat.</div>
          </div>
          <div class="step-pill">
            <div class="step-num">B</div>
            <div><strong>Constat &amp; Photos :</strong> Remplissage recto/verso, signature, photos 4 côtés + plaques.</div>
          </div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); padding: 10px; border-radius: 10px; font-size: 11.5px; color: #94A3B8;">
          📌 <em>Délai légal marocain :</em> Déclaration sous <strong>5 jours ouvrés</strong> auprès de la compagnie.
        </div>
      </div>

      <!-- Col 2: Superviseurs & Flotte -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="color: #F59E0B;"><span>🏢</span> 2. Superviseur Terrain &amp; Fleet Manager</h3>
          <p style="margin-bottom: 10px;">
            L'équipe GoCab Maroc (Superviseurs Terrain <strong>Hamza &amp; Ayoub Rassid</strong>, Gestionnaires de Flotte <strong>Mehdi Elyattouti &amp; Mohamed Aziz</strong>) intervient pour sécuriser l'actif.
          </p>
          <div class="step-pill" style="margin-bottom: 8px;">
            <div class="step-num">1</div>
            <div><strong>Dépannage &amp; Remorquage :</strong> Acheminement du véhicule vers le garage partenaire.</div>
          </div>
          <div class="step-pill">
            <div class="step-num">2</div>
            <div><strong>Alerte WhatsApp Auto :</strong> Déclenchement automatique vers le gestionnaire assigné (Mehdi).</div>
          </div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); padding: 10px; border-radius: 10px; font-size: 11.5px; color: #94A3B8;">
          ⚡ <em>Enjeu Business :</em> Chaque jour d'immobilisation représente une perte sèche de redevance journalière.
        </div>
      </div>

      <!-- Col 3: Assurance, Expert & Garage -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="color: #10B981;"><span>🛡️</span> 3. Compagnie, Expert &amp; Garage</h3>
          <p style="margin-bottom: 10px;">
            L'écosystème externe marocain repose sur la triangulation tripartite : <strong>Assureur (Sanlam/AtlantaSanad)</strong>, <strong>Expert Judiciaire</strong>, et <strong>Garage Conventionné (Emergence)</strong>.
          </p>
          <div class="step-pill" style="margin-bottom: 8px;">
            <div class="step-num">I</div>
            <div><strong>Ordre de Mission :</strong> L'assureur mandate formellement le garage et l'expert.</div>
          </div>
          <div class="step-pill">
            <div class="step-num">II</div>
            <div><strong>Expertise Contradictoire :</strong> Accord de devis chiffré et prise en charge finale (PEC).</div>
          </div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); padding: 10px; border-radius: 10px; font-size: 11.5px; color: #94A3B8;">
          🔒 <em>Portail Assureur :</em> Rôle dédié <code class="mono">ASSURANCE</code> créé dans le CRM pour le courtier/agent externe.
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>Partie 1 : Fondamentaux du Marché Marocain</span>
      <span>Intervenants : Chauffeur • Superviseur • Fleet Manager • Assureur • Expert • Garage</span>
      <span>Slide 2 / 10</span>
    </div>
  </section>

  <!-- ============================================================== -->
  <!-- SLIDE 3: PHASE 1 — CREATION & DOCUMENT INGESTION -->
  <!-- ============================================================== -->
  <section class="slide">
    <div class="slide-header">
      <div class="slide-header-left">
        <span class="slide-category-badge badge-blue">Phase 1 : Saisie &amp; Ingestion</span>
        <div>
          <div class="slide-title">Déclaration du Sinistre &amp; Ingestion Numérique des Pièces</div>
          <div class="slide-subtitle">Captation terrain des pièces juridiques obligatoires et stockage numérique sécurisé</div>
        </div>
      </div>
      <div class="mono" style="font-size: 11px; color: #64748B;">API: POST /api/accidents</div>
    </div>

    <div class="grid-60-40" style="flex: 1; align-items: stretch;">
      <!-- Left: Workflow & Explanations -->
      <div style="display: flex; flex-direction: column; justify-content: space-between;">
        <div class="card" style="flex: 1; margin-bottom: 12px;">
          <h3><span>📋</span> Procédure de Déclaration dans le CRM</h3>
          <p style="margin-bottom: 12px;">
            Lorsqu'un accident est signalé, le collaborateur clique sur <strong>&quot;Déclarer un Accident&quot;</strong>. Le CRM vérifie automatiquement l'immatriculation, résout le chauffeur actif et pré-remplit les informations.
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <div style="background: rgba(30, 41, 59, 0.7); padding: 10px; border-radius: 10px;">
              <div style="font-size: 11px; color: #94A3B8; text-transform: uppercase; font-weight: 700;">Gravité Sinistre</div>
              <div style="font-size: 13px; font-weight: 700; color: #EF4444; margin-top: 2px;">🔴 LOURDE (Immobilisation)</div>
              <div style="font-size: 13px; font-weight: 700; color: #F59E0B; margin-top: 2px;">🟡 LÉGÈRE (Roulant / Cosmétique)</div>
            </div>
            <div style="background: rgba(30, 41, 59, 0.7); padding: 10px; border-radius: 10px;">
              <div style="font-size: 11px; color: #94A3B8; text-transform: uppercase; font-weight: 700;">Responsabilité Fautive</div>
              <div style="font-size: 13px; font-weight: 700; color: #38BDF8; margin-top: 2px;">👤 DRIVER (Chauffeur GoCab)</div>
              <div style="font-size: 13px; font-weight: 700; color: #10B981; margin-top: 2px;">🚗 THIRD_PARTY (Tiers)</div>
            </div>
          </div>

          <h3 style="margin-top: 10px;"><span>📁</span> Typologie des Documents Ingestés (Base64 / Blob)</h3>
          <ul style="font-size: 12.5px;">
            <li><strong>CONSTAT (Constat Amiable) :</strong> Scan du document papier signé par les 2 conducteurs.</li>
            <li><strong>PHOTOS (Impact &amp; Dégâts) :</strong> Photos haute résolution de la carrosserie, du compteur et du châssis.</li>
            <li><strong>PERMIS &amp; CARTE GRISE :</strong> Vérification de validité juridique pour la prise en charge Sanlam.</li>
            <li><strong>DEVIS INITIAL :</strong> Chiffrage préliminaire des pièces et de la main d'œuvre tôlerie.</li>
          </ul>
        </div>

        <div class="card-code">
          <span style="color: #64748B;">// Payload modèle de création d'un sinistre</span><br>
          <span style="color: #F472B6;">POST</span> /api/accidents<br>
          {<br>
          &nbsp;&nbsp;<span style="color: #38BDF8;">"vehicle_id"</span>: <span style="color: #A7F3D0;">"WW028110"</span>, <span style="color: #38BDF8;">"driver_name"</span>: <span style="color: #A7F3D0;">"CHETOUI MOHAMED HASSAN"</span>,<br>
          &nbsp;&nbsp;<span style="color: #38BDF8;">"severity"</span>: <span style="color: #FCD34D;">"HARD"</span>, <span style="color: #38BDF8;">"fault"</span>: <span style="color: #FCD34D;">"DRIVER"</span>, <span style="color: #38BDF8;">"garage_name"</span>: <span style="color: #A7F3D0;">"Emergence"</span><br>
          }
        </div>
      </div>

      <!-- Right: Actual Screenshot -->
      <div style="display: flex; flex-direction: column;">
        <div class="screenshot-frame" style="flex: 1;">
          <div class="screenshot-bar">
            <span class="dot dot-red"></span>
            <span class="dot dot-yellow"></span>
            <span class="dot dot-green"></span>
            <span style="font-size: 11px; color: #94A3B8; margin-left: 8px; font-family: monospace;">CRM GoCab — Vue Sinistres en Cours (Recherche &amp; Compteurs)</span>
          </div>
          ${screenshotHeaderBase64 ? `<img src="${screenshotHeaderBase64}" class="screenshot-img" style="height: 100%; object-fit: contain; background: #0B141E;" alt="CRM Header">` : `<div style="padding: 40px; text-align: center; color: #64748B;">[Capture CRM Sinistres]</div>`}
        </div>
        <div style="font-size: 11.5px; color: #94A3B8; text-align: center; margin-top: 6px;">
          Capture réelle : Suivi des véhicules accidentés, statut En cours (13) et arrêt moyen.
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>Phase 1 : Ingestion des Données</span>
      <span>Contrôles : Immatriculation unique, Permis actif, Catégorisation documents</span>
      <span>Slide 3 / 10</span>
    </div>
  </section>

  <!-- ============================================================== -->
  <!-- SLIDE 4: PHASE 2 — FLEET MANAGER WHATSAPP AUTOMATION -->
  <!-- ============================================================== -->
  <section class="slide">
    <div class="slide-header">
      <div class="slide-header-left">
        <span class="slide-category-badge badge-teal">Phase 2 : Handshake Flotte</span>
        <div>
          <div class="slide-title">Automatisation WhatsApp &amp; Synchronisation GoCab Fleet</div>
          <div class="slide-subtitle">Alerte temps réel des gestionnaires de flotte et lien de confirmation direct à 1 clic</div>
        </div>
      </div>
      <div class="mono" style="font-size: 11px; color: #64748B;">360DIALOG CLOUD API</div>
    </div>

    <div class="grid-60-40" style="flex: 1; align-items: stretch;">
      <!-- Left: Visual Dossier with Banner -->
      <div style="display: flex; flex-direction: column;">
        <div class="screenshot-frame" style="flex: 1;">
          <div class="screenshot-bar">
            <span class="dot dot-red"></span>
            <span class="dot dot-yellow"></span>
            <span class="dot dot-green"></span>
            <span style="font-size: 11px; color: #94A3B8; margin-left: 8px; font-family: monospace;">Dossier WW028110 — Alerte Gestionnaire &amp; Confirmation</span>
          </div>
          ${screenshotDossierBase64 ? `<img src="${screenshotDossierBase64}" class="screenshot-img" style="height: 100%; object-fit: cover; object-position: top;" alt="Dossier WW028110">` : `<div style="padding: 40px; text-align: center; color: #64748B;">[Capture Dossier WW028110]</div>`}
        </div>
        <div style="font-size: 11.5px; color: #94A3B8; text-align: center; margin-top: 6px;">
          Capture réelle : Bandeau d'attente GoCab Fleet avec notification WhatsApp à Mehdi Elyattouti.
        </div>
      </div>

      <!-- Right: Technical Details -->
      <div style="display: flex; flex-direction: column; justify-content: space-between;">
        <div class="card-accent" style="margin-bottom: 12px;">
          <h3 style="color: #2DD4BF;"><span>⚡</span> Déclenchement de l'Alerte WhatsApp</h3>
          <p style="margin-bottom: 10px;">
            Dès l'enregistrement du sinistre, le CRM identifie le gestionnaire de flotte compétent :
          </p>
          <div style="background: rgba(15, 23, 42, 0.6); padding: 10px; border-radius: 10px; font-size: 12px; margin-bottom: 8px;">
            👤 <strong>Mehdi Elyattouti :</strong> Gestionnaire Flotte Principal<br>
            👤 <strong>Mohamed Aziz :</strong> Gestionnaire Flotte Associé
          </div>
          <p style="font-size: 12px; color: #94A3B8;">
            Un message WhatsApp haute priorité est expédié via l'API 360dialog avec immatriculation, nom du chauffeur, sévérité et <strong>lien de confirmation 1-clic sécurisé par token HMAC</strong>.
          </p>
        </div>

        <div class="card">
          <h3><span>🔗</span> Cycle de Confirmation &amp; Résilience</h3>
          <ul style="font-size: 12px;">
            <li><strong>Bouton &quot;Créé sur GoCab Fleet&quot; :</strong> Permet au gestionnaire de valider manuellement ou via le lien reçu sur mobile.</li>
            <li><strong>Bouton &quot;Relancer WhatsApp&quot; :</strong> En cas de délai, permet à l'équipe opérationnelle de renvoyer une notification sans quitter l'écran.</li>
            <li><strong>Statut Horodaté :</strong> Enregistre l'auteur et l'heure précise de prise en compte dans l'audit log.</li>
          </ul>
        </div>

        <div class="card-code">
          <span style="color: #64748B;">// Endpoint de confirmation externe Fleet</span><br>
          <span style="color: #F472B6;">POST</span> /api/accidents/confirm-fleet<br>
          { <span style="color: #38BDF8;">"claimId"</span>: <span style="color: #A7F3D0;">"uuid..."</span>, <span style="color: #38BDF8;">"source"</span>: <span style="color: #FCD34D;">"WHATSAPP_BUTTON"</span> }
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>Phase 2 : Collaboration Terrain-Flotte</span>
      <span>Intégration : Meta WhatsApp Cloud API • Token sécurisé • Audit Trail</span>
      <span>Slide 4 / 10</span>
    </div>
  </section>

  <!-- ============================================================== -->
  <!-- SLIDE 5: PHASE 3 — THE 8-STEP GARAGE & REPAIR LIFECYCLE -->
  <!-- ============================================================== -->
  <section class="slide">
    <div class="slide-header">
      <div class="slide-header-left">
        <span class="slide-category-badge badge-purple">Phase 3 : Cycle Garage</span>
        <div>
          <div class="slide-title">La Frise Canonique des 8 Étapes Garage &amp; Intervenants</div>
          <div class="slide-subtitle">Suivi pas-à-pas de la réparation, validation d'étape et traçabilité des responsabilités</div>
        </div>
      </div>
      <div class="mono" style="font-size: 11px; color: #64748B;">TIMELINE_STEPS (1 à 8)</div>
    </div>

    <!-- Timeline Component Screenshot -->
    <div style="margin-bottom: 14px;">
      <div class="screenshot-frame">
        <div class="screenshot-bar">
          <span class="dot dot-red"></span>
          <span class="dot dot-yellow"></span>
          <span class="dot dot-green"></span>
          <span style="font-size: 11px; color: #94A3B8; margin-left: 8px; font-family: monospace;">Composant Interactif : Avancement du Véhicule au Garage (Garage Emergence)</span>
        </div>
        ${screenshotTimelineBase64 ? `<img src="${screenshotTimelineBase64}" class="screenshot-img" style="max-height: 140px; object-fit: contain; background: #0B141E;" alt="Timeline Steps">` : `<div style="padding: 20px; text-align: center; color: #64748B;">[Capture Timeline]</div>`}
      </div>
    </div>

    <!-- 8 Steps Detailed Grid -->
    <div class="grid-4" style="flex: 1;">
      <!-- Step 1 -->
      <div class="card" style="padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span class="slide-category-badge badge-blue" style="font-size: 10px; padding: 2px 8px;">#1 GoCab</span>
          <span style="font-size: 16px;">📋</span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #F1F5F9;">Déclaré &amp; Constat</div>
        <p style="font-size: 11px; color: #94A3B8; margin-top: 4px;">Création du sinistre, photos d'accident et constat amiable déposés.</p>
      </div>

      <!-- Step 2 -->
      <div class="card" style="padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span class="slide-category-badge badge-teal" style="font-size: 10px; padding: 2px 8px;">#2 Assurance</span>
          <span style="font-size: 16px;">🛡️</span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #F1F5F9;">Ordre de Mission</div>
        <p style="font-size: 11px; color: #94A3B8; margin-top: 4px;">La compagnie (Sanlam) mandate formellement le garage de réparation.</p>
      </div>

      <!-- Step 3 -->
      <div class="card" style="padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span class="slide-category-badge badge-amber" style="font-size: 10px; padding: 2px 8px;">#3 Garage</span>
          <span style="font-size: 16px;">📸</span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #F1F5F9;">Photos &amp; Devis</div>
        <p style="font-size: 11px; color: #94A3B8; margin-top: 4px;">Entrée au garage, photos contradictoires et dépôt du devis chiffré.</p>
      </div>

      <!-- Step 4 -->
      <div class="card" style="padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span class="slide-category-badge badge-purple" style="font-size: 10px; padding: 2px 8px;">#4 Expert</span>
          <span style="font-size: 16px;">🔍</span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #F1F5F9;">Accord Expert</div>
        <p style="font-size: 11px; color: #94A3B8; margin-top: 4px;">Visite du cabinet d'expertise et accord chiffré sur le devis validé.</p>
      </div>

      <!-- Step 5 -->
      <div class="card" style="padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span class="slide-category-badge badge-amber" style="font-size: 10px; padding: 2px 8px;">#5 Garage</span>
          <span style="font-size: 16px;">🔧</span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #F1F5F9;">Début Travaux</div>
        <p style="font-size: 11px; color: #94A3B8; margin-top: 4px;">Démarrage tôlerie, pièces de rechange et remise en état carrosserie.</p>
      </div>

      <!-- Step 6 -->
      <div class="card" style="padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span class="slide-category-badge badge-teal" style="font-size: 10px; padding: 2px 8px;">#6 Assur/Gar</span>
          <span style="font-size: 16px;">📑</span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #F1F5F9;">Attente PEC Finale</div>
        <p style="font-size: 11px; color: #94A3B8; margin-top: 4px;">Le garage attend la confirmation finale de Prise En Charge (PEC).</p>
      </div>

      <!-- Step 7 -->
      <div class="card" style="padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span class="slide-category-badge badge-teal" style="font-size: 10px; padding: 2px 8px;">#7 Garage</span>
          <span style="font-size: 16px;">🚗</span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #F1F5F9;">Véhicule Prêt</div>
        <p style="font-size: 11px; color: #94A3B8; margin-top: 4px;">Réparation terminée, nettoyage et contrôle qualité validé au garage.</p>
      </div>

      <!-- Step 8 -->
      <div class="card" style="padding: 12px 14px; border: 1px solid rgba(16, 185, 129, 0.4); background: rgba(6, 78, 59, 0.25);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span class="slide-category-badge" style="background: #059669; color: #fff; font-size: 10px; padding: 2px 8px;">#8 GoCab</span>
          <span style="font-size: 16px;">✅</span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #A7F3D0;">Véhicule Récupéré</div>
        <p style="font-size: 11px; color: #CBD5E1; margin-top: 4px;">Restitution terrain, sortie de maintenance et remise en service actif.</p>
      </div>
    </div>

    <div class="slide-footer">
      <span>Phase 3 : Exécution Garage</span>
      <span>Mécanisme : Validation progressive avec note optionnelle et enregistrement de l'auteur</span>
      <span>Slide 5 / 10</span>
    </div>
  </section>

  <!-- ============================================================== -->
  <!-- SLIDE 6: PHASE 4 — ESPACE ASSURANCE & EXPERT (RBAC) -->
  <!-- ============================================================== -->
  <section class="slide">
    <div class="slide-header">
      <div class="slide-header-left">
        <span class="slide-category-badge badge-teal">Phase 4 : Espace Partagé Assureur</span>
        <div>
          <div class="slide-title">Portail Sécurisé Compagnie d'Assurance &amp; Rôle Dédié</div>
          <div class="slide-subtitle">Rôle ASSURANCE restreint, chiffrage d'expertise et chronomètre d'immobilisation</div>
        </div>
      </div>
      <div class="mono" style="font-size: 11px; color: #64748B;">ROLE: ASSURANCE (RBAC)</div>
    </div>

    <div class="grid-50-50" style="flex: 1; align-items: stretch;">
      <!-- Left: Functional Architecture & RBAC -->
      <div style="display: flex; flex-direction: column; justify-content: space-between;">
        <div class="card" style="margin-bottom: 12px;">
          <h3 style="color: #2DD4BF;"><span>🛡️</span> Rôle Dédié &quot;ASSURANCE&quot; (Sécurité &amp; Confidentialité)</h3>
          <p style="margin-bottom: 10px;">
            Pour permettre à l'agent d'assurance externe (Sanlam / Courtier) de collaborer sans compromettre les données confidentielles de la flotte GoCab :
          </p>
          <ul style="font-size: 12.5px;">
            <li><strong>Accès Isolé :</strong> Accès <em>uniquement</em> à la page <strong>Assurance &amp; Gestion des Sinistres</strong>.</li>
            <li><strong>Masquage Strict :</strong> Pas d'accès aux Rappels Réparations, ni aux dettes chauffeurs, ni aux colonnes de trésorerie interne.</li>
            <li><strong>Chronomètre Arrêt Sinistre :</strong> Le compteur de jours démarre <strong>dès la première apparition sur la page Assurance</strong> (pas la date globale d'achat véhicule).</li>
          </ul>
        </div>

        <div class="card-accent">
          <h3><span>💰</span> Chiffrage Financier &amp; Règlements (MAD)</h3>
          <div class="grid-3" style="margin-top: 8px;">
            <div style="background: rgba(15, 23, 42, 0.6); padding: 8px; border-radius: 8px;">
              <div style="font-size: 10px; color: #94A3B8; font-weight: 700;">MONTANT ESTIMÉ</div>
              <div style="font-size: 15px; font-weight: 800; color: #38BDF8; font-family: monospace;">Devis Garage</div>
            </div>
            <div style="background: rgba(15, 23, 42, 0.6); padding: 8px; border-radius: 8px;">
              <div style="font-size: 10px; color: #94A3B8; font-weight: 700;">ACCORD PEC</div>
              <div style="font-size: 15px; font-weight: 800; color: #10B981; font-family: monospace;">Pris en charge</div>
            </div>
            <div style="background: rgba(15, 23, 42, 0.6); padding: 8px; border-radius: 8px;">
              <div style="font-size: 10px; color: #94A3B8; font-weight: 700;">FRANCHISE</div>
              <div style="font-size: 15px; font-weight: 800; color: #F59E0B; font-family: monospace;">Charge Flotte</div>
            </div>
          </div>
          <p style="font-size: 11.5px; color: #CBD5E1; margin-top: 8px;">
            Suivi des statuts de règlement assureur : <span class="mono" style="color: #93C5FD;">En attente • Accord partiel • Quittance signée • Remboursé</span>.
          </p>
        </div>
      </div>

      <!-- Right: Form Structure -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3><span>📝</span> Formulaire d'Identification du Dossier Assureur</h3>
          <p style="margin-bottom: 12px; font-size: 12px; color: #94A3B8;">
            Synchronisation bidirectionnelle des références contractuelles :
          </p>
          <div style="background: #080D14; border: 1px solid #1E293B; border-radius: 10px; padding: 12px; font-family: monospace; font-size: 11.5px; line-height: 1.6; color: #93C5FD;">
            • N° Sinistre Assureur : <span style="color: #FCD34D;">SIN-2026-CAS-0849</span><br>
            • Compagnie d'Assurance : <span style="color: #FCD34D;">Sanlam Maroc</span><br>
            • Garage Conventionné : <span style="color: #FCD34D;">Emergence (Casablanca)</span><br>
            • N° Police / Contrat : <span style="color: #FCD34D;">POL-984210-2026</span><br>
            • Statut Avancement : <span style="color: #34D399;">1. Déclaration enregistrée</span><br>
            • Date Déclaration : <span style="color: #FCD34D;">11/09/2026</span><br>
            • Cabinet d'Expertise : <span style="color: #FCD34D;">Cabinet Expert Auto Casa</span><br>
            • Téléphone Expert : <span style="color: #FCD34D;">+212 522 XX XX XX</span>
          </div>
        </div>

        <div style="background: rgba(13, 148, 136, 0.15); border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 10px; padding: 10px; font-size: 12px; color: #2DD4BF;">
          💡 <strong>Protection des données sensibles :</strong> Les inspecteurs ou experts externes ne voient que les documents de catégorie CONSTAT, DEVIS et EXPERTISE.
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>Phase 4 : Espace Assurance &amp; Sécurité</span>
      <span>Contrôle d'accès : Permissions Role-Based • Session NextAuth • Chiffrement</span>
      <span>Slide 6 / 10</span>
    </div>
  </section>

  <!-- ============================================================== -->
  <!-- SLIDE 7: PHASE 5 — FIELD RESTITUTION & FLEET RETURN -->
  <!-- ============================================================== -->
  <section class="slide slide-ops">
    <div class="slide-header">
      <div class="slide-header-left">
        <span class="slide-category-badge badge-emerald">Phase 5 : Clôture &amp; Restitution</span>
        <div>
          <div class="slide-title">Récupération Terrain, Contrôle Qualité &amp; Remise en Service</div>
          <div class="slide-subtitle">Validation technique post-réparation, bascule automatique du statut et reprise de la rentabilité</div>
        </div>
      </div>
      <div class="mono" style="font-size: 11px; color: #64748B;">LIFECYCLE CLOSE</div>
    </div>

    <div class="grid-3" style="flex: 1; align-items: stretch;">
      <!-- Col 1: Contrôle Terrain -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="color: #38BDF8;"><span>🔍</span> 1. Audit Terrain &amp; Essai Routier</h3>
          <p style="margin-bottom: 10px;">
            Le Superviseur Terrain (Hamza / Ayoub) se rend physiquement au garage (ex: Emergence) pour valider l'état du véhicule :
          </p>
          <ul style="font-size: 12px;">
            <li>Contrôle visuel tôlerie &amp; concordance teinte peinture.</li>
            <li>Alignement géométrie du train avant et suspension.</li>
            <li>Contrôle des organes de sécurité (freinage, feux, airbags).</li>
            <li>Essai dynamique sur voie rapide avant signature du bon de sortie.</li>
          </ul>
        </div>
        <div class="step-pill">
          <div class="step-num">✓</div>
          <div><strong>Zéro défaut toléré :</strong> Véhicule VTC garanti conforme aux standards inDrive.</div>
        </div>
      </div>

      <!-- Col 2: Clôture Administrative -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="color: #F59E0B;"><span>🧾</span> 2. Facturation &amp; Quittance</h3>
          <p style="margin-bottom: 10px;">
            Clôture des engagements financiers et décharge des responsabilités :
          </p>
          <ul style="font-size: 12px;">
            <li>Réception de la facture acquittée du garage Emergence.</li>
            <li>Téléversement dans le CRM en catégorie <code class="mono">FACTURE</code>.</li>
            <li>Règlement de la franchise si responsabilité engagée (<code class="mono">DRIVER</code>).</li>
            <li>Clôture de la quittance d'indemnité Sanlam.</li>
          </ul>
        </div>
        <div class="step-pill">
          <div class="step-num">MAD</div>
          <div><strong>Bilan Financier Dossier :</strong> Rapprochement bancaire et imputation comptable.</div>
        </div>
      </div>

      <!-- Col 3: Bascule Flotte CRM -->
      <div class="card-accent" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="color: #10B981;"><span>🚗</span> 3. Réactivation Flotte &amp; Chauffeur</h3>
          <p style="margin-bottom: 10px;">
            Lors du passage à l'étape <strong>#8 (Véhicule Récupéré &amp; Rétabli)</strong> :
          </p>
          <ul style="font-size: 12px;">
            <li>Le statut du véhicule bascule de <span style="color: #F59E0B; font-weight: 700;">Maintenance</span> ➔ <span style="color: #10B981; font-weight: 700;">In Service</span> / <span style="color: #38BDF8; font-weight: 700;">Available</span>.</li>
            <li>Sortie des compteurs d'immobilisation de la flotte.</li>
            <li>Réassignation immédiate au chauffeur titulaire ou réattribution.</li>
            <li>Reprise de la facturation journalière sans temps mort.</li>
          </ul>
        </div>
        <div style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); padding: 10px; border-radius: 10px; font-size: 12px; color: #A7F3D0; font-weight: 600;">
          🎉 <strong>Objectif Atteint :</strong> Restitution rapide minimisant le nombre total de jours d'arrêt.
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>Phase 5 : Rétablissement Opérationnel</span>
      <span>Transition : Maintenance ➔ Disponible • Rapprochement Trésorerie • Clôture Sinistre</span>
      <span>Slide 7 / 10</span>
    </div>
  </section>

  <!-- ============================================================== -->
  <!-- SLIDE 8: TECH ARCHITECTURE — DATABASE MODELS -->
  <!-- ============================================================== -->
  <section class="slide slide-tech">
    <div class="slide-header">
      <div class="slide-header-left">
        <span class="slide-category-badge badge-blue">Architecture Technique</span>
        <div>
          <div class="slide-title">Modélisation des Données &amp; Schéma Prisma ORM</div>
          <div class="slide-subtitle">Structure relationnelle, métadonnées JSON extensibles et typage strict TypeScript</div>
        </div>
      </div>
      <div class="mono" style="font-size: 11px; color: #64748B;">PRISMA / LIBSQL SCHEMA</div>
    </div>

    <div class="grid-50-50" style="flex: 1; align-items: stretch;">
      <!-- Left: Prisma Schema Model -->
      <div class="card-code" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span style="color: #64748B;">/// Schéma de données principal d'un sinistre</span><br>
          <span style="color: #F472B6;">model</span> <span style="color: #FCD34D;">AccidentClaim</span> {<br>
          &nbsp;&nbsp;id&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">String</span>&nbsp;&nbsp;&nbsp;&nbsp;@id @default(uuid())<br>
          &nbsp;&nbsp;vehicle_id&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">String</span><br>
          &nbsp;&nbsp;driver_id&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">String?</span><br>
          &nbsp;&nbsp;driver_name&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">String?</span><br>
          &nbsp;&nbsp;driver_phone&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">String?</span><br>
          &nbsp;&nbsp;severity&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">String?</span>&nbsp;&nbsp;&nbsp;<span style="color: #64748B;">// HARD (Lourde) | SOFT (Légère)</span><br>
          &nbsp;&nbsp;fault&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">String?</span>&nbsp;&nbsp;&nbsp;<span style="color: #64748B;">// DRIVER | THIRD_PARTY</span><br>
          &nbsp;&nbsp;timeline_step&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">String</span>&nbsp;&nbsp;&nbsp;&nbsp;@default("NEW_ACCIDENT")<br>
          &nbsp;&nbsp;step_updated_at&nbsp;<span style="color: #38BDF8;">DateTime</span>&nbsp;&nbsp;@default(now())<br>
          &nbsp;&nbsp;comments&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">String?</span>&nbsp;&nbsp;&nbsp;<span style="color: #64748B;">// JSON: InsuranceDossierInfo &amp; Notes</span><br>
          &nbsp;&nbsp;documents&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">String?</span>&nbsp;&nbsp;&nbsp;<span style="color: #64748B;">// JSON: Array&lt;AccidentDocument&gt;</span><br>
          &nbsp;&nbsp;created_at&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">DateTime</span>&nbsp;&nbsp;@default(now())<br>
          &nbsp;&nbsp;updated_at&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #38BDF8;">DateTime</span>&nbsp;&nbsp;@updatedAt<br>
          <br>
          &nbsp;&nbsp;vehicle&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #FCD34D;">Vehicle</span>&nbsp;&nbsp;&nbsp;@relation(fields: [vehicle_id], references: [id])<br>
          &nbsp;&nbsp;driver&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #FCD34D;">DriverProfile?</span> @relation(...)<br>
          }
        </div>
        <div style="color: #64748B; font-size: 10.5px; border-top: 1px solid #1E293B; padding-top: 8px;">
          Persistance durable sur LibSQL/Turso avec réplication SQLite locale instantanée.
        </div>
      </div>

      <!-- Right: Sub-structures & TypeScript Interfaces -->
      <div style="display: flex; flex-direction: column; justify-content: space-between;">
        <div class="card" style="margin-bottom: 12px;">
          <h3 style="color: #38BDF8;"><span>🧱</span> Structures JSON Extensibles</h3>
          <p style="font-size: 12px; margin-bottom: 8px;">
            Pour préserver une flexibilité maximale face aux exigences évolutives des compagnies d'assurance sans migration SQL lourde :
          </p>
          <div style="background: rgba(15, 23, 42, 0.6); padding: 10px; border-radius: 10px; font-size: 12px;">
            <strong>InsuranceDossierInfo :</strong> N° sinistre, police, nom expert, montant devis, franchise, statut paiement, et état notification WhatsApp du gestionnaire.<br><br>
            <strong>AccidentDocument :</strong> Métadonnées complètes du fichier (nom, taille, mimeType, catégorie CONSTAT/DEVIS/PHOTOS, date et auteur de téléversement).<br><br>
            <strong>StepValidationItem :</strong> Historique complet des horodatages et signatures de chaque étape validée.
          </div>
        </div>

        <div class="card">
          <h3 style="color: #10B981;"><span>🔒</span> Intégrité &amp; Cohérence des Données</h3>
          <ul style="font-size: 12px;">
            <li>Validation stricte des payloads via schémas <strong>Zod</strong>.</li>
            <li>Normalisation automatique des étapes rétrocompatibles (<code class="mono">CAR_IN_GARAGE</code> ➔ <code class="mono">GARAGE_DEVIS</code>).</li>
            <li>Indexation sur <code class="mono">vehicle_id</code>, <code class="mono">timeline_step</code> et <code class="mono">created_at</code> pour des requêtes en &lt; 15ms.</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>Architecture Technique : Persistance</span>
      <span>Base : Turso Cloud (LibSQL) / Local SQLite dev.db • Prisma 7.9.1 • Zod Validation</span>
      <span>Slide 8 / 10</span>
    </div>
  </section>

  <!-- ============================================================== -->
  <!-- SLIDE 9: TECH ARCHITECTURE — API ROUTES & LIVESYNC -->
  <!-- ============================================================== -->
  <section class="slide slide-tech">
    <div class="slide-header">
      <div class="slide-header-left">
        <span class="slide-category-badge badge-blue">Architecture Technique</span>
        <div>
          <div class="slide-title">API Routes, LiveSync &amp; Synchronisation Temps Réel</div>
          <div class="slide-subtitle">Endpoints serverless Next.js 16, mise en cache SWR et diffusion temps réel multi-utilisateurs</div>
        </div>
      </div>
      <div class="mono" style="font-size: 11px; color: #64748B;">API ROUTING &amp; REALTIME</div>
    </div>

    <div class="grid-50-50" style="flex: 1; align-items: stretch;">
      <!-- Left: API Routes Specs -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="color: #38BDF8;"><span>⚡</span> Cartographie des Endpoints API</h3>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
            <div style="background: rgba(15, 23, 42, 0.6); padding: 8px 12px; border-radius: 8px; font-size: 11.5px;">
              <span class="mono" style="color: #34D399; font-weight: 700;">GET</span> <span class="mono">/api/accidents</span><br>
              <span style="color: #94A3B8;">Récupération de tous les sinistres avec cache SWR et enrichissement véhicule.</span>
            </div>
            <div style="background: rgba(15, 23, 42, 0.6); padding: 8px 12px; border-radius: 8px; font-size: 11.5px;">
              <span class="mono" style="color: #60A5FA; font-weight: 700;">POST</span> <span class="mono">/api/accidents</span><br>
              <span style="color: #94A3B8;">Création d'un sinistre, téléversement de documents et alerte WhatsApp auto.</span>
            </div>
            <div style="background: rgba(15, 23, 42, 0.6); padding: 8px 12px; border-radius: 8px; font-size: 11.5px;">
              <span class="mono" style="color: #FBBF24; font-weight: 700;">PATCH</span> <span class="mono">/api/accidents/[id]</span><br>
              <span style="color: #94A3B8;">Avancement d'étape garage (#1 à #8), mise à jour dossier assurance, ajout de notes.</span>
            </div>
            <div style="background: rgba(15, 23, 42, 0.6); padding: 8px 12px; border-radius: 8px; font-size: 11.5px;">
              <span class="mono" style="color: #A78BFA; font-weight: 700;">POST</span> <span class="mono">/api/accidents/confirm-fleet</span><br>
              <span style="color: #94A3B8;">Prise en charge directe par le gestionnaire de flotte depuis son mobile.</span>
            </div>
            <div style="background: rgba(15, 23, 42, 0.6); padding: 8px 12px; border-radius: 8px; font-size: 11.5px;">
              <span class="mono" style="color: #F43F5E; font-weight: 700;">GET</span> <span class="mono">/api/insurance/repair-reminders</span><br>
              <span style="color: #94A3B8;">Calcul automatique des délais d'immobilisation et rappels de relance garage/expert.</span>
            </div>
          </div>
        </div>

        <div style="font-size: 11.5px; color: #94A3B8; margin-top: 10px;">
          🛡️ Toutes les routes sont protégées par <code class="mono">requireAuth()</code> avec contrôle RBAC strict.
        </div>
      </div>

      <!-- Right: LiveSync & Performance -->
      <div style="display: flex; flex-direction: column; justify-content: space-between;">
        <div class="card-accent" style="margin-bottom: 12px;">
          <h3 style="color: #2DD4BF;"><span>🔄</span> Moteur LiveSync Temps Réel</h3>
          <p style="font-size: 12.5px; margin-bottom: 10px;">
            Lorsqu'un collaborateur met à jour un dossier ou qu'un expert valide un devis :
          </p>
          <div class="step-pill" style="margin-bottom: 8px;">
            <div class="step-num">1</div>
            <div><strong>touchSyncState(&quot;claims&quot;) :</strong> Incrémente l'horodatage de mutation sur le backend.</div>
          </div>
          <div class="step-pill" style="margin-bottom: 8px;">
            <div class="step-num">2</div>
            <div><strong>broadcastMutation(&quot;claims&quot;) :</strong> Diffuse l'événement via canal BroadcastChannel / SSE.</div>
          </div>
          <div class="step-pill">
            <div class="step-num">3</div>
            <div><strong>Optimistic UI :</strong> L'interface se met à jour en <strong>0 ms</strong> sans attendre le retour réseau.</div>
          </div>
        </div>

        <div class="card">
          <h3 style="color: #F59E0B;"><span>⚡</span> Cache SWR &amp; Zéro Latence</h3>
          <p style="font-size: 12px;">
            Le composant <code class="mono">InsuranceView</code> maintient un cache mémoire de module (<code class="mono">globalCachedClaims</code>) et un stockage local (<code class="mono">localStorage</code>). Le changement d'onglet entre Flotte, Leads et Assurance est instantané.
          </p>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>Architecture Technique : Communication</span>
      <span>Stack : Next.js App Router • BroadcastChannel • Optimistic Updates • SWR Pattern</span>
      <span>Slide 9 / 10</span>
    </div>
  </section>

  <!-- ============================================================== -->
  <!-- SLIDE 10: ROADMAP, SLAS & OPERATIONAL METRICS -->
  <!-- ============================================================== -->
  <section class="slide slide-cover">
    <div class="slide-header">
      <div class="slide-header-left">
        <span class="slide-category-badge badge-teal">Roadmap &amp; Métriques</span>
        <div>
          <div class="slide-title">Indicateurs de Performance (KPIs) &amp; Roadmap Technique</div>
          <div class="slide-subtitle">Objectifs de réduction de l'immobilisation flotte et évolutions produit 2026/2027</div>
        </div>
      </div>
      <div class="mono" style="font-size: 11px; color: #64748B;">ROADMAP 2026+</div>
    </div>

    <!-- KPIs Target Cards -->
    <div class="grid-4" style="margin-bottom: 16px;">
      <div class="card" style="text-align: center; border-top: 3px solid #38BDF8;">
        <div style="font-size: 11px; color: #94A3B8; font-weight: 700;">CONSTAT ➔ MISSION</div>
        <div style="font-size: 26px; font-weight: 800; color: #38BDF8; font-family: monospace; margin: 4px 0;">&lt; 24h</div>
        <div style="font-size: 11px; color: #64748B;">Objectif SLA Assureur</div>
      </div>
      <div class="card" style="text-align: center; border-top: 3px solid #F59E0B;">
        <div style="font-size: 11px; color: #94A3B8; font-weight: 700;">DEVIS ➔ ACCORD EXPERT</div>
        <div style="font-size: 26px; font-weight: 800; color: #F59E0B; font-family: monospace; margin: 4px 0;">&lt; 48h</div>
        <div style="font-size: 11px; color: #64748B;">Visite &amp; Chiffrage</div>
      </div>
      <div class="card" style="text-align: center; border-top: 3px solid #10B981;">
        <div style="font-size: 11px; color: #94A3B8; font-weight: 700;">DURÉE MOYENNE ARRÊT</div>
        <div style="font-size: 26px; font-weight: 800; color: #10B981; font-family: monospace; margin: 4px 0;">18 Jours</div>
        <div style="font-size: 11px; color: #64748B;">Cible (Actuel : 46j)</div>
      </div>
      <div class="card" style="text-align: center; border-top: 3px solid #A855F7;">
        <div style="font-size: 11px; color: #94A3B8; font-weight: 700;">TAUX DE PRISE EN CHARGE</div>
        <div style="font-size: 26px; font-weight: 800; color: #A855F7; font-family: monospace; margin: 4px 0;">94%</div>
        <div style="font-size: 11px; color: #64748B;">Recouvrement Sanlam</div>
      </div>
    </div>

    <!-- Roadmap 3 Columns -->
    <div class="grid-3" style="flex: 1; align-items: stretch;">
      <div class="card">
        <h3 style="color: #38BDF8;"><span>📱</span> 1. PWA Superviseur Offline</h3>
        <p style="font-size: 12px; margin-bottom: 8px;">
          Application mobile Progressive Web App permettant aux superviseurs (Hamza/Ayoub) d'enregistrer les constats et photos même en zone blanche sans 4G, avec synchronisation automatique dès retour réseau.
        </p>
        <span class="slide-category-badge badge-blue" style="font-size: 10px;">Q1 2027 • Mobile</span>
      </div>

      <div class="card">
        <h3 style="color: #F59E0B;"><span>🤖</span> 2. OCR Intelligent du Constat</h3>
        <p style="font-size: 12px; margin-bottom: 8px;">
          Reconnaissance optique de caractères (IA vision) sur le constat amiable papier manuscrit marocain (bilingue arabe/français) pour pré-remplir automatiquement les croix de responsabilité et les coordonnées du tiers.
        </p>
        <span class="slide-category-badge badge-amber" style="font-size: 10px;">Q2 2027 • AI Engine</span>
      </div>

      <div class="card">
        <h3 style="color: #10B981;"><span>🔌</span> 3. Connecteur Direct Assureur</h3>
        <p style="font-size: 12px; margin-bottom: 8px;">
          Intégration d'API directe B2B avec les systèmes d'information des assureurs (Sanlam / Wafa Assurance) pour émettre l'ordre de mission et recevoir la validation d'expertise sans saisie manuelle.
        </p>
        <span class="slide-category-badge badge-teal" style="font-size: 10px;">Q3 2027 • API Partner</span>
      </div>
    </div>

    <div class="slide-footer">
      <span>GoCab Maroc — Excellence Opérationnelle &amp; Ingénierie Flotte</span>
      <span>Présentation Technique Réalisée pour l'Équipe Tech GoCab • 10 / 10</span>
      <span>Fin de Présentation</span>
    </div>
  </section>

</body>
</html>
`;

// Destination paths
const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\4a835044-d1db-4c36-a40a-a23ba766abfb';
const tempHtmlPath = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'gocab_sinistre_presentation.html');
const tempPdfPath = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'gocab_sinistre_presentation.pdf');

const destArtifactPdf = path.join(artifactDir, 'GoCab_Workflow_Sinistre_Assurance_Garage.pdf');
const destArtifactHtml = path.join(artifactDir, 'GoCab_Workflow_Sinistre_Assurance_Garage.html');
const destWorkspacePdf = path.join(process.cwd(), 'GoCab_Workflow_Sinistre_Assurance_Garage.pdf');
const destWorkspaceHtml = path.join(process.cwd(), 'GoCab_Workflow_Sinistre_Assurance_Garage.html');

fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');
console.log('Wrote presentation HTML to:', tempHtmlPath);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const cmd = `"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${tempPdfPath}" "${tempHtmlPath}"`;

console.log('Running Chrome Headless PDF export...');
execSync(cmd, { stdio: 'inherit' });

if (fs.existsSync(tempPdfPath)) {
  const stat = fs.statSync(tempPdfPath);
  console.log(`✅ Successfully generated presentation PDF! (${stat.size} bytes)`);

  fs.copyFileSync(tempPdfPath, destArtifactPdf);
  fs.copyFileSync(tempHtmlPath, destArtifactHtml);
  fs.copyFileSync(tempPdfPath, destWorkspacePdf);
  fs.copyFileSync(tempHtmlPath, destWorkspaceHtml);

  console.log('📁 Saved to Artifact PDF:', destArtifactPdf);
  console.log('📁 Saved to Artifact HTML:', destArtifactHtml);
  console.log('📁 Saved to Workspace PDF:', destWorkspacePdf);
  console.log('📁 Saved to Workspace HTML:', destWorkspaceHtml);
} else {
  throw new Error('PDF file was not created');
}
