import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import ToolHeader from './ui/ToolHeader';

const dnaComplementMap = {
  'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C',
  'a': 't', 't': 'a', 'c': 'g', 'g': 'c',
  'U': 'A', 'u': 'a',
  'R': 'Y', 'Y': 'R', 'S': 'S', 'W': 'W', 'K': 'M', 'M': 'K',
  'B': 'V', 'V': 'B', 'D': 'H', 'H': 'D', 'N': 'N',
  'r': 'y', 'y': 'r', 's': 's', 'w': 'w', 'k': 'm', 'm': 'k',
  'b': 'v', 'v': 'b', 'd': 'h', 'h': 'd', 'n': 'n'
};

const rnaComplementMap = {
  'A': 'U', 'U': 'A', 'C': 'G', 'G': 'C',
  'a': 'u', 'u': 'a',
  'T': 'A', 't': 'a',
  'R': 'Y', 'Y': 'R', 'S': 'S', 'W': 'W', 'K': 'M', 'M': 'K',
  'B': 'V', 'V': 'B', 'D': 'H', 'H': 'D', 'N': 'N',
  'r': 'y', 'y': 'r', 's': 's', 'w': 'w', 'k': 'm', 'm': 'k',
  'b': 'v', 'v': 'b', 'd': 'h', 'h': 'd', 'n': 'n'
};

const baseColors = {
  'A': '#10b981', // green
  'T': '#ef4444', // red
  'U': '#ec4899', // purple/pink
  'C': '#f59e0b', // orange
  'G': '#3b82f6', // blue
  'N': '#9ca3af'  // grey
};

const getComplement = (sequence, isRna) => {
  const map = isRna ? rnaComplementMap : dnaComplementMap;
  return sequence.split("").map(char => map[char] || char).join("");
};

const reverseString = (str) => {
  return str.split("").reverse().join("");
};

const codonTable = {
  // Phenylalanine
  'TTT': 'Phe', 'TTC': 'Phe', 'UUU': 'Phe', 'UUC': 'Phe',
  // Leucine
  'TTA': 'Leu', 'TTG': 'Leu', 'UUA': 'Leu', 'UUG': 'Leu',
  'CTT': 'Leu', 'CTC': 'Leu', 'CTA': 'Leu', 'CTG': 'Leu',
  'CUU': 'Leu', 'CUC': 'Leu', 'CUA': 'Leu', 'CUG': 'Leu',
  // Isoleucine
  'ATT': 'Ile', 'ATC': 'Ile', 'ATA': 'Ile',
  'AUU': 'Ile', 'AUC': 'Ile', 'AUA': 'Ile',
  // Methionine
  'ATG': 'Met', 'AUG': 'Met',
  // Valine
  'GTT': 'Val', 'GTC': 'Val', 'GTA': 'Val', 'GTG': 'Val',
  'GUU': 'Val', 'GUC': 'Val', 'GUA': 'Val', 'GUG': 'Val',
  // Serine
  'TCT': 'Ser', 'TCC': 'Ser', 'TCA': 'Ser', 'TCG': 'Ser',
  'UCU': 'Ser', 'UCC': 'Ser', 'UCA': 'Ser', 'UCG': 'Ser',
  'AGU': 'Ser', 'AGC': 'Ser',
  // Proline
  'CCT': 'Pro', 'CCC': 'Pro', 'CCA': 'Pro', 'CCG': 'Pro',
  'CCU': 'Pro',
  // Threonine
  'ACT': 'Thr', 'ACC': 'Thr', 'ACA': 'Thr', 'ACG': 'Thr',
  'ACU': 'Thr',
  // Alanine
  'GCT': 'Ala', 'GCC': 'Ala', 'GCA': 'Ala', 'GCG': 'Ala',
  'GCU': 'Ala',
  // Tyrosine
  'TAT': 'Tyr', 'TAC': 'Tyr', 'UAU': 'Tyr', 'UAC': 'Tyr',
  // Stop
  'TAA': 'Stop', 'TAG': 'Stop', 'TGA': 'Stop',
  'UAA': 'Stop', 'UAG': 'Stop', 'UGA': 'Stop',
  // Histidine
  'CAT': 'His', 'CAC': 'His', 'CAU': 'His',
  // Glutamine
  'CAA': 'Gln', 'CAG': 'Gln',
  // Asparagine
  'AAT': 'Asn', 'AAC': 'Asn', 'AAU': 'Asn',
  // Lysine
  'AAA': 'Lys', 'AAG': 'Lys',
  // Aspartic Acid
  'GAT': 'Asp', 'GAC': 'Asp', 'GAU': 'Asp',
  // Glutamic Acid
  'GAA': 'Glu', 'GAG': 'Glu',
  // Cysteine
  'TGT': 'Cys', 'TGC': 'Cys', 'UGU': 'Cys', 'UGC': 'Cys',
  // Tryptophan
  'TGG': 'Trp', 'UGG': 'Trp',
  // Arginine
  'CGT': 'Arg', 'CGC': 'Arg', 'CGA': 'Arg', 'CGG': 'Arg',
  'CGU': 'Arg', 'AGA': 'Arg', 'AGG': 'Arg',
  // Glycine
  'GGT': 'Gly', 'GGC': 'Gly', 'GGA': 'Gly', 'GGG': 'Gly',
  'GGU': 'Gly'
};

