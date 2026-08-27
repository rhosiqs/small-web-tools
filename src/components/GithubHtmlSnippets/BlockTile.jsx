import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BlockPreview from './BlockPreview.jsx';
import { composeDocument } from './lib/composeDocument.js';
import { fillTemplate } from './lib/blockCatalog.js';

/**
 * One block, shown as a picture of itself.
 *
 * The thumbnail is the block's own markup run through the same renderer as the
 * preview pane, so what you click is close to what you get. Deliberately
 * wordless: the name reaches assistive technology and the hover tooltip through
 * `aria-label` and `title`, and never takes space on screen.
 *
 * The one mark a tile does carry is a dot for blocks GitHub strips. It comes
 * from running the block's real markup through the sanitizer rather than from a
 * hand-kept list, so it cannot disagree with the warning under the preview.
 */
export default function BlockTile({ block, label, body, selected = false, onSelect }) {
  const { t } = useTranslation('tools');

  const segments = useMemo(() => composeDocument(body).segments, [body]);

  const removed = useMemo(() => {
    const { droppedTags, droppedAttributes } = composeDocument(fillTemplate(block.template, { selection: 'x' }));
    return droppedTags.length > 0 || droppedAttributes.length > 0;
  }, [block.template]);

  const description = removed ? `${label} — ${t('tool-github-html.ui.removedByGithub')}` : label;

  return (
    <button
      type="button"
      onClick={() => onSelect(block)}
      title={description}
      aria-label={description}
      className={`group relative flex w-full flex-col rounded-lg border bg-card p-2 text-left transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-card ${
        selected ? 'border-accent ring-2 ring-focus' : 'border-border'
      }`}
    >
      {removed && (
        <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-warning-text" />
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none h-[62px] overflow-hidden rounded border border-border bg-app p-2 text-[10px] leading-snug"
      >
        <BlockPreview segments={segments} className="!space-y-1 !overflow-hidden !p-0 !text-[10px] !leading-snug" />
      </span>
    </button>
  );
}
