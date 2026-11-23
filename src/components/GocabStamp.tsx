"use client";

import React from "react";

interface GocabStampProps {
  width?: number;
  rotateDeg?: number;
  className?: string;
}

export default function GocabStamp({
  width = 205,
  rotateDeg = -2.5,
  className = "",
}: GocabStampProps) {
  const height = Math.round(width * 0.45);
  return (
    <div
      className={`inline-block pointer-events-none select-none ${className}`}
      style={{
        transform: `rotate(${rotateDeg}deg)`,
        mixBlendMode: "multiply",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
      aria-label="Cachet officiel GoCab Rent"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 440 198"
        width={width}
        height={height}
        style={{
          display: "block",
          overflow: "visible",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <defs>
          <filter id="gocab-ink-texture-ui" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" result="noise" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0.78"
              in="noise"
              result="alphaNoise"
            />
            <feComposite in="SourceGraphic" in2="alphaNoise" operator="in" />
          </filter>
        </defs>
        <g fill="#0A64B8" filter="url(#gocab-ink-texture-ui)" opacity="0.93">
          {/* Circular GoCab G Mark (left) */}
          <g transform="translate(26, 12)">
            <path d="M 56.5 22.5 A 32 32 0 1 0 56.5 67.5 L 47.5 58.5 A 19.5 19.5 0 1 1 47.5 31.5 Z" />
            <polygon points="56,68 67,56 67,72 51,72" />
            <polygon points="35,36 44,45 35,54 26,45" />
          </g>

          {/* GOCAB + RENT wordmark */}
          <text
            x="116"
            y="64"
            fontFamily="'Segoe UI', Arial, Helvetica, sans-serif"
            fontWeight="800"
            fontSize="48"
            letterSpacing="5"
            fill="#0A64B8"
          >
            GOCAB
          </text>
          <text
            x="272"
            y="88"
            fontFamily="'Segoe UI', Arial, Helvetica, sans-serif"
            fontWeight="800"
            fontSize="22"
            letterSpacing="3.5"
            fill="#0A64B8"
          >
            RENT
          </text>

          {/* 3 Address & Registration Lines */}
          <text
            x="220"
            y="122"
            textAnchor="middle"
            fontFamily="'Segoe UI', Arial, Helvetica, sans-serif"
            fontWeight="600"
            fontSize="18.5"
            letterSpacing="0.3"
            fill="#0A64B8"
          >
            84, Rue Ibnou Mounir, N° 38 Centre
          </text>
          <text
            x="220"
            y="149"
            textAnchor="middle"
            fontFamily="'Segoe UI', Arial, Helvetica, sans-serif"
            fontWeight="600"
            fontSize="18.5"
            letterSpacing="0.3"
            fill="#0A64B8"
          >
            Andaloucia, Maârif - Casablanca
          </text>
          <text
            x="220"
            y="177"
            textAnchor="middle"
            fontFamily="'Segoe UI', Arial, Helvetica, sans-serif"
            fontWeight="700"
            fontSize="17.5"
            letterSpacing="0.4"
            fill="#0A64B8"
          >
            R.C: 707687 - ICE: 003833456000053
          </text>
        </g>
      </svg>
    </div>
  );
}