const translateCodon = (codon) => {
  if (codon.length < 3) return '';
  const upper = codon.toUpperCase();
  if (codonTable[upper]) return codonTable[upper];
  
  const firstTwo = upper.substring(0, 2);
  if (firstTwo === 'AC') return 'Thr';
  if (firstTwo === 'CC') return 'Pro';
  if (firstTwo === 'CG') return 'Arg';
  if (firstTwo === 'GC') return 'Ala';
  if (firstTwo === 'GG') return 'Gly';
  if (firstTwo === 'CT' || firstTwo === 'CU') return 'Leu';
  if (firstTwo === 'GT' || firstTwo === 'GU') return 'Val';
  if (firstTwo === 'TC' || firstTwo === 'UC') return 'Ser';
  
  return 'Xaa';
};

const formatCodons = (seq, direction) => {
  const codons = seq.match(/.{1,3}/g) || [];
  const joined = codons.join(" ");
  return (direction === "5-3") ? `5'-${joined}-3'` : `3'-${joined}-5'`;
};

const formatAminoAcids = (seq, direction) => {
  const is5to3 = (direction === "5-3");
  const cleanSeq5to3 = is5to3 ? seq : reverseString(seq);
  const codons = cleanSeq5to3.match(/.{1,3}/g) || [];
  const aminos = codons.map(codon => {
    if (codon.length < 3) return `[${codon}]`;
    return translateCodon(codon);
  });
  if (is5to3) {
    return `N-${aminos.join("-")}-C`;
  } else {
    return `C-${aminos.reverse().join("-")}-N`;
  }
};

