import React from "react";

export default function GoCabLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {/* Navy Blue Arc */}
      <path
        d="M 60 10 
           A 40 40 0 0 0 20 50 
           A 40 40 0 0 0 26.65 72.11 
           L 41.5 57.26 
           A 18 18 0 0 1 38 50 
           A 22 22 0 0 1 60 28 
           A 22 22 0 0 1 82 50 
           H 100 
           A 40 40 0 0 0 60 10 Z"
        fill="#35588F"
      />
      {/* Olive Green Arc */}
      <path
        d="M 29.5 75 
           A 40 40 0 0 0 85.5 75 
           L 70.6 60.1 
           A 18 18 0 0 1 44.4 60.1 
           Z"
        fill="#5D6B2D"
      />
      {/* Olive Green Arrow / Block */}
      <polygon 
        points="65,50 95,50 95,75" 
        fill="#5D6B2D" 
      />
      {/* Center Diamond */}
      <polygon 
        points="45,50 55,40 65,50 55,60" 
        fill="#5D6B2D" 
      />
    </svg>
  );
}
