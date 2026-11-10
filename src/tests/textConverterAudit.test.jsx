import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import DnaConverter, { translateCodon } from '../components/DnaConverter';
import { capitalizeSpecificTerms, toTitleCase } from '../components/CasingSwitcher';
import {
  decodeFastqQualityString,
  encodeFastqQualityScores,
  parseFastqQualityScores,
} from '../components/PhredScaleConverter/lib/phredDomain';
import { calendarDaysBetween, parseDateToUTC } from '../components/DateCounter/lib/timeDomain';
import { formatCurrencyRate } from '../lib/currency';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('DNA translation', () => {
  it('translates AGT as serine, matching the standard genetic code', () => {
    expect(translateCodon('AGT')).toBe('Ser');
    expect(translateCodon('AGC')).toBe('Ser');
    expect(translateCodon('AGU')).toBe('Ser');
  });

  it('translates every unambiguous DNA codon like the standard table', () => {
    const aa = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
    const three = {
      F: 'Phe', L: 'Leu', S: 'Ser', Y: 'Tyr', '*': 'Stop', C: 'Cys', W: 'Trp', P: 'Pro', H: 'His',
      Q: 'Gln', R: 'Arg', I: 'Ile', M: 'Met', T: 'Thr', N: 'Asn', K: 'Lys', V: 'Val', A: 'Ala',
      D: 'Asp', E: 'Glu', G: 'Gly',
    };
    let index = 0;
    for (const a of 'TCAG') for (const b of 'TCAG') for (const c of 'TCAG') {
      const expected = three[aa[index]];
      index += 1;
      expect(translateCodon(a + b + c)).toBe(expected);
      expect(translateCodon((a + b + c).replace(/T/g, 'U'))).toBe(expected);
    }
  });
});

describe('DNA converter IUPAC codes', () => {
  let container;
  let root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('accepts the IUPAC ambiguity codes the tool advertises', async () => {
    await act(async () => root.render(<DnaConverter />));
    const input = container.querySelector('#dna-input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => {
      setValue.call(input, 'ACGTRYSWKMBDHVN');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('#dna-status').textContent).toMatch(/^Notice: N was detected/);
    expect(container.querySelector('#dna-output-opposite').value).toBe("3'-TGCAYRSWMKVHDBN-5'");
    expect(container.querySelector('#dna-output-revcomp').value).toBe("5'-NBDHVKMWSRYACGT-3'");
  });

  it('still rejects letters that are not nucleotide codes', async () => {
    await act(async () => root.render(<DnaConverter />));
    const input = container.querySelector('#dna-input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => {
      setValue.call(input, 'ACGTX');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('#dna-status')).not.toBeNull();
    expect(container.querySelector('#dna-output-opposite').value).toBe('');
  });
});

describe('casing title case', () => {
  it('does not capitalise after apostrophes or inside accented words', () => {
    expect(toTitleCase("don't stop believing")).toBe("Don't Stop Believing");
    expect(toTitleCase("rock 'n' roll")).toBe("Rock 'N' Roll");
    expect(toTitleCase('élan vital naïve café')).toBe('Élan Vital Naïve Café');
    expect(toTitleCase('x-ray node js')).toBe('X-Ray Node Js');
    expect(toTitleCase('日本語 text')).toBe('日本語 Text');
  });

  it('capitalises specific terms without breaking accented letters', () => {
    expect(capitalizeSpecificTerms('visit the CAFÉ au lait', 'café au lait', 'all')).toBe('visit the Café Au Lait');
    expect(capitalizeSpecificTerms('use node js here', 'node js', 'all')).toBe('use Node Js here');
  });
});

describe('Phred quality parsing', () => {
  it('ignores surrounding whitespace in a pasted FASTQ quality line', () => {
    expect(decodeFastqQualityString('II?\n', 33)).toEqual([40, 40, 30]);
    expect(decodeFastqQualityString('  II?\r\n', 33)).toEqual([40, 40, 30]);
    expect(decodeFastqQualityString('\n', 33)).toBeNull();
    expect(decodeFastqQualityString('I I', 33)).toBeNull();
  });

  it('rejects empty list entries and non-decimal tokens instead of reading them as scores', () => {
    expect(parseFastqQualityScores('30,', 33)).toBeNull();
    expect(parseFastqQualityScores(',30', 33)).toBeNull();
    expect(parseFastqQualityScores('0x10', 33)).toBeNull();
    expect(parseFastqQualityScores('1e1', 33)).toBeNull();
    expect(encodeFastqQualityScores('30,', 33)).toBeNull();
    expect(parseFastqQualityScores('30, 20\n10', 33)).toEqual([30, 20, 10]);
    expect(encodeFastqQualityScores('40 30', 33)).toBe('I?');
  });
});

describe('date counter arithmetic', () => {
  it('keeps years 0-99 as written instead of mapping them to 1900-1999', () => {
    expect(new Date(parseDateToUTC('0050-03-01')).getUTCFullYear()).toBe(50);
    expect(calendarDaysBetween('0001-01-01', '0100-01-01')).toBe(36159);
    expect(calendarDaysBetween('0099-12-31', '0100-01-01')).toBe(1);
  });

  it('counts leap years and month ends correctly', () => {
    expect(calendarDaysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(calendarDaysBetween('2023-02-28', '2023-03-01')).toBe(1);
    expect(calendarDaysBetween('2000-01-01', '2100-01-01')).toBe(36525);
    expect(calendarDaysBetween('2024-03-02', '2024-03-01')).toBe(-1);
    expect(calendarDaysBetween('', '2024-03-01')).toBeNull();
  });
});

describe('currency rate display', () => {
  it('keeps significant digits of small rates instead of rounding them to the currency minor unit', () => {
    expect(formatCurrencyRate(0.03086, 'USD', 'en-US')).toBe('$0.03086');
    expect(formatCurrencyRate(0.000038, 'USD', 'en-US')).toBe('$0.000038');
    expect(formatCurrencyRate(150.25, 'JPY', 'en-US')).toBe('¥150.25');
    expect(formatCurrencyRate(1, 'USD', 'en-US')).toBe('$1.00');
  });
});