export const stripDirectionLabels = (text) => text
  .replace(/^\s*[53]['’]\s*-\s*/, '')
  .replace(/\s*-\s*[53]['’]\s*$/, '');

const getStrandGroups = (strandBases, direction, _isRna) => {
  const len = strandBases.length;
  const groups = [];
  const is5to3 = (direction === '5-3');
  
  if (is5to3) {
    for (let i = 0; i < len; i += 3) {
      const groupBases = strandBases.slice(i, i + 3);
      const codon = groupBases.join('');
      groups.push({
        startIndex: i,
        length: groupBases.length,
        seq: codon,
        amino: codon.length < 3 ? `[${codon}]` : translateCodon(codon)
      });
    }
  } else {
    for (let i = len - 1; i >= 0; i -= 3) {
      const endIndex = i;
      const startIndex = Math.max(0, i - 2);
      const groupBases = strandBases.slice(startIndex, endIndex + 1);
      const codon = groupBases.slice().reverse().join('');
      groups.push({
        startIndex: startIndex,
        length: groupBases.length,
        seq: codon,
        amino: codon.length < 3 ? `[${codon}]` : translateCodon(codon)
      });
    }
  }
  return groups;
};

export default function DnaConverter() {
  const { t, i18n } = useTranslation('tools');
  const [input, setInput] = useState('');
  const [seqType, setSeqType] = useState('auto');
  const [direction, setDirection] = useState('5-3');
  const [codonMode, setCodonMode] = useState('none'); // 'none', 'codon', 'amino'
  const [copiedBtn, setCopiedBtn] = useState(null);
  const [viewMode, setViewMode] = useState('text'); // 'text' or 'figure'
  const [copyWithoutDirectionLabels, setCopyWithoutDirectionLabels] = useState(false);

  // States to keep track of warning colors & messages
  const [statusText, setStatusText] = useState('');
  const [statusStyle, setStatusStyle] = useState({});

  const [outputs, setOutputs] = useState({
    opposite: '',
    revcomp: '',
    reverse: '',
  });

  const handleCopy = (text, key) => {
    if (!text) return;
    const clipboardText = copyWithoutDirectionLabels ? stripDirectionLabels(text) : text;
    navigator.clipboard.writeText(clipboardText).then(() => {
      setCopiedBtn(key);
      setTimeout(() => {
        setCopiedBtn(null);
      }, 1500);
    });
  };

  useEffect(() => {
    if (!input.trim()) {
      setOutputs({ opposite: '', revcomp: '', reverse: '' });
      setStatusText(t('tool-dna.ui.enterSequence'));
      setStatusStyle({});
      return;
    }

    // 1. Detect and parse direction if marked explicitly in sequence
    const lowerVal = input.toLowerCase();
    const has5PrimeStart = /^\s*5['’]/.test(lowerVal);
    const has3PrimeStart = /^\s*3['’]/.test(lowerVal);
    const has5PrimeEnd = /5['’]\s*$/.test(lowerVal);
    const has3PrimeEnd = /3['’]\s*$/.test(lowerVal);

    let currentDirection = direction;
    if (has5PrimeStart || has3PrimeEnd) {
      currentDirection = "5-3";
      setDirection("5-3");
    } else if (has3PrimeStart || has5PrimeEnd) {
      currentDirection = "3-5";
      setDirection("3-5");
    }

    // 2. Clean the sequence (remove 5', 3', hyphens, whitespace, numbers, etc.)
    let cleaned = input
      .replace(/5['’](-)?/gi, '')
      .replace(/3['’](-)?/gi, '')
      .replace(/[-'’\s\d]/g, '')
      .toUpperCase();

    if (!cleaned) {
      setOutputs({ opposite: '', revcomp: '', reverse: '' });
      setStatusText(t('tool-dna.ui.validSequence'));
      setStatusStyle({});
      return;
    }

    // Validate characters: only A, T, C, G, U, and N are allowed
    if (/[^ACGUTN]/.test(cleaned)) {
      setOutputs({ opposite: '', revcomp: '', reverse: '' });
      setStatusText(t('tool-dna.ui.invalidCharacters'));
      setStatusStyle({});
      return;
    }

    let warningMessage = "";
    if (cleaned.includes("N")) {
      warningMessage = t('tool-dna.ui.nDetected');
    }

    // 3. Auto-detect sequence type (DNA vs RNA)
    let isRna = false;
    if (seqType === "auto") {
      const hasU = cleaned.includes("U");
      const hasT = cleaned.includes("T");
      if (hasU && hasT) {
        warningMessage = t('tool-dna.ui.warningCombined', {
          prior: warningMessage ? `${warningMessage} ` : '',
        });
        isRna = false;
      } else if (hasU) {
        isRna = true;
      } else {
        isRna = false; // defaults to DNA
      }
    } else {
      isRna = seqType === "rna";
    }

    if (warningMessage) {
      setStatusText(warningMessage);
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      setStatusStyle({ color: isDark ? "#fbbf24" : "#b45309" }); // Amber/yellow color for warnings
    } else {
      setStatusText("");
      setStatusStyle({});
    }

    // 4. Perform conversions
    // Get 5' to 3' representation of input sequence to facilitate standard revcomp
    const seq5to3 = (currentDirection === "5-3") ? cleaned : reverseString(cleaned);

    // A. Opposite Strand (3' ↔ 5' Swap)
    const oppositeComplement = getComplement(cleaned, isRna);
    let oppositeStr = "";
    if (codonMode === 'codon') {
      oppositeStr = formatCodons(oppositeComplement, currentDirection === "5-3" ? "3-5" : "5-3");
    } else if (codonMode === 'amino') {
      oppositeStr = formatAminoAcids(oppositeComplement, currentDirection === "5-3" ? "3-5" : "5-3");
    } else {
      oppositeStr = (currentDirection === "5-3") 
        ? `3'-${oppositeComplement}-5'` 
        : `5'-${oppositeComplement}-3'`;
    }

    // B. Standard Reverse Complement (always written 5' → 3')
    const revcompSeq = reverseString(getComplement(seq5to3, isRna));
    let revcompStr = "";
    if (codonMode === 'codon') {
      revcompStr = formatCodons(revcompSeq, "5-3");
    } else if (codonMode === 'amino') {
      revcompStr = formatAminoAcids(revcompSeq, "5-3");
    } else {
      revcompStr = `5'-${revcompSeq}-3'`;
    }

    // C. Same Strand (Reverse Direction)
    const reversedSeq = reverseString(cleaned);
    let reverseStr = "";
    if (codonMode === 'codon') {
      reverseStr = formatCodons(reversedSeq, currentDirection === "5-3" ? "3-5" : "5-3");
    } else if (codonMode === 'amino') {
      reverseStr = formatAminoAcids(reversedSeq, currentDirection === "5-3" ? "3-5" : "5-3");
    } else {
      reverseStr = (currentDirection === "5-3")
        ? `3'-${reversedSeq}-5'`
        : `5'-${reversedSeq}-3'`;
    }

    setOutputs({
      opposite: oppositeStr,
      revcomp: revcompStr,
      reverse: reverseStr,
    });
  }, [codonMode, direction, i18n.language, input, seqType, t]);

  const renderVisualDna = () => {
    const cleaned = input
      .replace(/5['’](-)?/gi, '')
      .replace(/3['’](-)?/gi, '')
      .replace(/[-'’\s\d]/g, '')
      .toUpperCase();

    if (!cleaned) {
      return (
        <div className="p-12 text-center text-text-muted font-medium bg-card border border-border rounded-lg">
          {t('tool-dna.ui.visualPrompt')}
        </div>
      );
    }

    if (/[^ACGUTN]/.test(cleaned)) {
      return (
        <div className="p-12 text-center text-text-muted font-medium bg-card border border-border rounded-lg text-red-500 border-red-500/20 bg-red-500/[0.02]">
          {t('tool-dna.ui.invalidCharacters')}
        </div>
      );
    }

    let isRna = false;
    if (seqType === "auto") {
      const hasU = cleaned.includes("U");
      const hasT = cleaned.includes("T");
      if (hasU && hasT) {
        isRna = false;
      } else if (hasU) {
        isRna = true;
      } else {
        isRna = false;
      }
    } else {
      isRna = seqType === "rna";
    }

    const len = cleaned.length;
    const baseWidth = 50;
    const padding = 50;
    const svgWidth = padding * 2 + len * baseWidth;
    const svgHeight = 250;

    const isTopSense = (direction === '5-3');
    const topOpacity = isTopSense ? 1.0 : 0.3;
    const bottomOpacity = isTopSense ? 0.3 : 1.0;

    const topStrand = isTopSense ? cleaned.split('') : cleaned.split('').map(b => getComplement(b, isRna));
    const bottomStrand = isTopSense ? cleaned.split('').map(b => getComplement(b, isRna)) : cleaned.split('');

    const topStrandGroups = getStrandGroups(topStrand, '5-3', isRna);
    const bottomStrandGroups = getStrandGroups(bottomStrand, '3-5', isRna);

    return (
      <div className="flex flex-col gap-4 w-full">
        <div className="bg-card border border-border rounded-lg p-6 max-[480px]:p-3 flex flex-col gap-4 w-full shadow-card">
          <div className="flex flex-wrap gap-6 max-[480px]:gap-3 text-sm max-[480px]:text-[0.78rem] text-text-muted font-medium border-b border-border pb-3">
            {isTopSense ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 h-1.5 rounded-sm bg-[#ef4444]"></span>
                  <span>{t('tool-dna.ui.inputStrand53')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 h-1.5 rounded-sm bg-[#3b82f6] opacity-30"></span>
                  <span>{t('tool-dna.ui.complementaryStrand35')}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 h-1.5 rounded-sm bg-[#3b82f6]"></span>
                  <span>{t('tool-dna.ui.inputStrand35')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 h-1.5 rounded-sm bg-[#ef4444] opacity-30"></span>
                  <span>{t('tool-dna.ui.complementaryStrand53')}</span>
                </div>
              </>
            )}
          </div>
          
          <div className="w-full overflow-x-auto whitespace-nowrap pb-3">
            <svg width={svgWidth} height={svgHeight} className="block">
              <defs>
                <marker id="arrow-right-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                </marker>
                <marker id="arrow-left-blue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 10 0 L 0 5 L 10 10 z" fill="#3b82f6" />
                </marker>
                <marker id="arrow-right-blue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
                </marker>
              </defs>

              {/* Backbones */}
              <rect 
                x={padding} 
                y={45} 
                width={len * baseWidth} 
                height={10} 
                fill="#ef4444" 
                opacity={topOpacity}
                rx={5} 
              />
              <rect 
                x={padding} 
                y={145} 
                width={len * baseWidth} 
                height={10} 
                fill="#3b82f6" 
                opacity={bottomOpacity}
                rx={5} 
              />

              {/* Labels (Top is always 5' left, 3' right; Bottom is always 3' left, 5' right) */}
              <text x={padding - 20} y={53} textAnchor="middle" fill="var(--text-main)" opacity={topOpacity} fontSize="14" fontWeight="bold">
                5'
              </text>
              <text x={padding + len * baseWidth + 20} y={53} textAnchor="middle" fill="var(--text-main)" opacity={topOpacity} fontSize="14" fontWeight="bold">
                3'
              </text>

              <text x={padding - 20} y={153} textAnchor="middle" fill="var(--text-main)" opacity={bottomOpacity} fontSize="14" fontWeight="bold">
                3'
              </text>
              <text x={padding + len * baseWidth + 20} y={153} textAnchor="middle" fill="var(--text-main)" opacity={bottomOpacity} fontSize="14" fontWeight="bold">
                5'
              </text>

              {/* Render Nucleotides */}
              {topStrand.map((base, i) => {
                const x = padding + i * baseWidth + baseWidth / 2;
                const bColor = baseColors[base] || '#9ca3af';

                // Top base path (extending down from 55)
                let topPath = '';
                if (base === 'A') {
                  topPath = `M ${x-15} 55 L ${x+15} 55 L ${x+15} 88 L ${x} 103 L ${x-15} 88 Z`;
                } else if (base === 'T' || base === 'U') {
                  topPath = `M ${x-15} 55 L ${x+15} 55 L ${x+15} 103 L ${x} 88 L ${x-15} 103 Z`;
                } else if (base === 'C') {
                  topPath = `M ${x-15} 55 L ${x+15} 55 L ${x+15} 88 Q ${x} 103 ${x-15} 88 Z`;
                } else if (base === 'G') {
                  topPath = `M ${x-15} 55 L ${x+15} 55 L ${x+15} 103 Q ${x} 88 ${x-15} 103 Z`;
                } else {
                  topPath = `M ${x-15} 55 L ${x+15} 55 L ${x+15} 95 L ${x-15} 95 Z`;
                }

                const bottomBase = bottomStrand[i];
                const bottomColor = baseColors[bottomBase] || '#9ca3af';

                // Bottom base path (extending up from 145)
                let bottomPath = '';
                if (bottomBase === 'A') {
                  bottomPath = `M ${x-15} 145 L ${x+15} 145 L ${x+15} 112 L ${x} 97 L ${x-15} 112 Z`;
                } else if (bottomBase === 'T' || bottomBase === 'U') {
                  bottomPath = `M ${x-15} 145 L ${x+15} 145 L ${x+15} 97 L ${x} 112 L ${x-15} 97 Z`;
                } else if (bottomBase === 'C') {
                  bottomPath = `M ${x-15} 145 L ${x+15} 145 L ${x+15} 112 Q ${x} 97 ${x-15} 112 Z`;
                } else if (bottomBase === 'G') {
                  bottomPath = `M ${x-15} 145 L ${x+15} 145 L ${x+15} 97 Q ${x} 112 ${x-15} 97 Z`;
                } else {
                  bottomPath = `M ${x-15} 145 L ${x+15} 145 L ${x+15} 105 L ${x-15} 105 Z`;
                }

                return (
                  <g key={i}>
                    <path d={topPath} fill={bColor} opacity={topOpacity} />
                    <text x={x} y={78} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" opacity={topOpacity}>
                      {base}
                    </text>

                    <path d={bottomPath} fill={bottomColor} opacity={bottomOpacity} />
                    <text x={x} y={126} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" opacity={bottomOpacity}>
                      {bottomBase}
                    </text>
                  </g>
                );
              })}

              {/* Codon Brackets for Top Strand */}
              {codonMode !== 'none' && (
                <g>
                  {topStrandGroups.map((group, index) => {
                    const xStart = padding + group.startIndex * baseWidth;
                    const xEnd = xStart + group.length * baseWidth;
                    const xMid = xStart + (group.length * baseWidth) / 2;
                    const yStart = 33;
                    const bracketPath = `M ${xStart + 5} ${yStart} L ${xStart + 5} ${yStart - 6} L ${xEnd - 5} ${yStart - 6} L ${xEnd - 5} ${yStart}`;
                    const label = (codonMode === 'amino') ? group.amino : group.seq;
                    return (
                      <g key={index} opacity={topOpacity}>
                        <path d={bracketPath} fill="none" stroke="var(--text-muted)" strokeWidth="1" />
                        <text x={xMid} y={yStart - 10} textAnchor="middle" fill="var(--text-main)" fontSize="10" fontWeight="bold">
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Codon Brackets for Bottom Strand */}
              {codonMode !== 'none' && (
                <g>
                  {bottomStrandGroups.map((group, index) => {
                    const xStart = padding + group.startIndex * baseWidth;
                    const xEnd = xStart + group.length * baseWidth;
                    const xMid = xStart + (group.length * baseWidth) / 2;
                    const yStart = 157;
                    const bracketPath = `M ${xStart + 5} ${yStart} L ${xStart + 5} ${yStart + 6} L ${xEnd - 5} ${yStart + 6} L ${xEnd - 5} ${yStart}`;
                    const label = (codonMode === 'amino') ? group.amino : group.seq;
                    return (
                      <g key={index} opacity={bottomOpacity}>
                        <path d={bracketPath} fill="none" stroke="var(--text-muted)" strokeWidth="1" />
                        <text x={xMid} y={yStart + 16} textAnchor="middle" fill="var(--text-main)" fontSize="10" fontWeight="bold">
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Sense/Target Direction Indicator (above top strand, always 5' -> 3') */}
              <g>
                <line 
                  x1={padding} 
                  y1={15} 
                  x2={padding + len * baseWidth} 
                  y2={15} 
                  stroke="#ef4444" 
                  strokeWidth="2" 
                  opacity={topOpacity}
                  markerEnd="url(#arrow-right-red)" 
                />
                <text 
                  x={padding + (len * baseWidth) / 2} 
                  y={10} 
                  textAnchor="middle" 
                  fill="#ef4444" 
                  opacity={topOpacity}
                  fontSize="10" 
                  fontWeight="600"
                >
                  {t(isTopSense ? 'tool-dna.ui.inputDirection53' : 'tool-dna.ui.complementaryDirection53')}
                </text>
              </g>

              {/* Target/Sense Direction Indicator (below bottom strand) */}
              <g>
                <line 
                  x1={isTopSense ? padding + len * baseWidth : padding} 
                  y1={205} 
                  x2={isTopSense ? padding : padding + len * baseWidth} 
                  y2={205} 
                  stroke="#3b82f6" 
                  strokeWidth="2" 
                  opacity={bottomOpacity}
                  markerEnd={isTopSense ? "url(#arrow-left-blue)" : "url(#arrow-right-blue)"} 
                />
                <text 
                  x={padding + (len * baseWidth) / 2} 
                  y={225} 
                  textAnchor="middle" 
                  fill="#3b82f6" 
                  opacity={bottomOpacity} 
                  fontSize="10" 
                  fontWeight="600"
                >
                  {t(isTopSense ? 'tool-dna.ui.complementaryDirection35' : 'tool-dna.ui.inputDirection35')}
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card id="tool-dna" variant="tool" size="wide">
      <ToolHeader title={t('tool-dna.title')} />
      
      <div className="flex flex-col md:flex-row gap-4 w-full">
        <div className="flex flex-col gap-2 w-full flex-1">
          <label className="text-sm font-semibold text-text-main" htmlFor="dna-seq-type">{t('tool-dna.ui.sequenceType')}</label>
          <select
            id="dna-seq-type"
            className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card"
            value={seqType}
            onChange={(e) => setSeqType(e.target.value)}
          >
            <option value="auto">{t('tool-dna.ui.autoDetect')}</option>
            <option value="dna">DNA</option>
            <option value="rna">RNA</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 w-full flex-1">
          <label className="text-sm font-semibold text-text-main" htmlFor="dna-direction">{t('tool-dna.ui.inputDirection')}</label>
          <select
            id="dna-direction"
            className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="5-3">{t('tool-dna.ui.defaultDirection')}</option>
            <option value="3-5">3' → 5'</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 w-full flex-1">
          <label className="text-sm font-semibold text-text-main">{t('tool-dna.ui.codonDisplay')}</label>
          <div className="flex h-10 w-full rounded-md border border-border bg-app p-1" role="group" aria-label={t('tool-dna.ui.codonDisplayAria')}>
            <button
              type="button"
              className={`flex-1 bg-transparent border-none rounded py-1 text-sm font-semibold text-text-muted cursor-pointer transition-all duration-200 flex items-center justify-center text-center leading-none hover:text-text-main ${codonMode === 'none' ? 'bg-card text-accent shadow-sm dark:shadow-md' : ''}`}
              onClick={() => setCodonMode('none')}
            >
              {t('tool-dna.ui.standard')}
            </button>
            <button
              type="button"
              className={`flex-1 bg-transparent border-none rounded py-1 text-sm font-semibold text-text-muted cursor-pointer transition-all duration-200 flex items-center justify-center text-center leading-none hover:text-text-main ${codonMode === 'codon' ? 'bg-card text-accent shadow-sm dark:shadow-md' : ''}`}
              onClick={() => setCodonMode('codon')}
            >
              {t('tool-dna.ui.codons')}
            </button>
            <button
              type="button"
              className={`flex-1 bg-transparent border-none rounded py-1 text-sm font-semibold text-text-muted cursor-pointer transition-all duration-200 flex items-center justify-center text-center leading-none hover:text-text-main ${codonMode === 'amino' ? 'bg-card text-accent shadow-sm dark:shadow-md' : ''}`}
              onClick={() => setCodonMode('amino')}
            >
              {t('tool-dna.ui.aminoAcids')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <label className="text-sm font-semibold text-text-main" htmlFor="dna-input">{t('tool-dna.ui.sequence')}</label>
        <textarea
          id="dna-input"
          className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card resize-none"
          rows={3}
          placeholder={t('tool-dna.ui.placeholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="align-self-start flex w-fit gap-2 rounded-md border border-border bg-app p-1">
          <button
            type="button"
            className={`bg-transparent border-none py-1.5 px-4 rounded text-sm font-semibold text-text-muted cursor-pointer transition-all duration-200 hover:text-text-main ${viewMode === 'text' ? 'bg-card text-accent shadow-sm dark:shadow-md' : ''}`}
            onClick={() => setViewMode('text')}
          >
            {t('tool-dna.ui.textMode')}
          </button>
          <button
            type="button"
            className={`bg-transparent border-none py-1.5 px-4 rounded text-sm font-semibold text-text-muted cursor-pointer transition-all duration-200 hover:text-text-main ${viewMode === 'figure' ? 'bg-card text-accent shadow-sm dark:shadow-md' : ''}`}
            onClick={() => setViewMode('figure')}
          >
            {t('tool-dna.ui.figureMode')}
          </button>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-app px-3 py-2 text-sm font-semibold text-text-main">
          <input
            type="checkbox"
            checked={copyWithoutDirectionLabels}
            onChange={(event) => {
              setCopyWithoutDirectionLabels(event.target.checked);
              setCopiedBtn(null);
            }}
            className="h-4 w-4 accent-accent"
          />
          {t('tool-dna.ui.copyWithoutLabels')}
        </label>
      </div>

      {viewMode === 'text' ? (
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-2 w-full">
            <div className="flex justify-between items-center mb-0.5">
              <label className="text-sm font-semibold text-text-main" htmlFor="dna-output-opposite">{t('tool-dna.ui.oppositeStrand')}</label>
              <button
                className={`px-2.5 py-1 text-xs font-semibold rounded-sm bg-accent-light text-accent border border-accent/15 dark:border-accent/30 cursor-pointer transition-all duration-200 leading-none hover:bg-accent-fill hover:text-accent-on-fill hover:border-accent ${copiedBtn === 'opposite' ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-500 hover:text-white hover:border-emerald-500' : ''}`}
                onClick={() => handleCopy(outputs.opposite, 'opposite')}
              >
                {t(copiedBtn === 'opposite' ? 'tool-dna.ui.copied' : 'tool-dna.ui.copy')}
              </button>
            </div>
            <input 
              id="dna-output-opposite" 
              type="text" 
              className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card read-only:bg-app read-only:opacity-80 read-only:focus:ring-0 read-only:focus:border-border" 
              readOnly 
              value={outputs.opposite} 
            />
          </div>
          <div className="flex flex-col gap-2 w-full">
            <div className="flex justify-between items-center mb-0.5">
              <label className="text-sm font-semibold text-text-main" htmlFor="dna-output-revcomp">{t('tool-dna.ui.reverseComplement')}</label>
              <button
                className={`px-2.5 py-1 text-xs font-semibold rounded-sm bg-accent-light text-accent border border-accent/15 dark:border-accent/30 cursor-pointer transition-all duration-200 leading-none hover:bg-accent-fill hover:text-accent-on-fill hover:border-accent ${copiedBtn === 'revcomp' ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-500 hover:text-white hover:border-emerald-500' : ''}`}
                onClick={() => handleCopy(outputs.revcomp, 'revcomp')}
              >
                {t(copiedBtn === 'revcomp' ? 'tool-dna.ui.copied' : 'tool-dna.ui.copy')}
              </button>
            </div>
            <input 
              id="dna-output-revcomp" 
              type="text" 
              className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card read-only:bg-app read-only:opacity-80 read-only:focus:ring-0 read-only:focus:border-border" 
              readOnly 
              value={outputs.revcomp} 
            />
          </div>
          <div className="flex w-full flex-col gap-2">
            <div className="flex justify-between items-center mb-0.5">
              <label className="text-sm font-semibold text-text-main" htmlFor="dna-output-reverse">{t('tool-dna.ui.sameStrand')}</label>
              <button
                className={`px-2.5 py-1 text-xs font-semibold rounded-sm bg-accent-light text-accent border border-accent/15 dark:border-accent/30 cursor-pointer transition-all duration-200 leading-none hover:bg-accent-fill hover:text-accent-on-fill hover:border-accent ${copiedBtn === 'reverse' ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-500 hover:text-white hover:border-emerald-500' : ''}`}
                onClick={() => handleCopy(outputs.reverse, 'reverse')}
              >
                {t(copiedBtn === 'reverse' ? 'tool-dna.ui.copied' : 'tool-dna.ui.copy')}
              </button>
            </div>
            <input 
              id="dna-output-reverse" 
              type="text" 
              className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card read-only:bg-app read-only:opacity-80 read-only:focus:ring-0 read-only:focus:border-border" 
              readOnly 
              value={outputs.reverse} 
            />
          </div>
        </div>
      ) : (
        renderVisualDna()
      )}
      {input.trim() && statusText && <p className="text-sm font-medium text-red-500" id="dna-status" style={statusStyle}>{statusText}</p>}
      <p className="text-xs text-text-muted mt-1">
        {t('tool-dna.ui.supportNote')}
      </p>
    </Card>
  );
}

