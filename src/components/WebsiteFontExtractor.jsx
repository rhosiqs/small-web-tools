import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';
import Spinner from './ui/Spinner';
import { grantConsent, hasConsent } from '../lib/thirdPartyServices';

const EXPLICIT_MAP = {
  arial: ['Inter', 'Roboto', 'Source Sans 3'],
  avenir: ['Nunito', 'Nunito Sans', 'DM Sans'],
  baskerville: ['Libre Baskerville', 'Crimson Pro', 'Merriweather'],
  consolas: ['JetBrains Mono', 'Fira Code', 'Source Code Pro'],
  courier: ['JetBrains Mono', 'Roboto Mono', 'Source Code Pro'],
  'courier new': ['JetBrains Mono', 'Roboto Mono', 'IBM Plex Mono'],
  futura: ['Jost', 'Montserrat', 'Nunito'],
  garamond: ['EB Garamond', 'Cormorant Garamond', 'Crimson Pro'],
  georgia: ['Merriweather', 'Lora', 'Playfair Display'],
  gotham: ['Montserrat', 'Nunito Sans', 'DM Sans'],
  helvetica: ['Inter', 'Montserrat', 'Nunito Sans'],
  'helvetica neue': ['Inter', 'Nunito Sans', 'DM Sans'],
  inter: ['Inter', 'DM Sans', 'Figtree'],
  'jetbrains mono': ['JetBrains Mono', 'Fira Code', 'IBM Plex Mono'],
  lato: ['Lato', 'Nunito', 'Raleway'],
  menlo: ['JetBrains Mono', 'IBM Plex Mono', 'Fira Code'],
  monaco: ['JetBrains Mono', 'Fira Code', 'IBM Plex Mono'],
  montserrat: ['Montserrat', 'Nunito', 'Raleway'],
  'open sans': ['Open Sans', 'Nunito Sans', 'Source Sans 3'],
  'plus jakarta sans': ['Plus Jakarta Sans', 'Inter', 'DM Sans'],
  roboto: ['Roboto', 'Nunito Sans', 'Lato'],
  'segoe ui': ['Inter', 'DM Sans', 'Figtree'],
  'sf pro': ['Inter', 'Plus Jakarta Sans', 'DM Sans'],
  'source code pro': ['Source Code Pro', 'JetBrains Mono', 'Fira Code'],
  'times new roman': ['Lora', 'Playfair Display', 'Merriweather'],
};

const KEYWORD_FALLBACKS = [
  { words: ['mono', 'code', 'console', 'terminal'], names: ['JetBrains Mono', 'Fira Code', 'IBM Plex Mono'] },
  { words: ['serif', 'roman', 'book'], names: ['Lora', 'Merriweather', 'Playfair Display'] },
  { words: ['condensed', 'narrow'], names: ['Barlow Condensed', 'Roboto Condensed'] },
  { words: ['sans', 'grotesk', 'gothic'], names: ['Inter', 'DM Sans', 'Nunito Sans'] },
  { words: ['rounded', 'soft'], names: ['Nunito', 'Comfortaa', 'Quicksand'] },
  { words: ['script', 'cursive', 'handwriting'], names: ['Dancing Script', 'Pacifico', 'Sacramento'] },
];

const BADGE_STYLES = {
  WOFF2: 'bg-accent-light text-accent',
  WOFF: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
  TRUETYPE: 'bg-purple-500/10 text-purple-500 dark:text-purple-400',
  OPENTYPE: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  EOT: 'bg-red-500/10 text-red-500 dark:text-red-400',
  SVG: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
};

function categoryFor(name) {
  if (/mono|code/i.test(name)) return 'monospace';
  if (/serif|lora|garamond|merriweather|playfair/i.test(name)) return 'serif';
  if (/script|pacifico|sacramento/i.test(name)) return 'handwriting';
  return 'sans-serif';
}

function googleFontsUrl(name) {
  return `https://fonts.google.com/specimen/${encodeURIComponent(name.replace(/ /g, '+'))}`;
}

function getSimilarGoogleFonts(family) {
  const key = family.toLowerCase().trim();
  let names = EXPLICIT_MAP[key];
  if (!names) {
    const partial = Object.entries(EXPLICIT_MAP).find(([known]) => key.includes(known) || known.includes(key));
    names = partial?.[1];
  }
  if (!names) {
    names = KEYWORD_FALLBACKS.find(({ words }) => words.some((word) => key.includes(word)))?.names;
  }
  return (names || ['Inter', 'Lora', 'JetBrains Mono']).map((name) => ({
    name,
    cat: categoryFor(name),
    url: googleFontsUrl(name),
  }));
}

