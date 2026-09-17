import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import ToolHeader from './ui/ToolHeader';
import {
  isCodonDimmed as deriveCodonDimmed,
  isCodonHighlighted as deriveCodonHighlighted,
  normalizeCodonInput,
  resolveCodonGroup,
} from './CodonTable/lib/codonDomain';

// ─────────────────────────────────────────────────────────────────────────────
// CODON DATA — authoritative JSON mapping (RNA codons)
// type: 'start' | 'stop' | undefined
// ─────────────────────────────────────────────────────────────────────────────
const CODON_MAP = {
  // ── U (first base) ──────────────────────────────────────────────────
  UUU: { aa: 'Phe', full: 'Phenylalanine', abbr: 'F' },
  UUC: { aa: 'Phe', full: 'Phenylalanine', abbr: 'F' },
  UUA: { aa: 'Leu', full: 'Leucine',       abbr: 'L' },
  UUG: { aa: 'Leu', full: 'Leucine',       abbr: 'L' },
  UCU: { aa: 'Ser', full: 'Serine',        abbr: 'S' },
  UCC: { aa: 'Ser', full: 'Serine',        abbr: 'S' },
  UCA: { aa: 'Ser', full: 'Serine',        abbr: 'S' },
  UCG: { aa: 'Ser', full: 'Serine',        abbr: 'S' },
  UAU: { aa: 'Tyr', full: 'Tyrosine',      abbr: 'Y' },
  UAC: { aa: 'Tyr', full: 'Tyrosine',      abbr: 'Y' },
  UAA: { aa: 'Stop', full: 'Stop (Ochre)',  abbr: '*', type: 'stop' },
  UAG: { aa: 'Stop', full: 'Stop (Amber)',  abbr: '*', type: 'stop' },
  UGU: { aa: 'Cys', full: 'Cysteine',      abbr: 'C' },
  UGC: { aa: 'Cys', full: 'Cysteine',      abbr: 'C' },
  UGA: { aa: 'Stop', full: 'Stop (Opal)',   abbr: '*', type: 'stop' },
  UGG: { aa: 'Trp', full: 'Tryptophan',    abbr: 'W' },
  // ── C (first base) ──────────────────────────────────────────────────
  CUU: { aa: 'Leu', full: 'Leucine',       abbr: 'L' },
  CUC: { aa: 'Leu', full: 'Leucine',       abbr: 'L' },
  CUA: { aa: 'Leu', full: 'Leucine',       abbr: 'L' },
  CUG: { aa: 'Leu', full: 'Leucine',       abbr: 'L' },
  CCU: { aa: 'Pro', full: 'Proline',       abbr: 'P' },
  CCC: { aa: 'Pro', full: 'Proline',       abbr: 'P' },
  CCA: { aa: 'Pro', full: 'Proline',       abbr: 'P' },
  CCG: { aa: 'Pro', full: 'Proline',       abbr: 'P' },
  CAU: { aa: 'His', full: 'Histidine',     abbr: 'H' },
  CAC: { aa: 'His', full: 'Histidine',     abbr: 'H' },
  CAA: { aa: 'Gln', full: 'Glutamine',     abbr: 'Q' },
  CAG: { aa: 'Gln', full: 'Glutamine',     abbr: 'Q' },
  CGU: { aa: 'Arg', full: 'Arginine',      abbr: 'R' },
  CGC: { aa: 'Arg', full: 'Arginine',      abbr: 'R' },
  CGA: { aa: 'Arg', full: 'Arginine',      abbr: 'R' },
  CGG: { aa: 'Arg', full: 'Arginine',      abbr: 'R' },
  // ── A (first base) ──────────────────────────────────────────────────
  AUU: { aa: 'Ile', full: 'Isoleucine',    abbr: 'I' },
  AUC: { aa: 'Ile', full: 'Isoleucine',    abbr: 'I' },
  AUA: { aa: 'Ile', full: 'Isoleucine',    abbr: 'I' },
  AUG: { aa: 'Met', full: 'Methionine (Start)', abbr: 'M', type: 'start' },
  ACU: { aa: 'Thr', full: 'Threonine',     abbr: 'T' },
  ACC: { aa: 'Thr', full: 'Threonine',     abbr: 'T' },
  ACA: { aa: 'Thr', full: 'Threonine',     abbr: 'T' },
  ACG: { aa: 'Thr', full: 'Threonine',     abbr: 'T' },
  AAU: { aa: 'Asn', full: 'Asparagine',    abbr: 'N' },
  AAC: { aa: 'Asn', full: 'Asparagine',    abbr: 'N' },
  AAA: { aa: 'Lys', full: 'Lysine',        abbr: 'K' },
  AAG: { aa: 'Lys', full: 'Lysine',        abbr: 'K' },
  AGU: { aa: 'Ser', full: 'Serine',        abbr: 'S' },
  AGC: { aa: 'Ser', full: 'Serine',        abbr: 'S' },
  AGA: { aa: 'Arg', full: 'Arginine',      abbr: 'R' },
  AGG: { aa: 'Arg', full: 'Arginine',      abbr: 'R' },
  // ── G (first base) ──────────────────────────────────────────────────
  GUU: { aa: 'Val', full: 'Valine',        abbr: 'V' },
  GUC: { aa: 'Val', full: 'Valine',        abbr: 'V' },
  GUA: { aa: 'Val', full: 'Valine',        abbr: 'V' },
  GUG: { aa: 'Val', full: 'Valine',        abbr: 'V' },
  GCU: { aa: 'Ala', full: 'Alanine',       abbr: 'A' },
  GCC: { aa: 'Ala', full: 'Alanine',       abbr: 'A' },
  GCA: { aa: 'Ala', full: 'Alanine',       abbr: 'A' },
  GCG: { aa: 'Ala', full: 'Alanine',       abbr: 'A' },
  GAU: { aa: 'Asp', full: 'Aspartate',     abbr: 'D' },
  GAC: { aa: 'Asp', full: 'Aspartate',     abbr: 'D' },
  GAA: { aa: 'Glu', full: 'Glutamate',     abbr: 'E' },
  GAG: { aa: 'Glu', full: 'Glutamate',     abbr: 'E' },
  GGU: { aa: 'Gly', full: 'Glycine',       abbr: 'G' },
  GGC: { aa: 'Gly', full: 'Glycine',       abbr: 'G' },
  GGA: { aa: 'Gly', full: 'Glycine',       abbr: 'G' },
  GGG: { aa: 'Gly', full: 'Glycine',       abbr: 'G' },
};

// Standard biological layout: rows = first base, cols = second base, 3rd = row within cell
const BASES = ['U', 'C', 'A', 'G'];
const SECOND_BASES = ['U', 'C', 'A', 'G'];
const THIRD_BASES  = ['U', 'C', 'A', 'G'];

