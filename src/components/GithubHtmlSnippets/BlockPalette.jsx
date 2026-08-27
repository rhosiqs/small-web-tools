import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BlockTile from './BlockTile.jsx';
import { searchBlocks } from './lib/blockCatalog.js';

const COLUMNS = 4;

/**
 * The full catalogue, summoned on demand.
 *
 * Keeping every block behind this overlay is what lets the editor and preview
 * own the page. The grid stays wordless like the strip, so typing is how you
 * narrow it down and the arrow keys are how you walk it.
 */
export default function BlockPalette({ open, onClose, onSelect, labels, bodies }) {
  const { t } = useTranslation('tools');
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const searchRef = useRef(null);
  const dialogRef = useRef(null);

  const matches = useMemo(() => searchBlocks(query, null, labels), [query, labels]);
  const active = matches[Math.min(cursor, matches.length - 1)];

  // Focus moves synchronously: React has already committed the dialog by the
  // time this runs, and deferring to a frame leaves the search box unfocused in
  // a tab that is not painting. Focus returns to whatever opened the palette.
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    setQuery('');
    setCursor(0);
    searchRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const moveBy = (step) => {
    setCursor((current) => Math.min(Math.max(current + step, 0), Math.max(matches.length - 1, 0)));
  };

  const handleSearchKeyDown = (event) => {
    const steps = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS };
    if (event.key in steps) {
      event.preventDefault();
      moveBy(steps[event.key]);
      return;
    }
    if (event.key === 'Enter' && active) {
      event.preventDefault();
      onSelect(active);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-slate-900/50 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('tool-github-html.ui.paletteTitle')}
        className="flex max-h-[64vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card"
      >
        <div className="border-b border-border p-3">
          <label htmlFor="github-html-palette-search" className="sr-only">
            {t('tool-github-html.ui.paletteSearchLabel')}
          </label>
          <input
            id="github-html-palette-search"
            ref={searchRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setCursor(0); }}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('tool-github-html.ui.paletteSearchPlaceholder')}
            className="w-full border-0 bg-transparent px-1 text-base text-text-main outline-none placeholder:text-text-muted/60"
          />
        </div>

        {matches.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">{t('tool-github-html.ui.paletteEmpty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 overflow-auto p-3 sm:grid-cols-4">
            {matches.map((block, index) => (
              <BlockTile
                key={block.id}
                block={block}
                label={labels[block.id]}
                body={bodies[block.id]}
                selected={index === Math.min(cursor, matches.length - 1)}
                onSelect={(picked) => { onSelect(picked); onClose(); }}
              />
            ))}
          </div>
        )}

        <p className="flex flex-wrap gap-4 border-t border-border px-3 py-2 text-[0.72rem] text-text-muted">
          <span>{t('tool-github-html.ui.paletteHintMove')}</span>
          <span>{t('tool-github-html.ui.paletteHintInsert')}</span>
          <span>{t('tool-github-html.ui.paletteHintClose')}</span>
        </p>
      </div>
    </div>
  );
}
