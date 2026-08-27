import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';
import Card from './ui/Card';
import ToolHeader from './ui/ToolHeader';
import BlockPalette from './GithubHtmlSnippets/BlockPalette.jsx';
import BlockPreview from './GithubHtmlSnippets/BlockPreview.jsx';
import BlockTile from './GithubHtmlSnippets/BlockTile.jsx';
import { composeDocument } from './GithubHtmlSnippets/lib/composeDocument.js';
import { BLOCKS, PINNED_BLOCKS, fillTemplate, placeBlock } from './GithubHtmlSnippets/lib/blockCatalog.js';

/**
 * GitHub HTML Blocks — compose the raw HTML a README needs by stacking blocks.
 *
 * The editor and preview own the page; the blocks are pictures of themselves
 * with no labels, eight on the strip and the rest behind the palette. Clicking
 * a multi-line block stacks it below the caret's line rather than nesting it,
 * so a README builds up in the order you click.
 */
export default function GithubHtmlSnippets() {
  const { t, i18n } = useTranslation('tools');
  const [markdown, setMarkdown] = useState('');
  const [status, setStatus] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const textareaRef = useRef(null);
  const pendingSelectionRef = useRef(null);

  /**
   * Restores the caret after a block lands. It has to wait for React to write
   * the new text into the textarea, but not for a paint — a frame callback
   * never runs in a background tab, which would strand the caret.
   */
  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending) return;
    pendingSelectionRef.current = null;
    const target = textareaRef.current;
    if (!target) return;
    target.focus();
    target.setSelectionRange(pending.start, pending.end);
  });

  const labels = useMemo(
    () => Object.fromEntries(BLOCKS.map((block) => [block.id, t(`tool-github-html.blocks.${block.id}`)])),
    [t],
  );

  /**
   * What each block's thumbnail draws. Deliberately filled with neutral sample
   * text rather than the block's name, so a tile stays a picture of the shape
   * instead of quietly printing the label back onto the screen. A few blocks
   * render to nothing on their own and carry their own `sample` markup.
   */
  const thumbnails = useMemo(() => Object.fromEntries(BLOCKS.map((block) => {
    const values = { selection: t('tool-github-html.ui.sampleText') };
    for (const slot of block.slots || []) {
      values[slot] = t(`tool-github-html.slots.${block.id}.${slot}`);
    }
    return [block.id, fillTemplate(block.sample || block.template, values)];
  })), [t]);

  const { segments, droppedTags, droppedAttributes } = useMemo(() => composeDocument(markdown), [markdown]);

  const addBlock = useCallback((block) => {
    const textarea = textareaRef.current;
    const selectionStart = textarea ? textarea.selectionStart : markdown.length;
    const selectionEnd = textarea ? textarea.selectionEnd : markdown.length;
    const selected = markdown.slice(Math.min(selectionStart, selectionEnd), Math.max(selectionStart, selectionEnd));

    const values = { selection: selected || labels[block.id] };
    for (const slot of block.slots || []) {
      values[slot] = t(`tool-github-html.slots.${block.id}.${slot}`);
    }
    const body = fillTemplate(block.template, values);
    const next = placeBlock(markdown, selectionStart, selectionEnd, body);

    setMarkdown(next.text);
    setStatus(t(next.stacked ? 'tool-github-html.ui.status.stacked' : 'tool-github-html.ui.status.inserted', {
      block: labels[block.id],
    }));
    pendingSelectionRef.current = { start: next.selectionStart, end: next.selectionEnd };
  }, [labels, markdown, t]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setStatus(t('tool-github-html.ui.status.copied'));
    } catch {
      setStatus(t('tool-github-html.ui.status.copyDenied'));
    }
  };

  const handleClear = () => {
    setMarkdown('');
    setStatus(t('tool-github-html.ui.status.cleared'));
    textareaRef.current?.focus();
  };

  const handleShortcut = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setPaletteOpen(true);
    }
  };

  const removed = [
    ...droppedTags.map((tag) => `<${tag}>`),
    ...droppedAttributes.map((attribute) => `${attribute}="…"`),
  ];

  return (
    <Card id="tool-github-html" variant="tool" size="wide" className="max-w-[1180px]" onKeyDown={handleShortcut}>
      <ToolHeader title={t('tool-github-html.title')} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="primary" size="sm" onClick={() => setPaletteOpen(true)}>
          {t('tool-github-html.ui.openPalette')}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleCopy} disabled={!markdown}>
            {t('tool-github-html.ui.copy')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={handleClear} disabled={!markdown}>
            {t('tool-github-html.ui.clear')}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="toolbar" aria-label={t('tool-github-html.ui.stripAria')}>
        {PINNED_BLOCKS.map((block) => (
          <div key={block.id} className="w-[120px] flex-none">
            <BlockTile block={block} label={labels[block.id]} body={thumbnails[block.id]} onSelect={addBlock} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:h-[560px] lg:grid-cols-2">
        <section className="flex min-h-[380px] min-w-0 flex-col border-b border-border lg:min-h-0 lg:border-b-0 lg:border-r" aria-labelledby="github-html-editor-title">
          <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border bg-app/70 px-4 py-2">
            <h3 id="github-html-editor-title" className="text-sm font-bold text-text-main">
              {t('tool-github-html.ui.editorTitle')}
            </h3>
            <span className="text-xs tabular-nums text-text-muted">
              {t('tool-github-html.ui.characterCount', { count: markdown.length.toLocaleString(i18n.language) })}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(event) => { setMarkdown(event.target.value); setStatus(''); }}
            spellCheck={false}
            wrap="off"
            aria-label={t('tool-github-html.ui.editorAria')}
            placeholder={t('tool-github-html.ui.editorPlaceholder')}
            className="min-h-0 flex-1 resize-none overflow-auto border-0 bg-transparent p-4 font-mono text-sm leading-6 text-text-main outline-none placeholder:text-text-muted/50 focus:ring-0"
          />
        </section>

        <section className="flex min-h-[380px] min-w-0 flex-col bg-accent-light/10 lg:min-h-0" aria-labelledby="github-html-preview-title">
          <div className="flex min-h-12 items-center border-b border-border bg-app/45 px-4 py-2">
            <h3 id="github-html-preview-title" className="text-sm font-bold text-text-main">
              {t('tool-github-html.ui.previewTitle')}
            </h3>
          </div>
          {removed.length > 0 && (
            <p className="border-b border-warning-border bg-warning-bg px-4 py-2 text-xs text-warning-text">
              {t('tool-github-html.ui.githubDrops', { items: removed.join(', ') })}
            </p>
          )}
          <div className="min-h-0 flex-1">
            <BlockPreview segments={segments} className="github-html-preview" />
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <p>{t('tool-github-html.ui.privacyNote')}</p>
        <p role="status" aria-live="polite">{status}</p>
      </div>

      <BlockPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={addBlock}
        labels={labels}
        bodies={thumbnails}
      />
    </Card>
  );
}