function getAminoName(t, data, codon) {
  if (!data) return t('tool-codon.ui.unknown');
  if (data.type === 'stop') return t(`tool-codon.ui.amino.${codon}`);
  if (data.type === 'start') return t('tool-codon.ui.amino.MetStart');
  return t(`tool-codon.ui.amino.${data.aa}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Amino acid colour palette — distinct hue per AA group
// ─────────────────────────────────────────────────────────────────────────────
// Hue families group the amino acids. The values are theme tokens from styles.css
// so each theme can clear 4.5:1 against its own card surface.
const AA_COLORS = {
  Phe: 'var(--aa-phe)', Leu: 'var(--aa-leu)', Ile: 'var(--aa-ile)', Met: null /* start */,
  Val: 'var(--aa-val)', Ser: 'var(--aa-ser)', Pro: 'var(--aa-pro)', Thr: 'var(--aa-thr)',
  Ala: 'var(--aa-ala)', Tyr: 'var(--aa-tyr)', His: 'var(--aa-his)', Gln: 'var(--aa-gln)',
  Asn: 'var(--aa-asn)', Lys: 'var(--aa-lys)', Asp: 'var(--aa-asp)', Glu: 'var(--aa-glu)',
  Cys: 'var(--aa-cys)', Trp: 'var(--aa-trp)', Arg: 'var(--aa-arg)', Gly: 'var(--aa-gly)',
  Stop: null /* stop */,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get CSS class modifier for a codon
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Ripple effect hook
// ─────────────────────────────────────────────────────────────────────────────
function useRipple() {
  const triggerRipple = useCallback((e) => {
    const btn = e.currentTarget;
    const existing = btn.querySelector('.ct-ripple');
    if (existing) existing.remove();

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x    = e.clientX - rect.left - size / 2;
    const y    = e.clientY - rect.top  - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ct-ripple';
    ripple.style.cssText = `
      position:absolute; border-radius:50%; pointer-events:none;
      width:${size}px; height:${size}px; left:${x}px; top:${y}px;
      background:rgba(255,255,255,0.25);
      transform:scale(0); animation:ct-ripple-anim 0.55s ease-out forwards;
    `;
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }, []);
  return triggerRipple;
}

// ─────────────────────────────────────────────────────────────────────────────
// CodonButton — one interactive codon element
// ─────────────────────────────────────────────────────────────────────────────
function CodonButton({ codon, isSelected, isHighlighted, isDimmed, onSelect }) {
  const { t } = useTranslation('tools');
  const data       = CODON_MAP[codon];
  const triggerRipple = useRipple();

  let cls = 'font-mono text-[0.68rem] sm:text-[0.86rem] font-semibold leading-none py-0 px-1 sm:px-1.5 rounded-md border border-transparent bg-transparent text-text-main cursor-pointer tracking-wide text-center transition-all duration-150 relative overflow-hidden w-full hover:bg-accent-light hover:border-accent hover:text-accent hover:scale-105 hover:z-[2] hover:shadow-[0_2px_8px_rgba(99,102,241,0.2)] active:scale-97';

  if (data?.type === 'start') {
    cls += ' text-emerald-600 font-bold hover:bg-emerald-500/15 hover:border-emerald-600 hover:text-emerald-600 hover:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]';
    if (isSelected) {
      cls += ' !bg-emerald-600 !border-emerald-600 !text-white shadow-[0_0_0_3px_rgba(22,163,74,0.15)]';
    } else if (isHighlighted) {
      cls += ' border-emerald-600 shadow-[0_0_10px_rgba(22,163,74,0.4)] bg-emerald-500/8';
    }
  } else if (data?.type === 'stop') {
    cls += ' text-red-600 font-bold hover:bg-red-500/12 hover:border-red-600 hover:text-red-600 hover:shadow-[0_0_0_3px_rgba(220,38,38,0.15)]';
    if (isSelected) {
      cls += ' !bg-red-600 !border-red-600 !text-white shadow-[0_0_0_3px_rgba(220,38,38,0.15)]';
    } else if (isHighlighted) {
      cls += ' border-red-600 shadow-[0_0_10px_rgba(220,38,38,0.4)] bg-red-500/8';
    }
  } else {
    if (isSelected) {
      cls += ' !bg-accent-fill !border-accent !text-accent-on-fill font-bold shadow-[0_0_0_3px_var(--focus-ring),0_2px_10px_rgba(99,102,241,0.35)] animate-[ct-pulse-glow_2s_ease-in-out_infinite]';
    } else if (isHighlighted) {
      cls += ' bg-accent-light border-accent text-accent';
    }
  }

  if (isDimmed) {
    cls += ' opacity-20 grayscale-[40%]';
  }

  const handleClick = (e) => {
    triggerRipple(e);
    onSelect(codon);
  };

  return (
    <button
      id={`codon-${codon}`}
      className={cls}
      style={isSelected ? {
        backgroundColor: data?.type === 'start' ? '#059669' : data?.type === 'stop' ? '#dc2626' : 'var(--accent)',
        borderColor: data?.type === 'start' ? '#059669' : data?.type === 'stop' ? '#dc2626' : 'var(--accent)',
        color: '#fff'
      } : undefined}
      onClick={handleClick}
      aria-label={t('tool-codon.ui.codonAria', { codon, amino: getAminoName(t, data, codon) })}
      aria-pressed={isSelected}
      title={t('tool-codon.ui.codonTitle', { codon, amino: getAminoName(t, data, codon), abbr: data?.abbr ?? '?' })}
    >
      <span className={isHighlighted ? 'font-extrabold' : ''}>{codon}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AminoAcidButton — the AA label inside each cell group
// ─────────────────────────────────────────────────────────────────────────────
function AminoAcidButton({ codon, isHighlighted, isDimmed, onSelect }) {
  const { t } = useTranslation('tools');
  const data = CODON_MAP[codon];
  const triggerRipple = useRipple();
  if (!data) return null;

  const aaColor = AA_COLORS[data.aa];
  let cls = 'font-sans text-[0.6rem] sm:text-[0.78rem] font-bold leading-none py-0 px-0.5 rounded-md border border-transparent bg-transparent cursor-pointer text-center whitespace-nowrap relative overflow-hidden w-full text-text-muted hover:bg-accent-light hover:border-accent hover:text-accent hover:scale-[1.06] hover:z-[2] active:scale-96';

  if (data.type === 'start') {
    cls += ' text-emerald-600 hover:bg-emerald-500/12 hover:border-emerald-600';
    if (isHighlighted) {
      cls += ' border-emerald-600 shadow-[0_0_10px_rgba(22,163,74,0.4)] bg-emerald-500/8';
    }
  } else if (data.type === 'stop') {
    cls += ' text-red-600 hover:bg-red-500/10 hover:border-red-600';
    if (isHighlighted) {
      cls += ' border-red-600 shadow-[0_0_10px_rgba(220,38,38,0.4)] bg-red-500/8';
    }
  } else {
    if (isHighlighted) {
      cls += ' bg-accent-light border-accent text-accent';
    }
  }

  if (isDimmed) {
    cls += ' opacity-20 grayscale-[40%]';
  }

  const inlineStyle = (aaColor && !isHighlighted && !isDimmed) ? { color: aaColor } : {};

  const handleClick = (e) => {
    triggerRipple(e);
    onSelect(codon);
  };

  const label = data.type === 'start'
    ? `${data.aa} ★`
    : data.type === 'stop'
    ? t('tool-codon.ui.stopLabel')
    : data.aa;

  return (
    <button
      id={`aa-${codon}`}
      className={cls}
      onClick={handleClick}
      style={inlineStyle}
      aria-label={t('tool-codon.ui.aminoAria', { code: data.aa, amino: getAminoName(t, data, codon) })}
      aria-pressed={isHighlighted}
      title={t('tool-codon.ui.aminoTitle', { amino: getAminoName(t, data, codon), abbr: data.abbr })}
    >
      {label}
    </button>
  );
}


// Fischer Projection Data for all 20 L-amino acids
const AMINO_ACID_DETAILS = {
  Phe: { sideChain: 'CH₂-C₆H₅', name: 'Benzyl', type: 'Hydrophobic, Aromatic' },
  Leu: { sideChain: 'CH₂-CH(CH₃)₂', name: 'Isobutyl', type: 'Hydrophobic, Aliphatic' },
  Ile: { sideChain: 'CH(CH₃)CH₂CH₃', name: 'sec-Butyl', type: 'Hydrophobic, Aliphatic' },
  Met: { sideChain: '(CH₂)₂-S-CH₃', name: 'Methylthioethyl', type: 'Hydrophobic, Sulfur-containing' },
  Val: { sideChain: 'CH(CH₃)₂', name: 'Isopropyl', type: 'Hydrophobic, Aliphatic' },
  Ser: { sideChain: 'CH₂-OH', name: 'Hydroxymethyl', type: 'Polar, Uncharged' },
  Pro: { sideChain: 'Cyclic (C₃H₆)', name: 'Pyrrolidine ring', type: 'Hydrophobic, Cyclic' },
  Thr: { sideChain: 'CH(OH)CH₃', name: '1-Hydroxyethyl', type: 'Polar, Uncharged' },
  Ala: { sideChain: 'CH₃', name: 'Methyl', type: 'Hydrophobic, Aliphatic' },
  Tyr: { sideChain: 'CH₂-C₆H₄-OH', name: 'p-Hydroxybenzyl', type: 'Polar, Aromatic' },
  His: { sideChain: 'CH₂-C₃H₃N₂', name: 'Imidazolemethyl', type: 'Basic, Positively Charged' },
  Gln: { sideChain: '(CH₂)₂-CO-NH₂', name: 'Carbamoylethyl', type: 'Polar, Uncharged' },
  Asn: { sideChain: 'CH₂-CO-NH₂', name: 'Carbamoylmethyl', type: 'Polar, Uncharged' },
  Lys: { sideChain: '(CH₂)₄-NH₂', name: '4-Aminobutyl', type: 'Basic, Positively Charged' },
  Asp: { sideChain: 'CH₂-COOH', name: 'Carboxymethyl', type: 'Acidic, Negatively Charged' },
  Glu: { sideChain: '(CH₂)₂-COOH', name: 'Carboxyethyl', type: 'Acidic, Negatively Charged' },
  Cys: { sideChain: 'CH₂-SH', name: 'Sulfhydrylmethyl', type: 'Polar, Sulfur-containing' },
  Trp: { sideChain: 'CH₂-C₈H₆N', name: 'Indolemethyl', type: 'Hydrophobic, Aromatic' },
  Arg: { sideChain: '(CH₂)₃-NH-C(=NH)NH₂', name: '3-Guanidinopropyl', type: 'Basic, Positively Charged' },
  Gly: { sideChain: 'H', name: 'Hydrogen atom', type: 'Non-polar, Achiral' }
};

// Fischer Projection heights for all 20 L-amino acids
const FISCHER_HEIGHTS = {
  Gly: 90,
  Ala: 90,
  Val: 110,
  Pro: 125,
  Cys: 120,
  Ser: 120,
  Thr: 120,
  Asp: 120,
  Leu: 145,
  Asn: 145,
  His: 145,
  Ile: 155,
  Phe: 155,
  Tyr: 170,
  Trp: 175,
  Glu: 155,
  Met: 180,
  Gln: 170,
  Lys: 210,
  Arg: 230,
};

function renderSideChain(aa) {
  switch (aa) {
    case 'Gly':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">H</text>
        </>
      );
    case 'Ala':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
        </>
      );
    case 'Val':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="73" y1="82" x2="67" y2="88" className="ct-fisc-side-bond" />
          <line x1="87" y1="82" x2="93" y2="88" className="ct-fisc-side-bond" />
          <text x="60" y="95" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <text x="100" y="95" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
        </>
      );
    case 'Leu':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="73" y1="112" x2="67" y2="118" className="ct-fisc-side-bond" />
          <line x1="87" y1="112" x2="93" y2="118" className="ct-fisc-side-bond" />
          <text x="60" y="125" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <text x="100" y="125" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
        </>
      );
    case 'Ile':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="90" y1="75" x2="100" y2="75" className="ct-fisc-side-bond" />
          <text x="110" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="115" x2="80" y2="125" className="ct-fisc-side-bond" />
          <text x="80" y="135" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
        </>
      );
    case 'Pro':
      return (
        <>
          <path d="M 83,55 L 92,83 L 60,107 L 28,83 L 37,55" fill="none" className="ct-fisc-side-bond" strokeWidth="2" strokeLinejoin="round" />
          <rect x="83" y="74" width="18" height="18" fill="var(--bg-card)" />
          <rect x="51" y="98" width="18" height="18" fill="var(--bg-card)" />
          <rect x="19" y="74" width="18" height="18" fill="var(--bg-card)" />
          <text x="92" y="83" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <text x="60" y="107" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <text x="28" y="83" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
        </>
      );
    case 'Phe':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <polygon points="80,95 97,105 97,125 80,135 63,125 63,105" fill="none" className="ct-fisc-side-bond" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="80" cy="115" r="11" fill="none" className="ct-fisc-side-bond" strokeWidth="1.5" strokeDasharray="3,2" />
        </>
      );
    case 'Tyr':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <polygon points="80,95 97,105 97,125 80,135 63,125 63,105" fill="none" className="ct-fisc-side-bond" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="80" cy="115" r="11" fill="none" className="ct-fisc-side-bond" strokeWidth="1.5" strokeDasharray="3,2" />
          <line x1="80" y1="135" x2="80" y2="145" className="ct-fisc-side-bond" />
          <text x="80" y="155" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">OH</text>
        </>
      );
    case 'Trp':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          {/* Pentagon (pyrrole ring, right) - proper regular pentagon like Pro */}
          <polygon points="80,95 97,110 90,130 66,130 60,110" fill="none" className="ct-fisc-side-bond" strokeWidth="2" strokeLinejoin="round" />
          {/* Double bond inside pentagon (C2=C3) */}
          <line x1="82" y1="99" x2="94" y2="111" className="ct-fisc-side-bond" strokeWidth="1.5" />
          {/* Hexagon (benzene ring, left) - regular hexagon sharing edge with pentagon */}
          <polygon points="60,110 40,105 26,120 32,140 52,145 66,130" fill="none" className="ct-fisc-side-bond" strokeWidth="2" strokeLinejoin="round" />
          {/* Aromatic circle inside hexagon */}
          <circle cx="46" cy="125" r="11" fill="none" className="ct-fisc-side-bond" strokeWidth="1.5" strokeDasharray="3,2" />
          {/* NH label at bottom-right vertex of pentagon */}
          <rect x="77" y="121" width="26" height="18" fill="var(--bg-card)" />
          <text x="90" y="130" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">NH</text>
        </>
      );
    case 'Met':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="115" x2="80" y2="125" className="ct-fisc-side-bond" />
          <text x="80" y="135" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">S</text>
          <line x1="80" y1="145" x2="80" y2="155" className="ct-fisc-side-bond" />
          <text x="80" y="165" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
        </>
      );
    case 'Cys':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">SH</text>
        </>
      );
    case 'Ser':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">OH</text>
        </>
      );
    case 'Thr':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="90" y1="75" x2="100" y2="75" className="ct-fisc-side-bond" />
          <text x="110" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">OH</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
        </>
      );
    case 'His':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <polygon points="80,95 99,109 92,131 68,131 61,109" fill="none" className="ct-fisc-side-bond" strokeWidth="2" strokeLinejoin="round" />
          <line x1="78" y1="98" x2="63" y2="110" className="ct-fisc-side-bond" strokeWidth="1.5" />
          <line x1="89" y1="128" x2="95" y2="110" className="ct-fisc-side-bond" strokeWidth="1.5" />
          <rect x="55" y="122" width="26" height="18" fill="var(--bg-card)" />
          <rect x="91" y="100" width="16" height="18" fill="var(--bg-card)" />
          <text x="68" y="131" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">NH</text>
          <text x="99" y="109" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">N</text>
        </>
      );
    case 'Lys':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="115" x2="80" y2="125" className="ct-fisc-side-bond" />
          <text x="80" y="135" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="145" x2="80" y2="155" className="ct-fisc-side-bond" />
          <text x="80" y="165" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="175" x2="80" y2="185" className="ct-fisc-side-bond" />
          <text x="80" y="195" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">⁺NH₃</text>
        </>
      );
    case 'Arg':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="115" x2="80" y2="125" className="ct-fisc-side-bond" />
          <text x="80" y="135" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="145" x2="80" y2="155" className="ct-fisc-side-bond" />
          <text x="80" y="165" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">NH</text>
          <line x1="80" y1="175" x2="80" y2="185" className="ct-fisc-side-bond" />
          <text x="80" y="195" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="73" y1="202" x2="67" y2="208" className="ct-fisc-side-bond" />
          <line x1="86" y1="201" x2="92" y2="207" className="ct-fisc-side-bond" />
          <line x1="88" y1="203" x2="94" y2="209" className="ct-fisc-side-bond" />
          <text x="60" y="215" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">H₂N</text>
          <text x="100" y="215" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">⁺NH₂</text>
        </>
      );
    case 'Asp':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">COO⁻</text>
        </>
      );
    case 'Asn':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="73" y1="112" x2="67" y2="118" className="ct-fisc-side-bond" />
          <line x1="86" y1="111" x2="92" y2="117" className="ct-fisc-side-bond" />
          <line x1="88" y1="113" x2="94" y2="119" className="ct-fisc-side-bond" />
          <text x="60" y="125" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">H₂N</text>
          <text x="100" y="125" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">O</text>
        </>
      );
    case 'Glu':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="115" x2="80" y2="125" className="ct-fisc-side-bond" />
          <text x="80" y="135" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">COO⁻</text>
        </>
      );
    case 'Gln':
      return (
        <>
          <line x1="80" y1="55" x2="80" y2="65" className="ct-fisc-side-bond" />
          <text x="80" y="75" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="85" x2="80" y2="95" className="ct-fisc-side-bond" />
          <text x="80" y="105" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="80" y1="115" x2="80" y2="125" className="ct-fisc-side-bond" />
          <text x="80" y="135" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">C</text>
          <line x1="73" y1="142" x2="67" y2="148" className="ct-fisc-side-bond" />
          <line x1="86" y1="141" x2="92" y2="147" className="ct-fisc-side-bond" />
          <line x1="88" y1="143" x2="94" y2="149" className="ct-fisc-side-bond" />
          <text x="60" y="155" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">H₂N</text>
          <text x="100" y="155" textAnchor="middle" dominantBaseline="central" className="ct-fisc-side">O</text>
        </>
      );
    default:
      return null;
  }
}

// Fischer Projection Widget Component
function FischerProjection({ aa, customGroups = [] }) {
  const { t } = useTranslation('tools');
  const details = AMINO_ACID_DETAILS[aa];
  if (!details) return null;

  const baseHeight = FISCHER_HEIGHTS[aa] || 135;
  const width = Math.round(160 * 1.2);
  const height = Math.round(baseHeight * 1.2);

  // Match standard group names
  const matchedStd = Object.entries(AA_GROUPS)
    .filter(([, grp]) => grp.aas.includes(aa))
    .map(([key]) => t(`tool-codon.ui.group.${key}`));

  // Match custom group names
  const matchedCustom = customGroups
    .filter(grp => grp.aas.includes(aa))
    .map(grp => grp.name);

  const allMatched = [...matchedStd, ...matchedCustom];
  const groupText = allMatched.length > 0 ? allMatched.join(', ') : t(`tool-codon.ui.groupType.${aa}`);

  return (
    <div className="flex flex-col gap-2.5 p-3.5 px-4 rounded-xl bg-app border border-border mt-1">
      <span className="text-[0.72rem] font-bold uppercase tracking-wider text-text-muted">{t('tool-codon.ui.fischer')}</span>
      <div className="flex flex-col items-center gap-3 w-full">
        <svg className="shrink-0 bg-card rounded-lg border border-border p-2" width={width} height={height} viewBox={`0 0 160 ${baseHeight}`}>
          {/* Main Backbone Bonds */}
          <line x1="50" y1="45" x2="70" y2="45" className="stroke-text-muted stroke-[2.4px] [stroke-linecap:round] opacity-85" />
          <line x1="90" y1="45" x2="110" y2="45" className="stroke-text-muted stroke-[2.4px] [stroke-linecap:round] opacity-85" />
          <line x1="80" y1="22" x2="80" y2="35" className="stroke-text-muted stroke-[2.4px] [stroke-linecap:round] opacity-85" />
          
          {/* Top Label: Carboxyl Group */}
          <text x="80" y="12" textAnchor="middle" dominantBaseline="central" className="font-mono text-[1.08rem] fill-text-muted font-bold fill-text-main text-[1.14rem]">COO⁻</text>
          
          {/* Left Label: Amino Group (or Imino for Proline) */}
          <text x="40" y="45" textAnchor="end" dominantBaseline="central" className="font-mono text-[1.08rem] fill-text-muted font-bold fill-text-main text-[1.14rem]">
            {aa === 'Pro' ? 'H₂N⁺' : 'H₃N⁺'}
          </text>

          {/* Right Label: Hydrogen */}
          <text x="120" y="45" textAnchor="start" dominantBaseline="central" className="font-mono text-[1.08rem] fill-text-muted">H</text>

          {/* Center Carbon */}
          <text x="80" y="45" textAnchor="middle" dominantBaseline="central" className="font-mono text-[1.14rem] font-bold fill-accent">C</text>

          {/* Side Chain R Group */}
          {renderSideChain(aa)}
        </svg>

        <div className="flex flex-col gap-1.5 w-full border-t border-dashed border-border pt-2.5">
          <div className="flex gap-2 items-center justify-center text-center">
            <span className="text-[0.68rem] uppercase tracking-wide text-text-muted font-bold">{t('tool-codon.ui.sideChain')}:</span>
            <span className="text-[0.82rem] font-semibold text-text-main">{t(`tool-codon.ui.sideChainName.${aa}`)}</span>
          </div>
          <div className="flex gap-2 items-center justify-center text-center">
            <span className="text-[0.68rem] uppercase tracking-wide text-text-muted font-bold">{t('tool-codon.ui.groupTypeLabel')}:</span>
            <span className="text-[0.82rem] font-semibold text-text-main">{groupText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Biochemical Group Mapping for Amino Acids
const AA_GROUPS = {
  hydrophobic: {
    name: 'Hydrophobic',
    class: 'grp-hydrophobic',
    aas: ['Phe', 'Leu', 'Ile', 'Met', 'Val', 'Pro', 'Ala', 'Trp', 'Gly']
  },
  polar: {
    name: 'Polar Uncharged',
    class: 'grp-polar',
    aas: ['Ser', 'Thr', 'Tyr', 'Gln', 'Asn', 'Cys']
  },
  basic: {
    name: 'Basic (+)',
    class: 'grp-basic',
    aas: ['His', 'Lys', 'Arg']
  },
  acidic: {
    name: 'Acidic (-)',
    class: 'grp-acidic',
    aas: ['Asp', 'Glu']
  },
  aliphatic: {
    name: 'Aliphatic R Groups',
    class: 'grp-aliphatic',
    aas: ['Gly', 'Ala', 'Val', 'Leu', 'Ile', 'Pro']
  },
  aromatic: {
    name: 'Aromatic R Groups',
    class: 'grp-aromatic',
    aas: ['Phe', 'Tyr', 'Trp']
  },
  sulfur: {
    name: 'Sulfur',
    class: 'grp-sulfur',
    aas: ['Met', 'Cys']
  },
  alcohol: {
    name: 'Alcohol',
    class: 'grp-alcohol',
    aas: ['Ser', 'Thr']
  },
  amide: {
    name: 'Amide Derivatives',
    class: 'grp-amide',
    aas: ['Asn', 'Gln']
  },
  nonpolar: {
    name: 'Non polar',
    class: 'grp-nonpolar',
    aas: ['Gly', 'Ala', 'Val', 'Leu', 'Ile', 'Phe', 'Trp', 'Pro', 'Met']
  }
};

function getAAGroupKey(aa) {
  for (const [key, group] of Object.entries(AA_GROUPS)) {
    if (group.aas.includes(aa)) return key;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// InfoPanel — detail card for selected codon
// ─────────────────────────────────────────────────────────────────────────────
function InfoPanel({
  typedCodon,
  selectedCodon,
  selectedGroup,
  setSelectedGroup,
  customGroups,
  highlightedAA,
  setHighlightedAA,
  isCreatingGroup,
  setIsCreatingGroup,
  newGroupName,
  setNewGroupName,
  newGroupAAs,
  setNewGroupAAs,
  newGroupColor,
  setNewGroupColor,
  onType,
  onClear,
  inputRef,
  handleDeleteCustomGroup,
  handleToggleAAInNewGroup,
  handleCreateCustomGroup,
  setSelectedCodon,
  panelRef
}) {
  const { t } = useTranslation('tools');
  const codon = selectedCodon || (typedCodon.length === 3 ? typedCodon : null);
  const data = codon ? CODON_MAP[codon] : null;
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const groupDropdownRef = useRef(null);

  const synonyms = data ? Object.keys(CODON_MAP).filter(
    c => CODON_MAP[c].aa === data.aa && c !== codon
  ) : [];

  const bgClass = data
    ? (data.type === 'start'
      ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/[0.06] to-card'
      : data.type === 'stop'
      ? 'border-red-500/50 bg-gradient-to-br from-red-500/[0.05] to-card'
      : '')
    : '';

  const handleCardClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const activeGroup = selectedGroup.startsWith('custom-')
    ? customGroups[parseInt(selectedGroup.split('-')[1], 10)]
    : AA_GROUPS[selectedGroup];

  const selectedGroupLabel = selectedGroup === 'all'
    ? t('tool-codon.ui.allGroups')
    : (selectedGroup.startsWith('custom-') ? activeGroup?.name : t(`tool-codon.ui.group.${selectedGroup}`)) || t('tool-codon.ui.allGroups');

  const selectGroup = (value) => {
    setSelectedGroup(value);
    setHighlightedAA(null);
    setSelectedCodon(null);
    setIsGroupDropdownOpen(false);
  };

  useEffect(() => {
    if (!isGroupDropdownOpen) return undefined;

    const closeDropdown = (event) => {
      if (!groupDropdownRef.current?.contains(event.target)) {
        setIsGroupDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', closeDropdown);
    return () => document.removeEventListener('mousedown', closeDropdown);
  }, [isGroupDropdownOpen]);

  return (
    <div className="contents">
      
      {/* ── Filter by Groups Block ────────────────── */}
      <div className="relative flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-card animate-[ct-panel-slide-in_0.25s_ease] lg:col-start-2 lg:row-start-1 xl:col-start-1">
        <span className="border-b border-border pb-1 text-[0.75rem] font-bold uppercase tracking-wider text-text-muted">{t('tool-codon.ui.filterByGroup')}</span>
        <div className="flex flex-col gap-2.5">
          
          <div className="flex w-full items-center gap-2">
            <div className="relative min-w-0 flex-1" ref={groupDropdownRef}>
              <button
                id="ct-group-selector"
                type="button"
                className={`flex h-8 w-full items-center justify-between gap-2 rounded-lg border bg-app px-2.5 text-left text-[0.8rem] font-medium text-text-main transition-all duration-150 hover:border-border-hover ${
                  isGroupDropdownOpen ? 'border-accent shadow-[0_0_0_2px_var(--focus-ring)]' : 'border-border'
                }`}
                onClick={() => setIsGroupDropdownOpen(prev => !prev)}
                aria-expanded={isGroupDropdownOpen}
                aria-haspopup="listbox"
                aria-controls="ct-group-options"
              >
                <span className="min-w-0 truncate">{selectedGroupLabel}</span>
                <svg className={`h-3 w-3 shrink-0 text-text-muted transition-transform duration-150 ${isGroupDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isGroupDropdownOpen && (
                <div id="ct-group-options" role="listbox" aria-label={t('tool-codon.ui.aminoGroupsAria')} className="absolute left-0 z-50 mt-2 flex max-h-64 w-full min-w-[190px] flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-[var(--bg-card-solid,var(--bg-card))] p-1 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.18)]">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedGroup === 'all'}
                    className={`w-full rounded-md px-2.5 py-1.5 text-left text-[0.78rem] font-medium transition-colors ${selectedGroup === 'all' ? 'bg-accent-light text-accent' : 'text-text-main hover:bg-app'}`}
                    onClick={() => selectGroup('all')}
                  >
                    {t('tool-codon.ui.allGroups')}
                  </button>

                  <div className="px-2.5 pt-1 text-[0.64rem] font-bold uppercase tracking-wider text-text-muted">{t('tool-codon.ui.standardGroups')}</div>
                  {Object.keys(AA_GROUPS).map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="option"
                      aria-selected={selectedGroup === key}
                      className={`w-full rounded-md px-2.5 py-1.5 text-left text-[0.78rem] font-medium transition-colors ${selectedGroup === key ? 'bg-accent-light text-accent' : 'text-text-main hover:bg-app'}`}
                      onClick={() => selectGroup(key)}
                    >
                      {t(`tool-codon.ui.group.${key}`)}
                    </button>
                  ))}

                  {customGroups.length > 0 && (
                    <>
                      <div className="mt-1 border-t border-border px-2.5 pt-2 text-[0.64rem] font-bold uppercase tracking-wider text-text-muted">{t('tool-codon.ui.customGroups')}</div>
                      {customGroups.map((grp, idx) => {
                        const value = `custom-${idx}`;
                        return (
                          <button
                            key={value}
                            type="button"
                            role="option"
                            aria-selected={selectedGroup === value}
                            className={`w-full rounded-md px-2.5 py-1.5 text-left text-[0.78rem] font-medium transition-colors ${selectedGroup === value ? 'bg-accent-light text-accent' : 'text-text-main hover:bg-app'}`}
                            onClick={() => selectGroup(value)}
                          >
                            {grp.name}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-1.5 shrink-0">
              {selectedGroup.startsWith('custom-') && (
                <button
                  type="button"
                  className="cursor-pointer whitespace-nowrap rounded-lg border border-border bg-white/3 px-2 py-1.5 text-[0.72rem] font-semibold text-text-main transition-all hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-500 active:scale-96"
                  onClick={() => handleDeleteCustomGroup(parseInt(selectedGroup.split('-')[1], 10))}
                  title={t('tool-codon.ui.deleteGroupTitle')}
                >
                  {t('tool-codon.ui.delete')}
                </button>
              )}
              <button
                type="button"
                className={`cursor-pointer whitespace-nowrap rounded-lg border border-border bg-white/3 px-2 py-1.5 text-[0.72rem] font-semibold text-text-main transition-all hover:border-text-muted hover:bg-white/8 active:scale-96 ${isCreatingGroup ? 'bg-accent-fill border-accent text-accent-on-fill shadow-[0_1px_6px_rgba(99, 102, 241, 0.25)]' : ''}`}
                onClick={() => setIsCreatingGroup(prev => !prev)}
              >
                {isCreatingGroup ? t('tool-codon.ui.close') : t('tool-codon.ui.addCustom')}
              </button>
            </div>
          </div>

          {/* Custom Group Creator Panel */}
          {isCreatingGroup && (
            <div className="flex flex-col gap-4 bg-white/2 border border-border rounded-lg p-4 mt-1 animate-[ct-fade-in_0.25s_ease-out]">
              <span className="text-[0.9rem] font-bold text-text-main uppercase tracking-wider border-b border-dashed border-border pb-2">{t('tool-codon.ui.createCustomGroup')}</span>
              <div className="flex flex-col gap-4">
                
                {/* Name Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.72rem] font-bold text-text-muted uppercase">{t('tool-codon.ui.groupName')}</label>
                  <input
                    type="text"
                    className="bg-black/20 border border-border rounded-lg p-2 px-3 text-text-main text-[0.85rem] outline-none focus:border-accent transition-colors"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder={t('tool-codon.ui.groupNamePlaceholder')}
                    maxLength={20}
                  />
                </div>

                {/* Color Picker */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.72rem] font-bold text-text-muted uppercase">{t('tool-codon.ui.labelColor')}</label>
                  <div className="flex gap-2.5 flex-wrap">
                    {[
                      '#d97706', '#e11d48', '#059669', '#4f46e5', '#ea580c', '#06b6d4', '#db2777'
                    ].map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`w-6 h-6 rounded-full border-2 border-transparent cursor-pointer transition-all hover:scale-115 ${newGroupColor === color ? 'border-white shadow-[0_0_8px_rgba(255, 255, 255, 0.5)] scale-110' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewGroupColor(color)}
                      />
                    ))}
                  </div>
                </div>

                {/* Amino Acid Selector Grid */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.72rem] font-bold text-text-muted uppercase">{t('tool-codon.ui.selectAminoAcids', { count: newGroupAAs.length })}</label>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-1.5">
                    {Object.keys(AMINO_ACID_DETAILS).map(aa => {
                      const isChosen = newGroupAAs.includes(aa);
                      const aaColor = AA_COLORS[aa] || 'var(--accent)';
                      const representativeCodon = Object.keys(CODON_MAP).find(c => CODON_MAP[c].aa === aa);
                      const oneLetter = representativeCodon ? (CODON_MAP[representativeCodon]?.abbr || '') : '';
                      return (
                        <button
                          key={aa}
                          type="button"
                          className="flex items-center justify-center gap-1 border border-border rounded-lg bg-white/1 p-1.5 cursor-pointer transition-all text-[0.75rem] hover:border-[var(--aa-color)] hover:bg-white/5 active:scale-96"
                          style={{
                            '--aa-color': aaColor,
                            borderColor: isChosen ? aaColor : 'var(--border-color)',
                            backgroundColor: isChosen ? `${aaColor}15` : 'transparent',
                            color: isChosen ? 'var(--text-main)' : 'var(--text-muted)'
                          }}
                          onClick={() => handleToggleAAInNewGroup(aa)}
                        >
                          <span className="font-bold" style={{ color: aaColor }}>{aa}</span>
                          <span className="text-[0.65rem] opacity-70">[{oneLetter}]</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 mt-2 border-t border-dashed border-border pt-3">
                  <button
                    type="button"
                    className="bg-accent-fill border border-accent text-accent-on-fill rounded-lg p-2 px-4 text-[0.8rem] font-semibold cursor-pointer transition-all hover:brightness-95 active:scale-96 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={handleCreateCustomGroup}
                    disabled={!newGroupName.trim() || newGroupAAs.length === 0}
                  >
                    {t('tool-codon.ui.saveGroup')}
                  </button>
                  <button
                    type="button"
                    className="bg-transparent border border-border text-text-muted rounded-lg p-2 px-4 text-[0.8rem] font-semibold cursor-pointer transition-all hover:bg-white/5 hover:text-text-main active:scale-96"
                    onClick={() => {
                      setIsCreatingGroup(false);
                      setNewGroupName('');
                      setNewGroupAAs([]);
                    }}
                  >
                    {t('tool-codon.ui.cancel')}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* AA chips in active group */}
          {selectedGroup !== 'all' && activeGroup && (
            <div className="flex flex-col gap-1.5 animate-[ct-fade-in_0.25s_ease-out]">
              <span className="text-[0.72rem] font-bold text-text-muted uppercase tracking-wider">{t('tool-codon.ui.aminoInGroup')}</span>
              <div className="flex flex-wrap gap-1.5">
                {activeGroup.aas.map(aa => {
                  const isSelected = highlightedAA === aa;
                  const aaColor = AA_COLORS[aa] || 'var(--accent)';
                  const firstCodon = Object.keys(CODON_MAP).find(c => CODON_MAP[c].aa === aa);
                  const oneLetter = firstCodon ? (CODON_MAP[firstCodon]?.abbr || '') : '';
                  return (
                    <button
                      key={aa}
                      className="inline-flex items-center gap-1.5 border border-border rounded-lg p-1.5 px-2.5 cursor-pointer transition-all font-semibold hover:scale-105 active:scale-96"
                      style={{
                        borderColor: isSelected ? aaColor : 'var(--border-color)',
                        color: isSelected ? '#ffffff' : 'var(--text-main)',
                        backgroundColor: isSelected ? aaColor : 'rgba(255, 255, 255, 0.03)'
                      }}
                      onClick={() => {
                        setHighlightedAA(prev => {
                          const next = prev === aa ? null : aa;
                          if (next) {
                            if (firstCodon) setSelectedCodon(firstCodon);
                          } else {
                            setSelectedCodon(null);
                            setSelectedGroup('all'); // Clear selection -> show all!
                          }
                          return next;
                        });
                      }}
                    >
                      <span>{aa}</span>
                      <span className="text-[0.68rem] opacity-80 font-normal">[{oneLetter}]</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Codon Lookup Block ────────────────── */}
      <div ref={panelRef} className={`relative flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-card animate-[ct-panel-slide-in_0.25s_ease] lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1 ${bgClass}`} role="status" aria-live="polite">
        
        {/* Hidden input for capturing keys */}
        <input
          ref={inputRef}
          type="text"
          className="absolute w-0 h-0 opacity-0 pointer-events-none"
          value={typedCodon}
          onChange={(e) => onType(e.target.value)}
          placeholder={t('tool-codon.ui.typeCodon')}
          aria-label={t('tool-codon.ui.typeCodonAria')}
        />

        {/* Header section */}
        <div className="flex min-h-[1.75rem] items-center justify-between pr-7">
          {data ? (
            <>
              <div className="flex items-center gap-2.5 flex-nowrap">
                <span className="text-[1.65rem] font-bold text-text-main tracking-tight">{getAminoName(t, data, codon)}</span>
                {data.aa !== 'Stop' && (
                  <div className="flex gap-1 flex-nowrap items-center shrink-0">
                    <span className="p-1 px-2.5 rounded-lg text-[0.95rem] font-bold bg-app border border-border text-text-main font-mono transition-all dark:bg-white/5">{data.aa}</span>
                    <span className="p-1 px-2.5 rounded-lg text-[0.95rem] font-bold bg-app border border-border text-text-main font-mono transition-all dark:bg-white/5">{data.abbr}</span>
                  </div>
                )}
                {data.type === 'start' && <span className="p-1 px-2.5 rounded-full text-[0.72rem] font-semibold border border-emerald-500/20 text-emerald-600 bg-emerald-500/10">{t('tool-codon.ui.start')}</span>}
                {data.type === 'stop'  && <span className="p-1 px-2.5 rounded-full text-[0.72rem] font-semibold border border-red-500/20 text-red-600 bg-red-500/[0.08]">{t('tool-codon.ui.stop')}</span>}
              </div>
              <button className="absolute top-3 right-3 w-5 h-5 rounded-full border border-border bg-app text-text-muted cursor-pointer text-[0.58rem] flex items-center justify-center transition-all hover:bg-accent-fill hover:text-accent-on-fill hover:border-accent" onClick={onClear} aria-label={t('tool-codon.ui.clearSelection')}>✕</button>
            </>
          ) : (
            <>
              <span className="text-xl font-bold tracking-tight text-text-main">{t('tool-codon.ui.lookup')}</span>
              {typedCodon.length > 0 && (
                <button className="absolute top-3 right-3 w-5 h-5 rounded-full border border-border bg-app text-text-muted cursor-pointer text-[0.58rem] flex items-center justify-center transition-all hover:bg-accent-fill hover:text-accent-on-fill hover:border-accent" onClick={onClear} aria-label={t('tool-codon.ui.clearTyping')}>✕</button>
              )}
            </>
          )}
        </div>

        {/* The 3 passcode typing cards */}
        <div className="my-2 flex w-full justify-center gap-2.5">
          {[t('tool-codon.ui.firstShort'), t('tool-codon.ui.secondShort'), t('tool-codon.ui.thirdShort')].map((posName, idx) => {
            const char = typedCodon[idx] || '';
            const isActive = typedCodon.length === idx;
            const charColorClass = char === 'U' ? 'text-purple-700 dark:text-purple-300' : char === 'C' ? 'text-sky-700 dark:text-sky-300' : char === 'A' ? 'text-amber-700 dark:text-amber-300' : char === 'G' ? 'text-emerald-700 dark:text-emerald-300' : '';
            return (
              <div
                key={idx}
                className={`flex h-[68px] min-w-0 max-w-[96px] flex-1 cursor-pointer select-none flex-col items-center justify-center rounded-xl border-2 border-border bg-white/[0.02] transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-white/[0.05] ${isActive ? 'border-accent bg-accent/5 shadow-[0_0_10px_rgba(99,102,241,0.25)] animate-[ct-card-pulse_2s_infinite_ease-in-out]' : ''}`}
                onClick={handleCardClick}
                title={t('tool-codon.ui.clickToType')}
              >
                <span className="text-[0.65rem] font-bold text-text-muted mb-1 tracking-wider">{posName}</span>
                <span className={`flex h-6 items-center justify-center font-mono text-2xl font-bold leading-none ${charColorClass}`}>
                  {char || '—'}
                  {isActive && <span className="inline-block w-[2px] h-[1.8rem] bg-accent ml-0.5 animate-[ct-blink-anim_1s_step-end_infinite]"></span>}
                </span>
              </div>
            );
          })}
        </div>

        {/* Display result/prompt depending on state */}
        {data ? (
          <div className="flex flex-col gap-4">
            {/* Synonymous codons */}
            {synonyms.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[0.78rem] font-bold uppercase tracking-wider text-text-muted">{t('tool-codon.ui.synonymous')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {synonyms.map(s => (
                    <span key={s} className="font-mono text-[0.85rem] p-1 px-2.5 rounded-lg bg-app border border-border text-text-muted">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Fischer Projection */}
            {data.aa !== 'Stop' && (
              <FischerProjection aa={data.aa} customGroups={customGroups} />
            )}
          </div>
        ) : (
          <div className="flex min-h-[48px] items-center justify-center rounded-lg border border-dashed border-border bg-white/[0.01] p-2 text-center">
            {typedCodon.length > 0 ? (
              <span className="text-accent text-[0.85rem] font-semibold">
                {t('tool-codon.ui.moreBases', { count: 3 - typedCodon.length })}
              </span>
            ) : (
              <span className="text-text-muted text-[0.85rem] italic">
                {t('tool-codon.ui.lookupPrompt')}
              </span>
            )}
          </div>
        )}

      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CodonTable component
// ─────────────────────────────────────────────────────────────────────────────
export default function CodonTable() {
  const { t } = useTranslation('tools');
  const [selectedCodon,    setSelectedCodon]    = useState(null);
  const [highlightedAA,    setHighlightedAA]    = useState(null);
  const [typedCodon,       setTypedCodon]       = useState('');
  const [selectedGroup,    setSelectedGroup]    = useState('all'); // 'all' | 'hydrophobic' | 'polar' | 'basic' | 'acidic' ...
  const [customGroups,     setCustomGroups]     = useState(() => {
    try {
      const saved = localStorage.getItem('ct-custom-groups');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCreatingGroup,  setIsCreatingGroup]  = useState(false);
  const [newGroupName,     setNewGroupName]     = useState('');
  const [newGroupAAs,      setNewGroupAAs]      = useState([]);
  const [newGroupColor,    setNewGroupColor]    = useState('#d97706'); // Default gold

  const panelRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll panel into view when codon selected
  useEffect(() => {
    if (selectedCodon && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedCodon]);

  // Sync selectedCodon to typedCodon
  useEffect(() => {
    if (selectedCodon) {
      setTypedCodon(selectedCodon);
    } else {
      // Don't clear typedCodon if it's partially typed (we want to let the user keep typing)
      if (typedCodon.length === 3) {
        setTypedCodon('');
      }
    }
  }, [selectedCodon, typedCodon.length]);

  // Persist custom groups
  useEffect(() => {
    localStorage.setItem('ct-custom-groups', JSON.stringify(customGroups));
  }, [customGroups]);

  const handleSelectCodon = useCallback((codon) => {
    const data = CODON_MAP[codon];
    if (!data) return;

    setSelectedCodon(prev => {
      const isSame = prev === codon;
      if (isSame) {
        // Deselecting: clear highlighted amino acid and reset group filter to show all
        setHighlightedAA(null);
        setSelectedGroup('all');
        return null;
      } else {
        // Selecting: highlight amino acid and show its corresponding biochemical group
        setHighlightedAA(data.aa);
        const grpKey = getAAGroupKey(data.aa);
        if (grpKey) {
          setSelectedGroup(grpKey);
        }
        return codon;
      }
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedCodon(null);
    setHighlightedAA(null);
    setTypedCodon('');
  }, []);

  const handleTypeCodon = (val) => {
    const sanitized = normalizeCodonInput(val);
    setTypedCodon(sanitized);

    if (sanitized.length === 3) {
      if (CODON_MAP[sanitized]) {
        setSelectedCodon(sanitized);
        setHighlightedAA(CODON_MAP[sanitized].aa);
        const grpKey = getAAGroupKey(CODON_MAP[sanitized].aa);
        if (grpKey) setSelectedGroup(grpKey);
      }
    } else {
      setSelectedCodon(null);
      setHighlightedAA(null);
    }
  };

  const handleToggleAAInNewGroup = (aa) => {
    setNewGroupAAs(prev => 
      prev.includes(aa) ? prev.filter(item => item !== aa) : [...prev, aa]
    );
  };

  const handleCreateCustomGroup = () => {
    if (!newGroupName.trim() || newGroupAAs.length === 0) return;
    const newGroup = {
      name: newGroupName.trim(),
      color: newGroupColor,
      aas: newGroupAAs
    };
    setCustomGroups(prev => [...prev, newGroup]);
    setSelectedGroup(`custom-${customGroups.length}`);
    // Clear and close
    setNewGroupName('');
    setNewGroupAAs([]);
    setIsCreatingGroup(false);
  };

  const handleDeleteCustomGroup = (indexToDelete) => {
    setCustomGroups(prev => prev.filter((_, idx) => idx !== indexToDelete));
    if (selectedGroup === `custom-${indexToDelete}`) {
      setSelectedGroup('all');
      setHighlightedAA(null);
    } else if (selectedGroup.startsWith('custom-')) {
      const activeIdx = parseInt(selectedGroup.split('-')[1], 10);
      if (activeIdx > indexToDelete) {
        setSelectedGroup(`custom-${activeIdx - 1}`);
      } else if (activeIdx === indexToDelete) {
        setSelectedGroup('all');
        setHighlightedAA(null);
      }
    }
  };

  const isCodonHighlighted = useCallback((codon) => {
    const data = CODON_MAP[codon];
    return deriveCodonHighlighted({
      codon,
      data,
      selectedCodon,
      typedCodon,
      highlightedAA,
      activeGroup: resolveCodonGroup(selectedGroup, customGroups, AA_GROUPS),
    });
  }, [highlightedAA, selectedCodon, typedCodon, selectedGroup, customGroups]);

  const isCodonDimmed = useCallback((codon) => {
    const data = CODON_MAP[codon];
    return deriveCodonDimmed({
      codon,
      data,
      selectedCodon,
      typedCodon,
      highlightedAA,
      activeGroup: resolveCodonGroup(selectedGroup, customGroups, AA_GROUPS),
    });
  }, [selectedCodon, highlightedAA, selectedGroup, typedCodon, customGroups]);

  return (
    <Card variant="tool" size="wide" id="tool-codon" className="active mx-auto w-full max-w-full font-sans">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5 w-full">
        <ToolHeader title={t('tool-codon.ui.title')} />
        <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs text-text-muted bg-app/50 border border-border px-3 py-2 rounded-lg">
          <p className="leading-relaxed">
            <strong className="text-text-main">{t('tool-codon.ui.standardCode')}</strong>: {t('tool-codon.ui.codeDescription')}
            <span className="ml-1">{t('tool-codon.ui.startDescription')} <em>{t('tool-codon.ui.codeNote')}</em></span>
          </p>
        </div>

      </div>

      {/* ── Workspace: Table + Details Side-by-Side ────────────────── */}
      <div className="grid w-full grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)] xl:grid-cols-[minmax(180px,0.62fr)_minmax(640px,1.85fr)_minmax(280px,0.9fr)]">
        <div className="w-full min-w-0 max-w-full lg:row-span-2 xl:col-start-2 xl:row-span-1 xl:row-start-1">
          {/* ── Axis Labels + Grid ────────────────────────────────────── */}
          <div className="grid grid-cols-[22px_1fr_22px] grid-rows-[24px_auto] items-stretch gap-0 overflow-hidden rounded-xl border border-border bg-card shadow-card sm:grid-cols-[26px_1fr_26px] sm:grid-rows-[26px_auto]">

            {/* Left axis: "First Codon" vertical label */}
            <div className="col-start-1 row-start-1 row-end-3 [writing-mode:vertical-rl] bg-gradient-to-b from-accent/8 to-accent/4 border-r border-border flex items-center justify-center rotate-180" aria-label={t('tool-codon.ui.firstPositionAria')}>
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-accent whitespace-nowrap">{t('tool-codon.ui.firstCodon')}</span>
            </div>

            {/* Top axis: "Second Codon" horizontal label */}
            <div className="col-start-2 row-start-1 bg-gradient-to-r from-accent/8 to-accent/4 border-b border-border flex items-center justify-center" aria-label={t('tool-codon.ui.secondPositionAria')}>
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-accent whitespace-nowrap">{t('tool-codon.ui.secondCodon')}</span>
            </div>

            {/* Right axis: "Third Codon" vertical label */}
            <div className="col-start-3 row-start-1 row-end-3 [writing-mode:vertical-rl] bg-gradient-to-b from-accent/8 to-accent/4 border-l border-border flex items-center justify-center" aria-label={t('tool-codon.ui.thirdPositionAria')}>
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-accent whitespace-nowrap">{t('tool-codon.ui.thirdCodon')}</span>
            </div>

            {/* Inner: top axis + table */}
            <div className="col-start-2 row-start-2 flex flex-col">

              {/* Top axis: Second Base */}
              <div className="grid grid-cols-[28px_repeat(4,1fr)_36px] border-b border-border bg-app" aria-hidden="true">
                <div className="ct-axis-corner"></div>
                {SECOND_BASES.map(b2 => {
                  const colorClass = b2 === 'U' ? 'text-purple-700 dark:text-purple-300' : b2 === 'C' ? 'text-sky-700 dark:text-sky-300' : b2 === 'A' ? 'text-amber-700 dark:text-amber-300' : b2 === 'G' ? 'text-emerald-700 dark:text-emerald-300' : '';
                  return (
                    <div key={b2} className="flex flex-col items-center justify-center border-l border-border px-0.5 py-1">
                      <span className={`font-mono text-base font-bold ${colorClass}`}>{b2}</span>
                    </div>
                  );
                })}
                <div className="ct-axis-corner"></div>
              </div>

              {/* Main table body */}
              <div className="flex flex-col relative">


                {BASES.map(b1 => {
                  const b1ColorClass = b1 === 'U' ? 'text-purple-700 dark:text-purple-300' : b1 === 'C' ? 'text-sky-700 dark:text-sky-300' : b1 === 'A' ? 'text-amber-700 dark:text-amber-300' : b1 === 'G' ? 'text-emerald-700 dark:text-emerald-300' : '';
                  const b1BgHeaderClass = b1 === 'U' ? 'bg-purple-500/10' : b1 === 'C' ? 'bg-sky-500/10' : b1 === 'A' ? 'bg-amber-500/10' : b1 === 'G' ? 'bg-emerald-500/10' : '';
                  return (
                    <div key={b1} className="grid grid-cols-[28px_1fr_36px] border-t border-border first:border-t-0">

                      {/* Left row header: first base letter */}
                      <div className={`flex items-center justify-center border-r border-border p-0.5 font-mono text-base font-bold ${b1ColorClass} ${b1BgHeaderClass}`} aria-hidden="true">
                        <span>{b1}</span>
                      </div>

                      {/* 4 columns (second base) × 4 rows (third base) */}
                      <div className="grid grid-cols-4">
                        {SECOND_BASES.map(b2 => {
                          const cellCodons = THIRD_BASES.map(b3 => `${b1}${b2}${b3}`);
                          const cellB2Bg = b2 === 'U' ? 'bg-purple-500/[0.04]' : b2 === 'C' ? 'bg-sky-500/[0.04]' : b2 === 'A' ? 'bg-amber-500/[0.04]' : b2 === 'G' ? 'bg-emerald-500/[0.04]' : '';
                          // Find the group of consecutive identical AAs to render a shared label
                          const aaGroups = [];
                          cellCodons.forEach((codon, idx) => {
                            const aa = CODON_MAP[codon]?.aa;
                            const last = aaGroups[aaGroups.length - 1];
                            if (last && last.aa === aa && CODON_MAP[codon]?.type === last.type) {
                              last.codons.push(codon);
                            } else {
                              aaGroups.push({ aa, type: CODON_MAP[codon]?.type, codons: [codon], startIdx: idx });
                            }
                          });

                          return (
                            <div key={b2} className={`relative grid grid-rows-4 border-l border-border pr-10 sm:pr-14 ${cellB2Bg}`} role="group" aria-label={t('tool-codon.ui.codonGroupAria', { prefix: `${b1}${b2}` })}>
                              {cellCodons.map((codon) => {
                                return (
                                  <div
                                    key={codon}
                                    className="flex min-h-[24px] items-center border-b border-border/50 px-0.5 transition-all duration-150 last:border-b-0 sm:min-h-[27px] [@media(max-height:760px)]:!min-h-[22px]"
                                  >
                                    <CodonButton
                                      codon={codon}
                                      isSelected={selectedCodon === codon}
                                      isHighlighted={isCodonHighlighted(codon)}
                                      isDimmed={isCodonDimmed(codon)}
                                      onSelect={handleSelectCodon}
                                    />
                                  </div>
                                );
                              })}

                              {/* AA labels — one per consecutive group, vertically centered */}
                              <div className="absolute bottom-0 right-0 top-0 grid w-10 grid-rows-4 border-l border-border bg-card sm:w-14" aria-label={t('tool-codon.ui.aminoForAria', { prefix: `${b1}${b2}` })}>
                                {aaGroups.map((group, gi) => (
                                  <div
                                    key={gi}
                                    className="flex items-center justify-center p-px"
                                    style={{ gridRow: `${group.startIdx + 1} / span ${group.codons.length}` }}
                                  >
                                    <AminoAcidButton
                                      codon={group.codons[0]}
                                      isHighlighted={isCodonHighlighted(group.codons[0])}
                                      isDimmed={isCodonDimmed(group.codons[0])}
                                      onSelect={handleSelectCodon}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Repeating right axis per row group: U C A G */}
                      <div className="grid grid-rows-4 border-l border-border">
                        {THIRD_BASES.map(b3 => {
                          const b3ColorClass = b3 === 'U' ? 'text-purple-700 dark:text-purple-300' : b3 === 'C' ? 'text-sky-700 dark:text-sky-300' : b3 === 'A' ? 'text-amber-700 dark:text-amber-300' : b3 === 'G' ? 'text-emerald-700 dark:text-emerald-300' : '';
                          return (
                            <div key={b3} className={`flex items-center justify-center border-b border-border p-0 font-mono text-[0.8rem] font-bold last:border-b-0 ${b3ColorClass}`}>
                              <span>{b3}</span>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}

              </div>

              {/* Bottom axis: Second Base (repeated) */}
              <div className="grid grid-cols-[28px_repeat(4,1fr)_36px] border-t border-border bg-app" aria-hidden="true">
                <div className="ct-axis-corner"></div>
                {SECOND_BASES.map(b2 => {
                  const b2ColorClass = b2 === 'U' ? 'text-purple-700 dark:text-purple-300' : b2 === 'C' ? 'text-sky-700 dark:text-sky-300' : b2 === 'A' ? 'text-amber-700 dark:text-amber-300' : b2 === 'G' ? 'text-emerald-700 dark:text-emerald-300' : '';
                  return (
                    <div key={b2} className="flex flex-col items-center justify-center border-l border-border px-0.5 py-1">
                      <span className={`font-mono text-base font-bold ${b2ColorClass}`}>{b2}</span>
                    </div>
                  );
                })}
                <div className="ct-axis-corner"></div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Group Filter + Codon Lookup ───────────────────────────── */}
        <InfoPanel
          typedCodon={typedCodon}
          selectedCodon={selectedCodon}
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
          customGroups={customGroups}
          highlightedAA={highlightedAA}
          setHighlightedAA={setHighlightedAA}
          isCreatingGroup={isCreatingGroup}
          setIsCreatingGroup={setIsCreatingGroup}
          newGroupName={newGroupName}
          setNewGroupName={setNewGroupName}
          newGroupAAs={newGroupAAs}
          setNewGroupAAs={setNewGroupAAs}
          newGroupColor={newGroupColor}
          setNewGroupColor={setNewGroupColor}
          onType={handleTypeCodon}
          onClear={handleClearSelection}
          inputRef={inputRef}
          handleDeleteCustomGroup={handleDeleteCustomGroup}
          handleToggleAAInNewGroup={handleToggleAAInNewGroup}
          handleCreateCustomGroup={handleCreateCustomGroup}
          setSelectedCodon={setSelectedCodon}
          panelRef={panelRef}
        />
      </div>

    </Card>
  );
}