function formatBadgeClass(format) {
  const normalized = format?.toUpperCase() || '';
  return `inline-flex items-center px-2 py-0.5 rounded font-semibold text-[0.7rem] tracking-wider whitespace-nowrap shrink-0 ${BADGE_STYLES[normalized] || 'bg-slate-500/10 text-text-muted'}`;
}

function FontCard({ font }) {
  const { t } = useTranslation('tools');
  const [showSimilar, setShowSimilar] = useState(false);
  const similar = getSimilarGoogleFonts(font.family);

  return (
    <div className="flex flex-col gap-3.5 bg-card border border-border rounded-2xl p-5 transition-all duration-200 hover:border-accent">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-[1.05rem] font-bold text-text-main truncate tracking-tight">{font.family}</h2>
          <p className="text-[0.74rem] text-text-muted mt-0.5 truncate">{font.name}</p>
        </div>
        <span className={formatBadgeClass(font.format)}>{font.format}</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.79rem] text-text-muted">
        <div><dt className="font-semibold text-text-main">{t('tool-fontextractor.ui.weight')}</dt><dd>{font.weight || t('tool-fontextractor.ui.unknown')}</dd></div>
        <div><dt className="font-semibold text-text-main">{t('tool-fontextractor.ui.style')}</dt><dd>{font.style || t('tool-fontextractor.ui.unknown')}</dd></div>
        <div><dt className="font-semibold text-text-main">{t('tool-fontextractor.ui.stretch')}</dt><dd>{font.stretch || t('tool-fontextractor.ui.unknown')}</dd></div>
        <div><dt className="font-semibold text-text-main">{t('tool-fontextractor.ui.variable')}</dt><dd>{t(font.isVariable ? 'tool-fontextractor.ui.yes' : 'tool-fontextractor.ui.no')}</dd></div>
        <div className="col-span-2">
          <dt className="font-semibold text-text-main">{t('tool-fontextractor.ui.sourceHost')}</dt>
          <dd className="break-all">{font.sourceHost || t('tool-fontextractor.ui.embedded')}</dd>
        </div>
        {font.unicodeRange && font.unicodeRange !== 'unknown' && (
          <div className="col-span-2">
            <dt className="font-semibold text-text-main">{t('tool-fontextractor.ui.unicodeRange')}</dt>
            <dd className="break-all">{font.unicodeRange}</dd>
          </div>
        )}
      </dl>

      <Button
        className="w-full justify-center"
        variant="secondary"
        active={showSimilar}
        onClick={() => setShowSimilar((visible) => !visible)}
      >
        {t('tool-fontextractor.ui.similar')}
      </Button>

      {showSimilar && (
        <div className="bg-app border border-border rounded-xl p-3 flex flex-col gap-2">
          <p className="text-[0.77rem] text-text-muted">
            {t('tool-fontextractor.ui.similarHint')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {similar.map((suggestion) => (
              <a
                key={suggestion.name}
                href={suggestion.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-[0.79rem] text-text-main font-medium hover:border-accent hover:text-accent"
              >
                {suggestion.name}
                <span className="text-[0.69rem] text-text-muted italic">{suggestion.cat}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WebsiteFontExtractor() {
  const { t, i18n } = useTranslation('tools');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [fonts, setFonts] = useState([]);
  const [searched, setSearched] = useState(false);
  const [truncation, setTruncation] = useState(null);
  const [extractorAllowed, setExtractorAllowed] = useState(() => hasConsent('fontextractor'));
  const inputRef = useRef(null);
  const exampleUrls = ['stripe.com', 'linear.app', 'vercel.com'];

  useEffect(() => {
    const handleConsentUpdate = () => setExtractorAllowed(hasConsent('fontextractor'));
    window.addEventListener('consent_updated', handleConsentUpdate);
    return () => window.removeEventListener('consent_updated', handleConsentUpdate);
  }, []);

  const doExtract = async (rawUrl) => {
    if (!extractorAllowed) {
      setStatus(t('tool-fontextractor.ui.blocked'));
      return;
    }
    let target = (rawUrl || urlInput).trim();
    if (!target) {
      setStatus(t('tool-fontextractor.ui.required'));
      return;
    }
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    setLoading(true);
    setStatus('');
    setFonts([]);
    setTruncation(null);
    setSearched(true);

    try {
      const response = await fetch('/api/extract-fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setStatus(t('tool-fontextractor.ui.error', { message: data.error || t('tool-fontextractor.ui.failed') }));
      } else if (!data.fonts?.length) {
        setStatus(t('tool-fontextractor.ui.noneDetailed'));
      } else {
        setFonts(data.fonts);
        setTruncation(data.truncation || null);
      }
    } catch {
      setStatus(t('tool-fontextractor.ui.error', { message: t('tool-fontextractor.ui.unavailable') }));
    } finally {
      setLoading(false);
    }
  };

  const groupedFonts = Array.from(fonts.reduce((groups, font) => {
    const key = font.family || t('tool-fontextractor.ui.unknownFamily');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(font);
    return groups;
  }, new Map()));

  return (
    <Card id="tool-fontextractor" variant="tool" size="wide">
      <ToolHeader title={t('tool-fontextractor.ui.heading')} />

      {!extractorAllowed && (
        <div className="p-3 bg-app border border-border rounded-xl flex items-center justify-between gap-3 text-xs">
          <span>{t('tool-fontextractor.ui.consentDisclosure')}</span>
          <Button variant="secondary" onClick={() => grantConsent('fontextractor')}>{t('tool-fontextractor.ui.allow')}</Button>
        </div>
      )}

      <div className="flex flex-col gap-2 w-full mt-4">
        <label htmlFor="fontextractor-input">{t('tool-fontextractor.ui.websiteUrl')}</label>
        <div className="search-input-group">
          <input
            ref={inputRef}
            id="fontextractor-input"
            type="url"
            placeholder={t('tool-fontextractor.ui.placeholder')}
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && doExtract()}
            autoComplete="off"
            spellCheck={false}
          />
          <Button id="fontextractor-btn" variant="primary" onClick={() => doExtract()} disabled={loading}>
            {t(loading ? 'tool-fontextractor.ui.scanning' : 'tool-fontextractor.ui.scan')}
          </Button>
        </div>
        <p className="text-[0.78rem] text-text-muted">
          {t('tool-fontextractor.ui.try')}{' '}
          {exampleUrls.map((url, index) => (
            <React.Fragment key={url}>
              <button type="button" className="text-accent underline" onClick={() => { setUrlInput(url); inputRef.current?.focus(); }}>
                {url}
              </button>
              {index < exampleUrls.length - 1 && ', '}
            </React.Fragment>
          ))}
        </p>
      </div>

      {loading && <Spinner container label={t('tool-fontextractor.ui.fetching')} className="py-12 w-full" />}
      {!loading && status && <p role="status" className="text-red-500 font-medium text-sm mt-2">{status}</p>}

      {!loading && fonts.length > 0 && (
        <div className="flex flex-col gap-5 w-full mt-4">
          <div className="p-3 px-4 bg-app border border-border rounded-xl text-[0.88rem] text-text-muted">
            {t('tool-fontextractor.ui.summary', {
              families: new Intl.NumberFormat(i18n.resolvedLanguage).format(groupedFonts.length),
              faces: new Intl.NumberFormat(i18n.resolvedLanguage).format(fonts.length),
            })}
          </div>
          {truncation?.truncated && (
            <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-text-main">
              {t('tool-fontextractor.ui.truncated', { reasons: truncation.reasons.join(', ') })}
            </p>
          )}
          <div className="max-h-[420px] overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-5">
            {groupedFonts.map(([family, faces]) => (
              <section key={family} className="flex flex-col gap-2">
                <h2 className="text-sm font-bold text-text-main">
                  {family} <span className="text-text-muted font-normal">{t('tool-fontextractor.ui.faceCount', { count: faces.length })}</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {faces.map((font) => (
                    <FontCard
                      key={[font.sourceHost, font.family, font.weight, font.style, font.stretch, font.unicodeRange].join('|')}
                      font={font}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {!loading && searched && fonts.length === 0 && !status && (
        <p className="py-10 text-center text-text-muted">{t('tool-fontextractor.ui.none')}</p>
      )}

      <p className="text-xs text-text-muted mt-4 border-t border-border pt-3">
        {t('tool-fontextractor.ui.disclaimer')}
      </p>
    </Card>
  );
}
