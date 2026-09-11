import React from "react";

export default function GoCabLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="GoCab Logo"
      className={`${className} object-contain`}
    />
  );
}
