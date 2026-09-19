import React from 'react';

export default function IadjLogo({ size = 32, className = '' }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 100 100" 
      width={size} 
      height={size} 
      fill="none"
      className={`iadj-logo-svg ${className}`}
      style={{ verticalAlign: 'middle', flexShrink: 0 }}
    >
      <defs>
        {/* Gradiente Neón Principal (Verde Esmeralda -> Cian Eléctrico -> Púrpura) */}
        <linearGradient id="compIadjGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F5A0"/>
          <stop offset="50%" stopColor="#00D2FF"/>
          <stop offset="100%" stopColor="#A855F7"/>
        </linearGradient>

        {/* Gradiente Ondas de Sonido */}
        <linearGradient id="compWaveGradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#00D2FF"/>
          <stop offset="50%" stopColor="#00F5A0"/>
          <stop offset="100%" stopColor="#A855F7"/>
        </linearGradient>

        {/* Resplandor Neón */}
        <filter id="compNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#compNeonGlow)">
        {/* Borde exterior del disco / tornamesa */}
        <circle cx="50" cy="50" r="43" stroke="url(#compIadjGradient)" strokeWidth="4" strokeLinecap="round"/>

        {/* Surcos estilizados de vinilo DJ */}
        <circle cx="50" cy="50" r="34" stroke="url(#compIadjGradient)" strokeWidth="2" strokeDasharray="14 8 20 6" strokeLinecap="round" opacity="0.6"/>
        <circle cx="50" cy="50" r="26" stroke="#00D2FF" strokeWidth="1.5" strokeDasharray="6 5 10 5" strokeLinecap="round" opacity="0.45"/>

        {/* Brazo / Aguja DJ (Stylus) minimalista */}
        <g opacity="0.95">
          <circle cx="81" cy="20" r="3.5" stroke="#00D2FF" strokeWidth="2" fill="none"/>
          <circle cx="81" cy="20" r="1.5" fill="#00F5A0"/>
          <path d="M81 24 L81 37 L72 46" stroke="#00D2FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="69" y="44" width="5.5" height="3" rx="1.2" transform="rotate(-35 71 45)" fill="#00F5A0"/>
        </g>

        {/* Ondas de Sonido / Espectro de Audio (Izquierda) */}
        <rect x="15" y="44" width="3.5" height="12" rx="1.75" fill="#00D2FF" opacity="0.75"/>
        <rect x="21" y="37" width="3.5" height="26" rx="1.75" fill="#00F5A0" opacity="0.9"/>
        <rect x="27" y="30" width="3.5" height="40" rx="1.75" fill="url(#compWaveGradient)"/>
        <rect x="33" y="38" width="3.5" height="24" rx="1.75" fill="#00F5A0" opacity="0.85"/>

        {/* Ondas de Sonido / Espectro de Audio (Derecha) */}
        <rect x="63" y="38" width="3.5" height="24" rx="1.75" fill="#00D2FF" opacity="0.85"/>
        <rect x="69" y="30" width="3.5" height="40" rx="1.75" fill="url(#compWaveGradient)"/>
        <rect x="75" y="37" width="3.5" height="26" rx="1.75" fill="#A855F7" opacity="0.9"/>
        <rect x="81" y="44" width="3.5" height="12" rx="1.75" fill="#A855F7" opacity="0.75"/>

        {/* Aro Central del Vinilo (Sin Relleno) */}
        <circle cx="50" cy="50" r="13" stroke="url(#compIadjGradient)" strokeWidth="2.5" fill="none"/>

        {/* Destello Central de Inteligencia Artificial (AI Spark) */}
        <path d="M50 39 Q50 50 39 50 Q50 50 50 61 Q50 50 61 50 Q50 50 50 39 Z" fill="#00F5A0"/>
        <circle cx="50" cy="50" r="2.2" fill="#FFFFFF"/>
      </g>
    </svg>
  );
}
