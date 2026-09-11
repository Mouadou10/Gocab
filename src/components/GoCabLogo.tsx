import React from "react";
import { GOCAB_LOGO_SRC } from "@/lib/logo-data";

export default function GoCabLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={GOCAB_LOGO_SRC}
      alt="GoCab Logo"
      className={`${className} object-contain`}
    />
  );
}
