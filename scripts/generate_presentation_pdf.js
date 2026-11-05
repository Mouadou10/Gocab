const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GoCab Fleet Performance on inDrive — Executive Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700;800&display=swap');

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
      background-color: #F4EFEA;
      color: #1A2834;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }

    .slide {
      width: 16in;
      height: 9in;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      background-color: #F4EFEA;
      padding: 0.55in 0.75in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Soft Neumorphic Shadows (Inspired by UI Reference Kit) */
    .neu-card {
      background: #F4EFEA;
      border-radius: 24px;
      box-shadow: 10px 10px 22px rgba(188, 172, 154, 0.42), -10px -10px 22px rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.7);
    }

    .neu-card-sm {
      background: #F4EFEA;
      border-radius: 18px;
      box-shadow: 6px 6px 14px rgba(188, 172, 154, 0.38), -6px -6px 14px rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.7);
    }

    .neu-inset {
      background: #ECE5DD;
      border-radius: 16px;
      box-shadow: inset 4px 4px 8px rgba(180, 163, 144, 0.48), inset -4px -4px 8px rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(215, 203, 190, 0.5);
    }

    .neu-inset-sm {
      background: #ECE5DD;
      border-radius: 12px;
      box-shadow: inset 2.5px 2.5px 5px rgba(180, 163, 144, 0.45), inset -2.5px -2.5px 5px rgba(255, 255, 255, 0.9);
    }

    .neu-pill-teal {
      background: #0B464E;
      color: #FFFFFF;
      border-radius: 9999px;
      box-shadow: 4px 4px 10px rgba(11, 70, 78, 0.32), -2px -2px 6px rgba(255, 255, 255, 0.4);
    }

    .neu-pill-soft {
      background: #ECE5DD;
      color: #0B464E;
      border-radius: 9999px;
      box-shadow: 3px 3px 6px rgba(188, 172, 154, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.9);
      font-weight: 700;
    }

    .neu-badge-teal {
      background: #0B464E;
      color: #FFFFFF;
      border-radius: 8px;
      padding: 3px 9px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .neu-badge-amber {
      background: #D97724;
      color: #FFFFFF;
      border-radius: 8px;
      padding: 3px 9px;
      font-size: 11px;
      font-weight: 700;
    }

    .neu-badge-green {
      background: #1B8454;
      color: #FFFFFF;
      border-radius: 8px;
      padding: 3px 9px;
      font-size: 11px;
      font-weight: 700;
    }

    /* Colors */
    .text-teal { color: #0B464E; }
    .text-teal-dark { color: #072D32; }
    .text-muted { color: #6D7D8D; }
    .bg-teal { background-color: #0B464E; }
    .border-subtle { border-color: rgba(200, 186, 170, 0.45); }

    /* Header & Footer */
    .slide-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.25in;
    }

    .slide-title-group h2 {
      font-size: 32px;
      font-weight: 800;
      color: #0B464E;
      letter-spacing: -0.5px;
      line-height: 1.15;
    }

    .slide-title-group p {
      font-size: 14px;
      color: #6D7D8D;
      font-weight: 500;
      margin-top: 4px;
    }

    .slide-badge-top {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #0B464E;
      background: #ECE5DD;
      padding: 6px 14px;
      border-radius: 9999px;
      box-shadow: inset 2px 2px 4px rgba(180, 163, 144, 0.4), inset -2px -2px 4px rgba(255, 255, 255, 0.9);
      margin-bottom: 6px;
    }

    .slide-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.15in;
      border-top: 1px solid rgba(200, 186, 170, 0.35);
      font-size: 12px;
      color: #8A99A8;
    }

    /* Grid & Flex Utilities */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3in; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.25in; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.2in; }

    /* Tables */
    table.neu-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 12.5px;
    }

    table.neu-table th {
      background: #ECE5DD;
      color: #0B464E;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10.5px;
      letter-spacing: 0.8px;
      padding: 10px 14px;
      border-top: 1px solid #DCD4CA;
      border-bottom: 1px solid #DCD4CA;
    }

    table.neu-table th:first-child { border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
    table.neu-table th:last-child { border-top-right-radius: 12px; border-bottom-right-radius: 12px; }

    table.neu-table td {
      padding: 8.5px 14px;
      border-bottom: 1px solid rgba(220, 212, 202, 0.5);
      color: #243444;
    }

    table.neu-table tr:hover td {
      background: rgba(236, 229, 221, 0.4);
    }

    .highlight-cell {
      background: #E4ECE7 !important;
      font-weight: 800;
      color: #0B464E !important;
    }
  </style>
</head>
<body>

  <!-- =============================================================== -->
  <!-- SLIDE 1: COVER SLIDE (ELEGANT NEUMORPHIC FOUNDATION) -->
  <!-- =============================================================== -->
  <section class="slide">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 44px; height: 44px; border-radius: 14px; background: #0B464E; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 22px; box-shadow: 4px 4px 10px rgba(11, 70, 78, 0.3);">
          G
        </div>
        <div>
          <span style="font-size: 16px; font-weight: 800; color: #0B464E; letter-spacing: -0.3px;">GoCab Mobility</span>
          <span style="font-size: 11px; font-weight: 700; color: #6D7D8D; display: block; text-transform: uppercase; letter-spacing: 1px;">Fleet Intelligence Systems</span>
        </div>
      </div>
      <div class="neu-pill-teal" style="padding: 8px 18px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">
        PARTNER PLATFORM ANALYTICS · INDRIVE MAROC
      </div>
    </div>

    <!-- Main Hero Card -->
    <div class="neu-card" style="padding: 0.5in 0.6in; margin: 0.3in 0; position: relative;">
      <div class="slide-badge-top">
        <span>⚡</span> EXECUTIVE PERFORMANCE REPORT · JUNE – OCTOBER 2026
      </div>

      <h1 style="font-size: 46px; font-weight: 900; color: #0B464E; line-height: 1.12; letter-spacing: -1px; max-width: 12in; margin-top: 10px;">
        GoCab Fleet Performance & Growth Trajectory on <span style="text-decoration: underline; text-decoration-color: #22C55E;">inDrive</span>
      </h1>

      <p style="font-size: 17px; color: #526373; max-width: 11in; line-height: 1.5; margin-top: 14px;">
        A comprehensive empirical assessment of active inDrive drivers, fleet utilization, ride volume, order conversion rate (DR%), gross merchandise value (GMV), and driver hourly yield across 5 operating months.
      </p>

      <!-- 4 Hero Stat Cards in Inset Style -->
      <div class="grid-4" style="margin-top: 0.35in;">
        <div class="neu-inset" style="padding: 18px 20px;">
          <span class="text-muted" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Total Completed Rides</span>
          <div class="font-mono" style="font-size: 32px; font-weight: 800; color: #0B464E; margin-top: 4px;">25,257</div>
          <span style="font-size: 11px; color: #1B8454; font-weight: 700;">+84.5% vs June Inception</span>
        </div>

        <div class="neu-inset" style="padding: 18px 20px;">
          <span class="text-muted" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Gross Merchandise Value</span>
          <div class="font-mono" style="font-size: 32px; font-weight: 800; color: #0B464E; margin-top: 4px;">$115,359</div>
          <span style="font-size: 11px; color: #526373; font-weight: 600;">~ 1.15 Million MAD Volume</span>
        </div>

        <div class="neu-inset" style="padding: 18px 20px;">
          <span class="text-muted" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Record DR% (Fulfillment)</span>
          <div class="font-mono" style="font-size: 32px; font-weight: 800; color: #1B8454; margin-top: 4px;">80.3%</div>
          <span style="font-size: 11px; color: #1B8454; font-weight: 700;">All-Time Peak in October</span>
        </div>

        <div class="neu-inset" style="padding: 18px 20px;">
          <span class="text-muted" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Total Distance Driven</span>
          <div class="font-mono" style="font-size: 32px; font-weight: 800; color: #0B464E; margin-top: 4px;">284,484 <span style="font-size: 16px;">km</span></div>
          <span style="font-size: 11px; color: #526373; font-weight: 600;">22,271 Hours in Service</span>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>GoCab Car Rental & Fleet Operations LLC · Casablanca, Morocco</span>
      <span>Confidential Executive Deck · Slide 1 / 8</span>
    </div>
  </section>


  <!-- =============================================================== -->
  <!-- SLIDE 2: COMPLETE MONTH-OVER-MONTH KPI TABLE -->
  <!-- =============================================================== -->
  <section class="slide">
    <div class="slide-header">
      <div class="slide-title-group">
        <div class="slide-badge-top">KPI SCORECARD MATRIX</div>
        <h2>Month-over-Month (MoM) Operational Evolution</h2>
        <p>Complete multi-dimensional tracking of every operational, financial, and engagement KPI from June to October 2026.</p>
      </div>
      <div class="neu-pill-soft" style="padding: 8px 16px; font-size: 11.5px;">
        * Note: August sheet replicates July data in partner export
      </div>
    </div>

    <!-- Neumorphic Table Card -->
    <div class="neu-card" style="padding: 16px 20px; flex: 1; display: flex; flex-direction: column; justify-content: center;">
      <table class="neu-table">
        <thead>
          <tr>
            <th style="width: 28%;">Key Performance Indicator (KPI)</th>
            <th style="text-align: center;">June</th>
            <th style="text-align: center;">July</th>
            <th style="text-align: center; color: #8A99A8;">August*</th>
            <th style="text-align: center;">September</th>
            <th style="text-align: center; background: #E4ECE7; color: #0B464E;">October</th>
            <th style="text-align: right;">MoM (Oct vs Sep)</th>
          </tr>
        </thead>
        <tbody class="font-mono">
          <tr>
            <td style="font-family: 'Plus Jakarta Sans'; font-weight: 600;">Active inDrive Drivers (Rides &gt; 0)</td>
            <td style="text-align: center;">38</td>
            <td style="text-align: center;">67</td>
            <td style="text-align: center; color: #8A99A8;">67</td>
            <td style="text-align: center; font-weight: 700;">66</td>
            <td style="text-align: center;" class="highlight-cell">61</td>
            <td style="text-align: right; color: #C2410C; font-weight: 700;">-7.6%</td>
          </tr>
          <tr>
            <td style="font-family: 'Plus Jakarta Sans'; font-weight: 600;">Total Registered Cars on inDrive</td>
            <td style="text-align: center;">40</td>
            <td style="text-align: center;">68</td>
            <td style="text-align: center; color: #8A99A8;">68</td>
            <td style="text-align: center;">66</td>
            <td style="text-align: center;" class="highlight-cell">63</td>
            <td style="text-align: right; color: #C2410C;">-4.5%</td>
          </tr>
          <tr>
            <td style="font-family: 'Plus Jakarta Sans'; font-weight: 600;">Total Completed Rides</td>
            <td style="text-align: center;">3,378</td>
            <td style="text-align: center;">4,666</td>
            <td style="text-align: center; color: #8A99A8;">4,666</td>
            <td style="text-align: center; font-weight: 700;">6,316</td>
            <td style="text-align: center;" class="highlight-cell">6,231</td>
            <td style="text-align: right; color: #526373;">-1.3%</td>
          </tr>
          <tr>
            <td style="font-family: 'Plus Jakarta Sans'; font-weight: 600;">Total Orders Received (Requests)</td>
            <td style="text-align: center;">4,448</td>
            <td style="text-align: center;">6,125</td>
            <td style="text-align: center; color: #8A99A8;">6,125</td>
            <td style="text-align: center;">7,978</td>
            <td style="text-align: center;" class="highlight-cell">7,755</td>
            <td style="text-align: right; color: #526373;">-2.8%</td>
          </tr>
          <tr style="background: rgba(27, 132, 84, 0.06);">
            <td style="font-family: 'Plus Jakarta Sans'; font-weight: 800; color: #1B8454;">Delivery Rate (Fulfillment DR%)</td>
            <td style="text-align: center;">75.9%</td>
            <td style="text-align: center;">76.2%</td>
            <td style="text-align: center; color: #8A99A8;">76.2%</td>
            <td style="text-align: center;">79.2%</td>
            <td style="text-align: center; font-size: 14px;" class="highlight-cell">80.3%</td>
            <td style="text-align: right; color: #1B8454; font-weight: 800;">+1.2 pts (Record)</td>
          </tr>
          <tr>
            <td style="font-family: 'Plus Jakarta Sans'; font-weight: 600;">Gross Merchandise Value (GMV USD)</td>
            <td style="text-align: center;">$15,564</td>
            <td style="text-align: center;">$23,269</td>
            <td style="text-align: center; color: #8A99A8;">$23,269</td>
            <td style="text-align: center; font-weight: 700;">$27,667</td>
            <td style="text-align: center;" class="highlight-cell">$25,590</td>
            <td style="text-align: right; color: #C2410C;">-7.5%</td>
          </tr>
          <tr>
            <td style="font-family: 'Plus Jakarta Sans'; font-weight: 600;">inDrive Net Revenue (Commission USD)</td>
            <td style="text-align: center;">$1,365</td>
            <td style="text-align: center;">$1,937</td>
            <td style="text-align: center; color: #8A99A8;">$1,937</td>
            <td style="text-align: center; font-weight: 700;">$2,528</td>
            <td style="text-align: center;" class="highlight-cell">$2,426</td>
            <td style="text-align: right; color: #526373;">-4.0%</td>
          </tr>
          <tr>
            <td style="font-family: 'Plus Jakarta Sans'; font-weight: 600;">Total Supply Hours (Logged On)</td>
            <td style="text-align: center;">2,774 h</td>
            <td style="text-align: center;">4,033 h</td>
            <td style="text-align: center; color: #8A99A8;">4,033 h</td>
            <td style="text-align: center; font-weight: 700;">5,849 h</td>
            <td style="text-align: center;" class="highlight-cell">5,581 h</td>
            <td style="text-align: right; color: #526373;">-4.6%</td>
          </tr>
          <tr style="background: rgba(11, 70, 78, 0.05);">
            <td style="font-family: 'Plus Jakarta Sans'; font-weight: 800; color: #0B464E;">Avg Rides per Active Driver</td>
            <td style="text-align: center;">88.9</td>
            <td style="text-align: center;">69.6</td>
            <td style="text-align: center; color: #8A99A8;">69.6</td>
            <td style="text-align: center;">95.7</td>
            <td style="text-align: center; font-size: 14px;" class="highlight-cell">102.1</td>
            <td style="text-align: right; color: #1B8454; font-weight: 800;">+6.7% (Record)</td>
          </tr>
          <tr style="background: rgba(11, 70, 78, 0.05);">
            <td style="font-family: 'Plus Jakarta Sans'; font-weight: 800; color: #0B464E;">Daily Engagement (Hours / Day / Driver)</td>
            <td style="text-align: center;">4.92 h/d</td>
            <td style="text-align: center;">5.57 h/d</td>
            <td style="text-align: center; color: #8A99A8;">5.57 h/d</td>
            <td style="text-align: center;">5.94 h/d</td>
            <td style="text-align: center; font-size: 14px;" class="highlight-cell">6.71 h/d</td>
            <td style="text-align: right; color: #1B8454; font-weight: 800;">+13.0% (Record)</td>
          </tr>
          <tr>
            <td style="font-family: 'Plus Jakarta Sans'; font-weight: 600;">Avg Driver Yield ($ / Supply Hour)</td>
            <td style="text-align: center;">$5.39/h</td>
            <td style="text-align: center;">$5.20/h</td>
            <td style="text-align: center; color: #8A99A8;">$5.20/h</td>
            <td style="text-align: center;">$4.19/h</td>
            <td style="text-align: center;" class="highlight-cell">$3.98/h</td>
            <td style="text-align: right; color: #6D7D8D;">-5.0%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="slide-footer">
      <span>GoCab Partner Intelligence · Single Source of Truth Reconciled</span>
      <span>Slide 2 / 8</span>
    </div>
  </section>


  <!-- =============================================================== -->
  <!-- SLIDE 3: ACTIVE INDRIVE DRIVERS VS FLEET EXPANSION -->
  <!-- =============================================================== -->
  <section class="slide">
    <div class="slide-header">
      <div class="slide-title-group">
        <div class="slide-badge-top">FLEET PENETRATION & ASSET ALLOCATION</div>
        <h2>Active inDrive Drivers vs. GoCab Total Fleet Growth</h2>
        <p>Analyzing how platform concentration evolved as GoCab expanded its overall vehicle fleet from 40 to 103 cars.</p>
      </div>
      <span class="neu-pill-teal" style="padding: 7px 16px; font-size: 12px;">+157% Total Fleet Scale</span>
    </div>

    <div class="grid-2" style="flex: 1; align-items: stretch;">
      <!-- Left Card: Evolution of Penetration -->
      <div class="neu-card" style="padding: 24px 28px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="font-size: 18px; font-weight: 800; color: #0B464E; margin-bottom: 6px;">inDrive Deployment vs Overall Fleet Scale</h3>
          <p class="text-muted" style="font-size: 13px; margin-bottom: 22px;">Percentage of total GoCab fleet actively dedicated to inDrive operations.</p>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- June -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 5px;">
                <span>June 2026</span>
                <span class="font-mono text-teal">38 Active / ~40 Fleet · 95.0% Concentration</span>
              </div>
              <div class="neu-inset-sm" style="height: 14px; padding: 2px; overflow: hidden;">
                <div style="width: 95%; height: 100%; background: #0B464E; border-radius: 8px;"></div>
              </div>
            </div>

            <!-- July -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 5px;">
                <span>July 2026</span>
                <span class="font-mono text-teal">67 Active / ~75 Fleet · 89.3% Concentration</span>
              </div>
              <div class="neu-inset-sm" style="height: 14px; padding: 2px; overflow: hidden;">
                <div style="width: 89.3%; height: 100%; background: #0B464E; border-radius: 8px;"></div>
              </div>
            </div>

            <!-- August -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 5px;">
                <span>August 2026</span>
                <span class="font-mono text-teal">67 Active / ~85 Fleet · 78.8% Concentration</span>
              </div>
              <div class="neu-inset-sm" style="height: 14px; padding: 2px; overflow: hidden;">
                <div style="width: 78.8%; height: 100%; background: #0B464E; border-radius: 8px;"></div>
              </div>
            </div>

            <!-- September -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 5px;">
                <span>September 2026</span>
                <span class="font-mono text-teal">66 Active / ~95 Fleet · 69.5% Concentration</span>
              </div>
              <div class="neu-inset-sm" style="height: 14px; padding: 2px; overflow: hidden;">
                <div style="width: 69.5%; height: 100%; background: #0B464E; border-radius: 8px;"></div>
              </div>
            </div>

            <!-- October -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 5px;">
                <span style="color: #0B464E; font-weight: 800;">October 2026 (Current)</span>
                <span class="font-mono" style="color: #0B464E; font-weight: 800;">61 Active / 103 Fleet · 59.2% Platform Share</span>
              </div>
              <div class="neu-inset-sm" style="height: 16px; padding: 2px; overflow: hidden; border: 1px solid rgba(11, 70, 78, 0.4);">
                <div style="width: 59.2%; height: 100%; background: #1B8454; border-radius: 8px;"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="neu-inset" style="padding: 14px 18px; margin-top: 14px; font-size: 12.5px; line-height: 1.45; color: #324454;">
          <strong style="color: #0B464E;">Key Insight:</strong> GoCab started with an almost 1-to-1 correlation with inDrive (95%). As the fleet crossed 100 vehicles, GoCab matured into a multi-channel operator with drivers balancing private clients and multi-app shifts, while maintaining a reliable 61–67 car dedicated core on inDrive.
        </div>
      </div>

      <!-- Right Card: Current Fleet Status Breakdown from CRM -->
      <div class="neu-card" style="padding: 24px 28px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="font-size: 18px; font-weight: 800; color: #0B464E; margin-bottom: 6px;">GoCab Live CRM Fleet Breakdown (103 Vehicles)</h3>
          <p class="text-muted" style="font-size: 13px; margin-bottom: 18px;">Real-time asset allocation across operational states.</p>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div class="neu-inset" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-weight: 800; font-size: 14px; color: #0B464E;">Actif / Assigned Drivers</span>
                <span class="text-muted" style="display: block; font-size: 11.5px;">Actively generating weekly rental income</span>
              </div>
              <div style="text-align: right;">
                <span class="font-mono" style="font-size: 22px; font-weight: 800; color: #1B8454;">88</span>
                <span style="font-size: 11.5px; font-weight: 700; color: #526373; display: block;">85.4% of fleet</span>
              </div>
            </div>

            <div class="neu-inset" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-weight: 800; font-size: 14px; color: #0B464E;">Available at Park (Hub Casablanca)</span>
                <span class="text-muted" style="display: block; font-size: 11.5px;">Inspected & ready for immediate lease onboarding</span>
              </div>
              <div style="text-align: right;">
                <span class="font-mono" style="font-size: 22px; font-weight: 800; color: #0B464E;">3</span>
                <span style="font-size: 11.5px; font-weight: 700; color: #526373; display: block;">2.9% of fleet</span>
              </div>
            </div>

            <div class="neu-inset" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-weight: 800; font-size: 14px; color: #0B464E;">In Garage / Scheduled Maintenance</span>
                <span class="text-muted" style="display: block; font-size: 11.5px;">Undergoing vidange, bodywork, or mechanical repair</span>
              </div>
              <div style="text-align: right;">
                <span class="font-mono" style="font-size: 22px; font-weight: 800; color: #D97724;">8</span>
                <span style="font-size: 11.5px; font-weight: 700; color: #526373; display: block;">7.8% of fleet</span>
              </div>
            </div>

            <div class="neu-inset" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-weight: 800; font-size: 14px; color: #0B464E;">Police Immobilization / Fourrière</span>
                <span class="text-muted" style="display: block; font-size: 11.5px;">Pending document clearance or administrative pickup</span>
              </div>
              <div style="text-align: right;">
                <span class="font-mono" style="font-size: 22px; font-weight: 800; color: #DC2626;">4</span>
                <span style="font-size: 11.5px; font-weight: 700; color: #526373; display: block;">3.9% of fleet</span>
              </div>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid rgba(200, 186, 170, 0.4); font-size: 12.5px;">
          <span>Active inDrive Utilization Rate:</span>
          <span class="font-mono" style="font-weight: 800; color: #0B464E; font-size: 14px;">61 inDrive / 88 Assigned = 69.3% Active Platform Rate</span>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>GoCab Asset Management & Fleet Allocation</span>
      <span>Slide 3 / 8</span>
    </div>
  </section>


  <!-- =============================================================== -->
  <!-- SLIDE 4: DRIVER PRODUCTIVITY & INTENSITY INFLECTION -->
  <!-- =============================================================== -->
  <section class="slide">
    <div class="slide-header">
      <div class="slide-title-group">
        <div class="slide-badge-top">PRODUCTIVITY & WORKFORCE INTENSITY</div>
        <h2>Fewer Drivers, Higher Output — The October Inflection</h2>
        <p>Operational optimization enabled GoCab to extract record productivity per active driver in October.</p>
      </div>
      <div class="neu-pill-teal" style="padding: 7px 18px; font-size: 12px;">+6.7% Output Surge MoM</div>
    </div>

    <div class="grid-3" style="margin-bottom: 0.25in;">
      <!-- Card 1 -->
      <div class="neu-card" style="padding: 24px; text-align: center;">
        <div class="slide-badge-top" style="margin-bottom: 12px;">RECORD MONTHLY VOLUME</div>
        <div class="font-mono" style="font-size: 54px; font-weight: 900; color: #0B464E; line-height: 1;">102.1</div>
        <div style="font-size: 16px; font-weight: 800; color: #1B8454; margin: 8px 0 6px;">Completed Rides / Driver</div>
        <p class="text-muted" style="font-size: 12.5px; line-height: 1.45;">
          Up from 95.7 in Sept and 69.6 in July. First time GoCab drivers averaged over 100 inDrive rides per car in a month.
        </p>
      </div>

      <!-- Card 2 -->
      <div class="neu-card" style="padding: 24px; text-align: center;">
        <div class="slide-badge-top" style="margin-bottom: 12px;">LONGEST SHIFTS RECORDED</div>
        <div class="font-mono" style="font-size: 54px; font-weight: 900; color: #0B464E; line-height: 1;">6.71 <span style="font-size: 24px;">h/d</span></div>
        <div style="font-size: 16px; font-weight: 800; color: #1B8454; margin: 8px 0 6px;">Daily Supply Hours / Driver</div>
        <p class="text-muted" style="font-size: 12.5px; line-height: 1.45;">
          A massive +13.0% increase vs Sept (5.94 h/d) and +1h47 per day vs June (4.92 h/d). Drivers demonstrated unprecedented platform loyalty.
        </p>
      </div>

      <!-- Card 3 -->
      <div class="neu-card" style="padding: 24px; text-align: center;">
        <div class="slide-badge-top" style="margin-bottom: 12px;">TOTAL LOGGED HOURS</div>
        <div class="font-mono" style="font-size: 54px; font-weight: 900; color: #0B464E; line-height: 1;">91.5 <span style="font-size: 24px;">h</span></div>
        <div style="font-size: 16px; font-weight: 800; color: #0B464E; margin: 8px 0 6px;">Monthly Supply Hours / Car</div>
        <p class="text-muted" style="font-size: 12.5px; line-height: 1.45;">
          Up +3.2% MoM vs Sept (88.6 h) and +52% vs July (60.2 h). Full-time dedication expanded significantly.
        </p>
      </div>
    </div>

    <!-- Comparative Analysis Box -->
    <div class="neu-card" style="padding: 20px 28px; flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 30px;">
      <div style="flex: 1;">
        <h4 style="font-size: 16px; font-weight: 800; color: #0B464E; margin-bottom: 6px;">The "Quality Over Headcount" Dynamics</h4>
        <p style="font-size: 13px; color: #3A4C5E; line-height: 1.5;">
          In October, the registered inDrive car count reduced from 66 to 61 (-7.6%), yet total ride output barely moved (-1.3% from 6,316 to 6,231). Casual, low-intent drivers naturally filtered out, leaving a core of highly engaged drivers who drove 6.7 hours per day and delivered over 100 rides per vehicle.
        </p>
      </div>
      <div class="neu-inset" style="padding: 16px 22px; text-align: center; min-width: 2.8in;">
        <span class="text-muted" style="font-size: 11px; font-weight: 700; text-transform: uppercase;">Fleet Ride Output Retention</span>
        <div class="font-mono" style="font-size: 32px; font-weight: 800; color: #1B8454;">98.7%</div>
        <span style="font-size: 11px; color: #526373; font-weight: 600;">Maintained with 5 fewer active cars</span>
      </div>
    </div>

    <div class="slide-footer">
      <span>GoCab Operations & Driver Workforce Productivity</span>
      <span>Slide 4 / 8</span>
    </div>
  </section>


  <!-- =============================================================== -->
  <!-- SLIDE 5: ORDER FULFILLMENT & DELIVERY RATE (DR%) -->
  <!-- =============================================================== -->
  <section class="slide">
    <div class="slide-header">
      <div class="slide-title-group">
        <div class="slide-badge-top">QUALITY OF SERVICE & ACCEPTANCE</div>
        <h2>Order Fulfillment Reaches Peak Efficiency (80.3% DR)</h2>
        <p>Analyzing order acceptance, trip completion, and the steady reduction of ride cancellations.</p>
      </div>
      <span class="neu-badge-green" style="font-size: 13px; padding: 6px 14px;">+4.4 pts DR Gain since June</span>
    </div>

    <div class="grid-2" style="flex: 1; align-items: stretch;">
      <!-- Chart Card -->
      <div class="neu-card" style="padding: 26px 30px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="font-size: 18px; font-weight: 800; color: #0B464E; margin-bottom: 4px;">Delivery Rate (DR%) Trajectory</h3>
          <p class="text-muted" style="font-size: 13px; margin-bottom: 24px;">Percentage of total offered inDrive orders successfully completed.</p>

          <div style="display: flex; flex-direction: column; gap: 18px;">
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 5px;">
                <span>June 2026</span>
                <span class="font-mono">75.9% (3,378 rides / 4,448 orders)</span>
              </div>
              <div class="neu-inset-sm" style="height: 16px; padding: 2px;">
                <div style="width: 75.9%; height: 100%; background: #6D7D8D; border-radius: 8px;"></div>
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 5px;">
                <span>July & August 2026</span>
                <span class="font-mono">76.2% (4,666 rides / 6,125 orders)</span>
              </div>
              <div class="neu-inset-sm" style="height: 16px; padding: 2px;">
                <div style="width: 76.2%; height: 100%; background: #6D7D8D; border-radius: 8px;"></div>
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 5px;">
                <span>September 2026</span>
                <span class="font-mono text-teal">79.2% (6,316 rides / 7,978 orders)</span>
              </div>
              <div class="neu-inset-sm" style="height: 16px; padding: 2px;">
                <div style="width: 79.2%; height: 100%; background: #0B464E; border-radius: 8px;"></div>
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; margin-bottom: 5px; color: #1B8454;">
                <span>October 2026 (Historic Record)</span>
                <span class="font-mono">80.3% (6,231 rides / 7,755 orders)</span>
              </div>
              <div class="neu-inset-sm" style="height: 18px; padding: 2px; border: 1px solid #1B8454;">
                <div style="width: 80.3%; height: 100%; background: #1B8454; border-radius: 8px;"></div>
              </div>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid rgba(200, 186, 170, 0.4); font-size: 12px; color: #526373;">
          <span>inDrive Partner Benchmark Target: <strong>&gt; 75.0%</strong></span>
          <span style="color: #1B8454; font-weight: 800;">GoCab Outperforms by +5.3 pts</span>
        </div>
      </div>

      <!-- Qualitative Factors Card -->
      <div class="neu-card" style="padding: 26px 30px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="font-size: 18px; font-weight: 800; color: #0B464E; margin-bottom: 16px;">Core Drivers of Fulfillment Excellence</h3>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="neu-inset" style="padding: 14px 16px;">
              <span style="font-size: 13.5px; font-weight: 800; color: #0B464E; display: block; margin-bottom: 4px;">
                1. Driver Quality & Cancellation Elimination
              </span>
              <p class="text-muted" style="font-size: 12px; line-height: 1.45;">
                The reduction in casual drivers eliminated speculative order bids. Drivers in October committed to bids they intended to complete, slashing passenger-side cancellations.
              </p>
            </div>

            <div class="neu-inset" style="padding: 14px 16px;">
              <span style="font-size: 13.5px; font-weight: 800; color: #0B464E; display: block; margin-bottom: 4px;">
                2. Strategic Hub Positioning
              </span>
              <p class="text-muted" style="font-size: 12px; line-height: 1.45;">
                Drivers concentrated around core high-density hubs (Maarif, Centre Ville, Casablanca Port, Sidi Maarouf) reducing dispatch pickup distance and time-to-client.
              </p>
            </div>

            <div class="neu-inset" style="padding: 14px 16px;">
              <span style="font-size: 13.5px; font-weight: 800; color: #0B464E; display: block; margin-bottom: 4px;">
                3. High Vehicle Uptime via CRM Maintenance
              </span>
              <p class="text-muted" style="font-size: 12px; line-height: 1.45;">
                Real-time vidange scheduling and repair ticketing in the GoCab CRM minimized roadside breakdowns and sudden ride interruptions.
              </p>
            </div>
          </div>
        </div>

        <div style="font-size: 12px; color: #0B464E; font-weight: 700; text-align: center; padding-top: 8px;">
          Commercial Impact: Qualifies GoCab for Preferred Partner Status & Lower Platform Fees
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>GoCab Partner Quality Metrics · inDrive Maroc</span>
      <span>Slide 5 / 8</span>
    </div>
  </section>


  <!-- =============================================================== -->
  <!-- SLIDE 6: FINANCIAL PERFORMANCE & EARNINGS YIELD -->
  <!-- =============================================================== -->
  <section class="slide">
    <div class="slide-header">
      <div class="slide-title-group">
        <div class="slide-badge-top">FINANCIAL ANALYSIS & UNIT ECONOMICS</div>
        <h2>Gross Volume (GMV), Platform Revenue & Hourly Yield</h2>
        <p>Evaluating total financial turnover and understanding driver hourly revenue dynamics.</p>
      </div>
      <div class="neu-pill-teal" style="padding: 7px 18px; font-size: 12px;">$115.3K Total GMV Generated</div>
    </div>

    <div class="grid-4" style="margin-bottom: 0.25in;">
      <div class="neu-card" style="padding: 18px 20px;">
        <span class="text-muted" style="font-size: 11px; font-weight: 700; text-transform: uppercase;">October Gross GMV</span>
        <div class="font-mono" style="font-size: 32px; font-weight: 800; color: #0B464E; margin: 4px 0;">$25,590</div>
        <span class="text-muted" style="font-size: 11.5px;">Sept Peak: $27,667 (-7.5%)</span>
      </div>

      <div class="neu-card" style="padding: 18px 20px;">
        <span class="text-muted" style="font-size: 11px; font-weight: 700; text-transform: uppercase;">inDrive Net Commission</span>
        <div class="font-mono" style="font-size: 32px; font-weight: 800; color: #0B464E; margin: 4px 0;">$2,426</div>
        <span style="font-size: 11.5px; color: #1B8454; font-weight: 700;">9.48% Effective Take Rate</span>
      </div>

      <div class="neu-card" style="padding: 18px 20px;">
        <span class="text-muted" style="font-size: 11px; font-weight: 700; text-transform: uppercase;">Avg GMV / Active Driver</span>
        <div class="font-mono" style="font-size: 32px; font-weight: 800; color: #1B8454; margin: 4px 0;">$420 <span style="font-size: 16px;">/mo</span></div>
        <span style="font-size: 11.5px; color: #1B8454; font-weight: 700;">All-Time High (Stable vs Sept $419)</span>
      </div>

      <div class="neu-card" style="padding: 18px 20px;">
        <span class="text-muted" style="font-size: 11px; font-weight: 700; text-transform: uppercase;">Avg Hourly Driver Yield</span>
        <div class="font-mono" style="font-size: 32px; font-weight: 800; color: #0B464E; margin: 4px 0;">$3.98 <span style="font-size: 16px;">/h</span></div>
        <span class="text-muted" style="font-size: 11.5px;">-5.0% MoM vs Sept ($4.19/h)</span>
      </div>
    </div>

    <!-- Explaining the Hourly Yield Shift -->
    <div class="neu-card" style="padding: 24px 28px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <h3 style="font-size: 17px; font-weight: 800; color: #0B464E; margin-bottom: 12px;">
          Deconstructing the Hourly Yield Evolution: From $5.39/h in June to $3.98/h in October
        </h3>

        <div class="grid-3" style="gap: 18px;">
          <div class="neu-inset" style="padding: 14px 18px;">
            <span style="font-size: 13px; font-weight: 800; color: #0B464E; display: block; margin-bottom: 4px;">1. Off-Peak Hours Expansion</span>
            <p class="text-muted" style="font-size: 11.5px; line-height: 1.45;">
              Drivers increased daily shifts from 4.9 hours to 6.7 hours (+36%). Operating in midday lulls and late evening hours naturally spreads rides over more hours, lowering statistical hourly earnings while maximizing gross daily take-home pay.
            </p>
          </div>

          <div class="neu-inset" style="padding: 14px 18px;">
            <span style="font-size: 13px; font-weight: 800; color: #0B464E; display: block; margin-bottom: 4px;">2. Longer Distance per Ride</span>
            <p class="text-muted" style="font-size: 11.5px; line-height: 1.45;">
              Average trip distance lengthened from 9.2 km to 10.8 km (+17%). Longer inter-borough trips in Casablanca reduce total ride turnaround cycles, even while fare values remain steady.
            </p>
          </div>

          <div class="neu-inset" style="padding: 14px 18px;">
            <span style="font-size: 13px; font-weight: 800; color: #0B464E; display: block; margin-bottom: 4px;">3. Preserved Driver Solvency</span>
            <p class="text-muted" style="font-size: 11.5px; line-height: 1.45;">
              Critically, monthly net driver turnover reached its all-time high of <strong>$420 (~4,200 MAD)</strong> per active car solely on inDrive. This robust top-line directly supports on-time weekly GoCab lease collections.
            </p>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid rgba(200, 186, 170, 0.4); font-size: 12px; color: #526373;">
        <span>Annualized inDrive GMV Run Rate: <strong>~$310,000 USD / Year (~3.1M MAD)</strong></span>
        <span>GoCab Lease Payment Security Index: <strong>STRONG</strong></span>
      </div>
    </div>

    <div class="slide-footer">
      <span>GoCab Financial Unit Economics & Driver Yield</span>
      <span>Slide 6 / 8</span>
    </div>
  </section>


  <!-- =============================================================== -->
  <!-- SLIDE 7: DRIVER COHORTS & TOP PERFORMERS -->
  <!-- =============================================================== -->
  <section class="slide">
    <div class="slide-header">
      <div class="slide-title-group">
        <div class="slide-badge-top">DRIVER COHORT SEGMENTATION & BENCHMARKS</div>
        <h2>Workforce Distribution & October Top Performers</h2>
        <p>Pyramid breakdown by ride volume tiers and recognition of GoCab's top revenue-generating vehicles.</p>
      </div>
      <div class="neu-pill-teal" style="padding: 7px 18px; font-size: 12px;">Top Driver: 558 Rides</div>
    </div>

    <div class="grid-2" style="flex: 1; align-items: stretch;">
      <!-- Cohort Pyramid -->
      <div class="neu-card" style="padding: 24px 28px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="font-size: 18px; font-weight: 800; color: #0B464E; margin-bottom: 6px;">Driver Activity Pyramid (October 2026)</h3>
          <p class="text-muted" style="font-size: 13px; margin-bottom: 20px;">Breakdown of 63 registered inDrive vehicles by completed ride volume.</p>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 800; color: #0B464E; margin-bottom: 4px;">
                <span>Elite Tier (&gt; 300 rides / month)</span>
                <span class="font-mono">2 drivers · 3.2%</span>
              </div>
              <div class="neu-inset-sm" style="height: 12px; padding: 2px;">
                <div style="width: 3.2%; height: 100%; background: #0B464E; border-radius: 6px;"></div>
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 800; color: #1B8454; margin-bottom: 4px;">
                <span>Intensive Core (150 – 300 rides / month)</span>
                <span class="font-mono">12 drivers · 19.0% (DOUBLED vs June!)</span>
              </div>
              <div class="neu-inset-sm" style="height: 12px; padding: 2px;">
                <div style="width: 19%; height: 100%; background: #1B8454; border-radius: 6px;"></div>
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 700; color: #0B464E; margin-bottom: 4px;">
                <span>Standard Active (50 – 150 rides / month)</span>
                <span class="font-mono">26 drivers · 41.3%</span>
              </div>
              <div class="neu-inset-sm" style="height: 12px; padding: 2px;">
                <div style="width: 41.3%; height: 100%; background: #0B464E; border-radius: 6px;"></div>
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 700; color: #D97724; margin-bottom: 4px;">
                <span>Casual Tier (1 – 50 rides / month)</span>
                <span class="font-mono">21 drivers · 33.3% (Down from 68% in July)</span>
              </div>
              <div class="neu-inset-sm" style="height: 12px; padding: 2px;">
                <div style="width: 33.3%; height: 100%; background: #D97724; border-radius: 6px;"></div>
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 700; color: #DC2626; margin-bottom: 4px;">
                <span>Dormant on inDrive (0 rides in October)</span>
                <span class="font-mono">2 drivers · 3.2%</span>
              </div>
              <div class="neu-inset-sm" style="height: 12px; padding: 2px;">
                <div style="width: 3.2%; height: 100%; background: #DC2626; border-radius: 6px;"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="neu-inset" style="padding: 12px 16px; font-size: 12px; line-height: 1.4; color: #1B8454; font-weight: 700;">
          Professionalization Achievement: 63.5% of inDrive drivers completed 50+ rides in October, vs only 30% in July.
        </div>
      </div>

      <!-- Top Performers Table -->
      <div class="neu-card" style="padding: 24px 28px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="font-size: 18px; font-weight: 800; color: #0B464E; margin-bottom: 14px;">October 2026 Fleet Champions (Top 5)</h3>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="neu-inset" style="padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="font-mono" style="font-size: 13.5px; font-weight: 800; color: #0B464E;">#1 · 26629-ي-6</span>
                <span class="text-muted" style="display: block; font-size: 11px;">258 hours · 8.89 h/day · DR: 89% · $5.5/h</span>
              </div>
              <div style="text-align: right;" class="font-mono">
                <span style="font-size: 15px; font-weight: 800; color: #1B8454;">558 rides</span>
                <span style="display: block; font-size: 12px; color: #526373; font-weight: 700;">$1,554 GMV</span>
              </div>
            </div>

            <div class="neu-inset" style="padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="font-mono" style="font-size: 13.5px; font-weight: 800; color: #0B464E;">#2 · MA-39456-Y-6</span>
                <span class="text-muted" style="display: block; font-size: 11px;">448 hours · 15.45 h/day (Dual-Shift) · DR: 65%</span>
              </div>
              <div style="text-align: right;" class="font-mono">
                <span style="font-size: 15px; font-weight: 800; color: #1B8454;">369 rides</span>
                <span style="display: block; font-size: 12px; color: #526373; font-weight: 700;">$1,708 GMV</span>
              </div>
            </div>

            <div class="neu-inset" style="padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="font-mono" style="font-size: 13.5px; font-weight: 800; color: #0B464E;">#3 · 15559-ي-6</span>
                <span class="text-muted" style="display: block; font-size: 11px;">173 hours · 6.42 h/day · DR: 84% · $5.1/h</span>
              </div>
              <div style="text-align: right;" class="font-mono">
                <span style="font-size: 15px; font-weight: 800; color: #1B8454;">290 rides</span>
                <span style="display: block; font-size: 12px; color: #526373; font-weight: 700;">$987 GMV</span>
              </div>
            </div>

            <div class="neu-inset" style="padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="font-mono" style="font-size: 13.5px; font-weight: 800; color: #0B464E;">#4 · 40842-ي-6</span>
                <span class="text-muted" style="display: block; font-size: 11px;">183 hours · 10.18 h/day · DR: 82% · $5.3/h</span>
              </div>
              <div style="text-align: right;" class="font-mono">
                <span style="font-size: 15px; font-weight: 800; color: #0B464E;">257 rides</span>
                <span style="display: block; font-size: 12px; color: #526373; font-weight: 700;">$1,095 GMV</span>
              </div>
            </div>

            <div class="neu-inset" style="padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="font-mono" style="font-size: 13.5px; font-weight: 800; color: #0B464E;">#5 · 964983WW</span>
                <span class="text-muted" style="display: block; font-size: 11px;">186 hours · 6.19 h/day · DR: 79% · $3.9/h</span>
              </div>
              <div style="text-align: right;" class="font-mono">
                <span style="font-size: 15px; font-weight: 800; color: #0B464E;">234 rides</span>
                <span style="display: block; font-size: 12px; color: #526373; font-weight: 700;">$787 GMV</span>
              </div>
            </div>
          </div>
        </div>

        <div style="font-size: 11.5px; color: #6D7D8D; text-align: center; padding-top: 10px; border-top: 1px solid rgba(200, 186, 170, 0.4);">
          Top 5 cars accounted for 1,708 rides (27.4% of total fleet volume) in October.
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <span>GoCab Driver Performance & Cohort Intelligence</span>
      <span>Slide 7 / 8</span>
    </div>
  </section>


  <!-- =============================================================== -->
  <!-- SLIDE 8: STRATEGIC RECOMMENDATIONS & ACTION PLAN -->
  <!-- =============================================================== -->
  <section class="slide">
    <div class="slide-header">
      <div class="slide-title-group">
        <div class="slide-badge-top">STRATEGIC ROADMAP & NEXT STEPS</div>
        <h2>Recommendations for GoCab Executive Leadership</h2>
        <p>Four actionable initiatives to optimize fleet revenue, platform leverage, and driver retention.</p>
      </div>
      <div class="neu-pill-teal" style="padding: 7px 18px; font-size: 12px;">Q4 2026 Operations Plan</div>
    </div>

    <div class="grid-2" style="flex: 1; align-items: stretch; gap: 0.3in;">
      <!-- Action 1 -->
      <div class="neu-card" style="padding: 24px 28px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="width: 34px; height: 34px; border-radius: 10px; background: #0B464E; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800;">1</div>
            <h3 style="font-size: 17px; font-weight: 800; color: #0B464E;">Activate the 27 Non-inDrive Assigned Cars</h3>
          </div>
          <p class="text-muted" style="font-size: 13px; line-height: 1.5; margin-bottom: 14px;">
            Out of 88 assigned vehicles, only 61 generated volume on inDrive. The remaining 27 cars operate solely via private rentals, street hail, or other apps.
          </p>
          <div class="neu-inset" style="padding: 12px 16px; font-size: 12px; color: #243444; line-height: 1.45;">
            <strong>Expected Impact:</strong> Enforcing inDrive installation and a minimum 30-ride monthly threshold on these 27 vehicles unlocks an additional <strong>+$8,000 to $12,000 USD</strong> in monthly fleet GMV (+35% expansion).
          </div>
        </div>
        <span class="neu-badge-teal" style="align-self: flex-start; margin-top: 10px;">Priority: HIGH · Fleet Ops</span>
      </div>

      <!-- Action 2 -->
      <div class="neu-card" style="padding: 24px 28px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="width: 34px; height: 34px; border-radius: 10px; background: #0B464E; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800;">2</div>
            <h3 style="font-size: 17px; font-weight: 800; color: #0B464E;">Incentivize the Casual Tier (&lt;50 rides)</h3>
          </div>
          <p class="text-muted" style="font-size: 13px; line-height: 1.5; margin-bottom: 14px;">
            21 drivers completed fewer than 50 rides in October. Moving this cohort from casual status into the 100-ride bracket represents the lowest-cost growth lever.
          </p>
          <div class="neu-inset" style="padding: 12px 16px; font-size: 12px; color: #243444; line-height: 1.45;">
            <strong>Incentive Scheme:</strong> Introduce a 150 MAD CRM weekly lease credit for any driver completing 25+ inDrive rides per week, ensuring higher car utilization and reduced lease arrears.
          </div>
        </div>
        <span class="neu-badge-green" style="align-self: flex-start; margin-top: 10px;">Priority: MEDIUM · CRM Retention</span>
      </div>

      <!-- Action 3 -->
      <div class="neu-card" style="padding: 24px 28px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="width: 34px; height: 34px; border-radius: 10px; background: #0B464E; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800;">3</div>
            <h3 style="font-size: 17px; font-weight: 800; color: #0B464E;">Commercial Commission Rebate Negotiation</h3>
          </div>
          <p class="text-muted" style="font-size: 13px; line-height: 1.5; margin-bottom: 14px;">
            GoCab delivered an exceptional 80.3% Delivery Rate (DR%) and 6,200+ monthly rides, making it one of inDrive's premier fleet partners in Morocco.
          </p>
          <div class="neu-inset" style="padding: 12px 16px; font-size: 12px; color: #243444; line-height: 1.45;">
            <strong>Negotiation Target:</strong> Leverage this track record with inDrive's Regional Partnership Team to secure a 2.0% fleet rebate or priority dispatch status for GoCab vehicle IDs.
          </div>
        </div>
        <span class="neu-badge-teal" style="align-self: flex-start; margin-top: 10px;">Priority: HIGH · Commercial / BizDev</span>
      </div>

      <!-- Action 4 -->
      <div class="neu-card" style="padding: 24px 28px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="width: 34px; height: 34px; border-radius: 10px; background: #0B464E; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800;">4</div>
            <h3 style="font-size: 17px; font-weight: 800; color: #0B464E;">Automate inDrive Data Sync into CRM</h3>
          </div>
          <p class="text-muted" style="font-size: 13px; line-height: 1.5; margin-bottom: 14px;">
            Replace manual spreadsheet exports with an automated pipeline syncing inDrive partner metrics directly into the GoCab CRM vehicle and driver drawers.
          </p>
          <div class="neu-inset" style="padding: 12px 16px; font-size: 12px; color: #243444; line-height: 1.45;">
            <strong>Risk Prevention:</strong> Early detection of drivers falling below 3 hours/day allows immediate field intervention before payment arrears accumulate.
          </div>
        </div>
        <span class="neu-badge-amber" style="align-self: flex-start; margin-top: 10px;">Priority: MEDIUM · Tech / Engineering</span>
      </div>
    </div>

    <div class="slide-footer">
      <span>GoCab Strategic Action Plan · Approved for Executive Review</span>
      <span>Slide 8 / 8</span>
    </div>
  </section>

</body>
</html>
`;

// Write HTML file to temp directory
const tempHtmlPath = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'gocab_presentation_deck.html');
const tempPdfPath = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'gocab_presentation_deck.pdf');

fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');
console.log('Wrote presentation HTML to:', tempHtmlPath);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const cmd = `"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${tempPdfPath}" "${tempHtmlPath}"`;

console.log('Running Chrome PDF generator command...');
execSync(cmd);

if (fs.existsSync(tempPdfPath)) {
  const stat = fs.statSync(tempPdfPath);
  console.log('Successfully generated PDF! Size:', stat.size, 'bytes');

  // Copy to destination paths
  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\4a835044-d1db-4c36-a40a-a23ba766abfb';
  const destArtifactPdf = path.join(artifactDir, 'GoCab_inDrive_Fleet_Performance_Presentation.pdf');
  const destArtifactHtml = path.join(artifactDir, 'GoCab_inDrive_Fleet_Performance_Presentation.html');
  const destWorkspacePdf = path.join(process.cwd(), 'GoCab_inDrive_Fleet_Performance_Presentation.pdf');

  fs.copyFileSync(tempPdfPath, destArtifactPdf);
  fs.copyFileSync(tempHtmlPath, destArtifactHtml);
  fs.copyFileSync(tempPdfPath, destWorkspacePdf);

  console.log('Copied PDF to Artifact:', destArtifactPdf);
  console.log('Copied HTML to Artifact:', destArtifactHtml);
  console.log('Copied PDF to Workspace:', destWorkspacePdf);
} else {
  throw new Error('PDF file was not created');
}
