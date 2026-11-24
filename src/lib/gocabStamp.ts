/**
 * Official GoCab Rent Blue Ink Rubber Stamp (Vector SVG) + Mouad Koudia Signature
 * Matches the physical stamp:
 *   [G Logo] GOCAB / RENT
 *   84, Rue Ibnou Mounir, N° 38 Centre
 *   Andaloucia, Maârif - Casablanca
 *   R.C: 707687 - ICE: 003833456000053
 */

import { MOUAD_SIGNATURE_DATA_URI } from "./mouadSignature";

export function getGocabStampSvg(widthPx = 220): string {
  const heightPx = Math.round(widthPx * 0.45);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 198" width="${widthPx}" height="${heightPx}" style="display:block;overflow:visible;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
  <defs>
    <!-- Subtle realistic stamp ink grain filter (keeps text crystal clear) -->
    <filter id="gocab-ink-texture" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" result="noise" />
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0.78" in="noise" result="alphaNoise" />
      <feComposite in="SourceGraphic" in2="alphaNoise" operator="in" />
    </filter>
  </defs>
  <g fill="#0A64B8" filter="url(#gocab-ink-texture)" opacity="0.93">
    <!-- Circular GoCab G Mark (left) -->
    <g transform="translate(26, 12)">
      <!-- Outer thick C/G ring opening on right -->
      <path d="M 56.5 22.5 A 32 32 0 1 0 56.5 67.5 L 47.5 58.5 A 19.5 19.5 0 1 1 47.5 31.5 Z" />
      <!-- Bottom-right G notch/serif -->
      <polygon points="56,68 67,56 67,72 51,72" />
      <!-- Center tilted diamond -->
      <polygon points="35,36 44,45 35,54 26,45" />
    </g>

    <!-- GOCAB + RENT wordmark -->
    <text x="116" y="64" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-weight="800" font-size="48" letter-spacing="5" fill="#0A64B8">GOCAB</text>
    <text x="272" y="88" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-weight="800" font-size="22" letter-spacing="3.5" fill="#0A64B8">RENT</text>

    <!-- 3 Address & Registration Lines -->
    <text x="220" y="122" text-anchor="middle" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-weight="600" font-size="18.5" letter-spacing="0.3" fill="#0A64B8">84, Rue Ibnou Mounir, N° 38 Centre</text>
    <text x="220" y="149" text-anchor="middle" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-weight="600" font-size="18.5" letter-spacing="0.3" fill="#0A64B8">Andaloucia, Maârif - Casablanca</text>
    <text x="220" y="177" text-anchor="middle" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-weight="700" font-size="17.5" letter-spacing="0.4" fill="#0A64B8">R.C: 707687 - ICE: 003833456000053</text>
  </g>
</svg>`;
}

export function getGocabStampHtml(widthPx = 205, rotateDeg = -2.5): string {
  const sigWidth = Math.round(widthPx * 0.56);
  return `<div style="display:inline-flex;flex-direction:column;align-items:center;pointer-events:none;user-select:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <img src="${MOUAD_SIGNATURE_DATA_URI}" alt="Signature" style="width:${sigWidth}px;height:auto;margin-bottom:-14px;transform:rotate(-1.5deg);mix-blend-mode:multiply;position:relative;z-index:2;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
    <div style="transform:rotate(${rotateDeg}deg);mix-blend-mode:multiply;position:relative;z-index:1;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      ${getGocabStampSvg(widthPx)}
    </div>
  </div>`;
}
