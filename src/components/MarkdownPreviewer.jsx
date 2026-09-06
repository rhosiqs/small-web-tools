import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';
import Card from './ui/Card';
import FullscreenPreview, { FullscreenPreviewButton } from './ui/FullscreenPreview';
import ToolHeader from './ui/ToolHeader';
import { highlightCode, normalizeCodeLanguage } from '../lib/codeHighlighting.js';
import { grantConsent, hasConsent, revokeConsent } from '../lib/thirdPartyServices';
import {
  MARKDOWN_FILE_LIMIT_BYTES,
  REMOTE_IMAGE_SERVICE_ID,
  normalizeMarkdownFilename,
  parseMarkdown,
} from './MarkdownPreviewer/lib/markdownDomain';

const IMAGE_PLACEHOLDER_KEYS = {
  consent: 'tool-markdown.ui.imagePlaceholder.consent',
  blockedHost: 'tool-markdown.ui.imagePlaceholder.blockedHost',
  relative: 'tool-markdown.ui.imagePlaceholder.relative',
  unsupported: 'tool-markdown.ui.imagePlaceholder.unsupported',
};

const HTML_PROP_NAMES = { colspan: 'colSpan', rowspan: 'rowSpan' };

function PreviewImage({ image }) {
  const { t } = useTranslation('tools');
  const alt = image.alt || t('tool-markdown.ui.untitledImage');

  if (image.render) {
    return <img src={image.href} alt={alt} title={image.title} width={image.width} height={image.height} loading="lazy" referrerPolicy="no-referrer" className="inline-block max-w-full align-middle" />;
  }

  return (
    <span title={image.href || undefined} className="inline-flex items-center rounded border border-border bg-app px-2 py-1 text-xs text-text-muted">
      {t(IMAGE_PLACEHOLDER_KEYS[image.reason] || IMAGE_PLACEHOLDER_KEYS.unsupported, { alt })}
    </span>
  );
}

/**
 * Render the allow-listed nodes the document's raw HTML produced. Every element
 * is created here from the sanitized tree, so no markup string is ever injected.
 */
function HtmlNodes({ nodes }) {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`;
    if (node.type === 'inline') return <InlinePreview key={key} tokens={node.inline} />;
    if (node.type === 'image') return <PreviewImage key={key} image={node} />;

    const props = { key };
    for (const [attribute, value] of Object.entries(node.attributes)) {
      if (attribute === 'align') props.style = { textAlign: value };
      else if (attribute === 'open') props.open = true;
      else props[HTML_PROP_NAMES[attribute] || attribute] = value;
    }
    if (node.name === 'a' && /^https?:/i.test(node.attributes.href || '')) {
      props.target = '_blank';
      props.rel = 'noreferrer';
    }

    return React.createElement(
      node.name,
      props,
      node.children.length > 0 ? <HtmlNodes nodes={node.children} /> : undefined,
    );
  });
}

function InlinePreview({ tokens }) {
  return tokens.map((token, index) => {
    const key = `${token.type}-${index}`;
    if (token.type === 'code') return <code key={key} className="rounded bg-app px-1.5 py-0.5 font-mono text-[0.9em] text-accent">{token.value}</code>;
    if (token.type === 'strong') return <strong key={key}>{token.value}</strong>;
    if (token.type === 'emphasis') return <em key={key}>{token.value}</em>;
    if (token.type === 'strike') return <del key={key}>{token.value}</del>;
    if (token.type === 'link') {
      return token.href ? <a key={key} href={token.href} target={/^https?:/i.test(token.href) ? '_blank' : undefined} rel={/^https?:/i.test(token.href) ? 'noreferrer' : undefined} className="font-semibold text-accent underline decoration-accent/40 underline-offset-2 hover:text-accent-hover">{token.value}</a> : <span key={key}>{token.value}</span>;
    }
    if (token.type === 'image') return <PreviewImage key={key} image={token} />;
    if (token.type === 'html') return <span key={key} className="markdown-html"><HtmlNodes nodes={[token.node]} /></span>;
    return <React.Fragment key={key}>{token.value}</React.Fragment>;
  });
}

function MarkdownPreview({ blocks, previewRef, onScroll = undefined, className = '' }) {
  const { t } = useTranslation('tools');
  if (blocks.length === 0) {
    return <div ref={previewRef} onScroll={onScroll} aria-label={t('tool-markdown.ui.previewAria')} className={`flex h-full min-h-0 items-center justify-center overflow-auto p-8 text-center text-sm text-text-muted ${className}`}>{t('tool-markdown.ui.emptyPreview')}</div>;
  }

  return (
    <div ref={previewRef} onScroll={onScroll} aria-label={t('tool-markdown.ui.previewAria')} className={`relative h-full min-h-0 space-y-4 overflow-auto p-5 text-[0.95rem] leading-7 text-text-main ${className}`}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        const sourceProps = { 'data-source-start-line': block.startLine, 'data-source-end-line': block.endLine };
        if (block.type === 'heading') {
          const classes = { 1: 'text-3xl', 2: 'text-2xl', 3: 'text-xl', 4: 'text-lg', 5: 'text-base', 6: 'text-sm' };
          return React.createElement(`h${block.level}`, { key, ...sourceProps, className: `${classes[block.level]} font-extrabold leading-tight text-text-main` }, <InlinePreview tokens={block.inline} />);
        }
        if (block.type === 'paragraph') return <p key={key} {...sourceProps} className="whitespace-pre-wrap"><InlinePreview tokens={block.inline} /></p>;
        if (block.type === 'quote') return <blockquote key={key} {...sourceProps} className="whitespace-pre-wrap border-l-4 border-accent bg-accent-light/40 px-4 py-2 text-text-muted"><InlinePreview tokens={block.inline} /></blockquote>;
        if (block.type === 'rule') return <hr key={key} {...sourceProps} className="border-border" />;
        if (block.type === 'html') return <div key={key} {...sourceProps} className="markdown-html"><HtmlNodes nodes={block.nodes} /></div>;
        if (block.type === 'codeBlock') {
          const language = normalizeCodeLanguage(block.language);
          return (
            <div key={key} {...sourceProps} className="code-preview-syntax overflow-hidden rounded-lg border border-border bg-app" data-code-theme="dark">
              {block.language && <div className="border-b border-border px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-text-muted">{block.language}</div>}
              <pre className="overflow-x-auto p-4 text-sm leading-6"><code data-language={language} dangerouslySetInnerHTML={{ __html: highlightCode(block.value, language) }} /></pre>
            </div>
          );
        }
        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return <ListTag key={key} {...sourceProps} className={`space-y-1 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>{block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`} className={item.task ? 'list-none' : ''}>{item.task && <input type="checkbox" checked={item.checked} readOnly aria-label={t(item.checked ? 'tool-markdown.ui.completedTask' : 'tool-markdown.ui.incompleteTask')} className="mr-2 accent-accent" />}<InlinePreview tokens={item.inline} /></li>)}</ListTag>;
        }
        if (block.type === 'table') {
          return <div key={key} {...sourceProps} className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[420px] border-collapse text-sm"><thead className="bg-app"><tr>{block.header.map((cell, cellIndex) => <th key={`${key}-head-${cellIndex}`} className="border-b border-border px-3 py-2 font-bold" style={{ textAlign: block.alignments[cellIndex] || 'left' }}><InlinePreview tokens={cell} /></th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={`${key}-row-${rowIndex}`} className="border-b border-border last:border-b-0">{block.header.map((_, cellIndex) => <td key={`${key}-cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top" style={{ textAlign: block.alignments[cellIndex] || 'left' }}><InlinePreview tokens={row[cellIndex] || []} /></td>)}</tr>)}</tbody></table></div>;
        }
        return null;
      })}
    </div>
  );
}

const FORMAT_ACTIONS = [
  { key: 'heading', prefix: '## ', suffix: '' },
  { key: 'bold', prefix: '**', suffix: '**' },
  { key: 'italic', prefix: '*', suffix: '*' },
  { key: 'link', prefix: '[', suffix: '](url)' },
  { key: 'code', prefix: '`', suffix: '`' },
];

export default function MarkdownPreviewer() {
  const { t, i18n } = useTranslation('tools');
  const [markdown, setMarkdown] = useState('');
  const [filename, setFilename] = useState('document.md');
  const [status, setStatus] = useState('');
  const [focusedPanel, setFocusedPanel] = useState(null);
  const textareaRef = useRef(null);
  const fullscreenTextareaRef = useRef(null);
  const previewRef = useRef(null);
  const fullscreenPreviewRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeScrollRef = useRef(null);
  const editorScrollRef = useRef({ top: 0, left: 0 });
  const previewScrollRef = useRef({ top: 0, left: 0 });
  const [allowRemoteImages, setAllowRemoteImages] = useState(() => hasConsent(REMOTE_IMAGE_SERVICE_ID));
  const blocks = useMemo(() => parseMarkdown(markdown, { allowRemoteImages }), [markdown, allowRemoteImages]);

  useEffect(() => {
    const handleConsentUpdate = () => setAllowRemoteImages(hasConsent(REMOTE_IMAGE_SERVICE_ID));
    window.addEventListener('consent_updated', handleConsentUpdate);
    return () => window.removeEventListener('consent_updated', handleConsentUpdate);
  }, []);

  const toggleRemoteImages = () => {
    if (allowRemoteImages) {
      revokeConsent(REMOTE_IMAGE_SERVICE_ID);
      setStatus(t('tool-markdown.ui.status.remoteImagesDisabled'));
      return;
    }
    grantConsent(REMOTE_IMAGE_SERVICE_ID);
    setStatus(t('tool-markdown.ui.status.remoteImagesEnabled'));
  };

  const syncEditorToPreview = (editor, preview) => {
    if (!editor || !preview || activeScrollRef.current === 'editor') { activeScrollRef.current = null; return; }
    const line = editor.scrollTop / 24;
    const elements = [...preview.querySelectorAll('[data-source-start-line]')];
    const element = elements.find((candidate) => line >= Number(candidate.dataset.sourceStartLine) && line <= Number(candidate.dataset.sourceEndLine)) || elements.findLast((candidate) => line >= Number(candidate.dataset.sourceStartLine));
    if (!element) return;
    const startLine = Number(element.dataset.sourceStartLine);
    const endLine = Number(element.dataset.sourceEndLine);
    const progress = Math.min(Math.max((line - startLine) / Math.max(endLine - startLine, 1), 0), 1);
    activeScrollRef.current = 'preview';
    preview.scrollTop = Math.min(element.offsetTop + (progress * element.offsetHeight), preview.scrollHeight - preview.clientHeight);
    requestAnimationFrame(() => { activeScrollRef.current = null; });
  };

  const syncPreviewToEditor = (preview, editor) => {
    if (!preview || !editor || activeScrollRef.current === 'preview') { activeScrollRef.current = null; return; }
    const elements = [...preview.querySelectorAll('[data-source-start-line]')];
    const element = elements.findLast((candidate) => candidate.offsetTop <= preview.scrollTop) || elements[0];
    if (!element) return;
    const startLine = Number(element.dataset.sourceStartLine);
    const endLine = Number(element.dataset.sourceEndLine);
    const progress = element.offsetHeight > 0 ? Math.min(Math.max((preview.scrollTop - element.offsetTop) / element.offsetHeight, 0), 1) : 0;
    activeScrollRef.current = 'editor';
    editor.scrollTop = Math.min((startLine + (progress * Math.max(endLine - startLine, 0))) * 24, editor.scrollHeight - editor.clientHeight);
    requestAnimationFrame(() => { activeScrollRef.current = null; });
  };

  const openFocusedPanel = (panel) => {
    if (panel === 'editor' && textareaRef.current) editorScrollRef.current = { top: textareaRef.current.scrollTop, left: textareaRef.current.scrollLeft };
    if (panel === 'preview' && previewRef.current) previewScrollRef.current = { top: previewRef.current.scrollTop, left: previewRef.current.scrollLeft };
    setFocusedPanel(panel);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (panel === 'editor' && fullscreenTextareaRef.current) Object.assign(fullscreenTextareaRef.current, { scrollTop: editorScrollRef.current.top, scrollLeft: editorScrollRef.current.left });
      if (panel === 'preview' && fullscreenPreviewRef.current) Object.assign(fullscreenPreviewRef.current, { scrollTop: previewScrollRef.current.top, scrollLeft: previewScrollRef.current.left });
    }));
  };

  const closeFocusedPanel = () => {
    if (focusedPanel === 'editor' && fullscreenTextareaRef.current) editorScrollRef.current = { top: fullscreenTextareaRef.current.scrollTop, left: fullscreenTextareaRef.current.scrollLeft };
    if (focusedPanel === 'preview' && fullscreenPreviewRef.current) previewScrollRef.current = { top: fullscreenPreviewRef.current.scrollTop, left: fullscreenPreviewRef.current.scrollLeft };
    const previous = focusedPanel;
    setFocusedPanel(null);
    requestAnimationFrame(() => {
      if (previous === 'editor' && textareaRef.current) Object.assign(textareaRef.current, { scrollTop: editorScrollRef.current.top, scrollLeft: editorScrollRef.current.left });
      if (previous === 'preview' && previewRef.current) Object.assign(previewRef.current, { scrollTop: previewScrollRef.current.top, scrollLeft: previewScrollRef.current.left });
    });
  };

  const insertFormat = ({ key, prefix, suffix }) => {
    const textarea = focusedPanel === 'editor' ? fullscreenTextareaRef.current : textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = markdown.slice(start, end) || t(`tool-markdown.ui.format.${key}.placeholder`);
    setMarkdown(`${markdown.slice(0, start)}${prefix}${selected}${suffix}${markdown.slice(end)}`);
    setStatus(t('tool-markdown.ui.status.formatApplied'));
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); });
  };

  const handlePaste = async () => {
    try { setMarkdown(await navigator.clipboard.readText()); setStatus(t('tool-markdown.ui.status.pasted')); } catch { setStatus(t('tool-markdown.ui.status.clipboardDenied')); }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(?:md|markdown)$/i.test(file.name)) { setStatus(t('tool-markdown.ui.status.invalidFile')); return; }
    if (file.size > MARKDOWN_FILE_LIMIT_BYTES) { setStatus(t('tool-markdown.ui.status.fileTooLarge')); return; }
    try { setMarkdown(await file.text()); setFilename(normalizeMarkdownFilename(file.name)); setStatus(t('tool-markdown.ui.status.loaded', { filename: file.name })); } catch { setStatus(t('tool-markdown.ui.status.readFailed')); }
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = normalizeMarkdownFilename(filename);
    document.body.appendChild(anchor);
    anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    setStatus(t('tool-markdown.ui.status.downloaded', { filename: anchor.download }));
  };

  const handleClear = () => { setFocusedPanel(null); setMarkdown(''); setFilename('document.md'); setStatus(t('tool-markdown.ui.status.cleared')); textareaRef.current?.focus(); };
  const handleEditorChange = (event) => { setMarkdown(event.target.value); setStatus(''); };

  return (
    <Card id="tool-markdown" variant="tool" size="wide" className="max-w-[1180px]">
      <ToolHeader title={t('tool-markdown.title')} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-app/60 p-3">
        <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" size="sm" onClick={handlePaste}>{t('tool-markdown.ui.paste')}</Button><Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>{t('tool-markdown.ui.upload')}</Button><input ref={fileInputRef} type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={handleFile} className="hidden" aria-label={t('tool-markdown.ui.uploadAria')} /><Button type="button" variant="secondary" size="sm" aria-pressed={allowRemoteImages} onClick={toggleRemoteImages}>{t(allowRemoteImages ? 'tool-markdown.ui.remoteImages.disable' : 'tool-markdown.ui.remoteImages.enable')}</Button></div>
        <div className="flex flex-wrap items-center gap-2"><label htmlFor="markdown-filename" className="sr-only">{t('tool-markdown.ui.downloadFilename')}</label><input id="markdown-filename" value={filename} onChange={(event) => setFilename(event.target.value)} className="w-40 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-text-main outline-none focus:border-accent focus:ring-2 focus:ring-focus" aria-label={t('tool-markdown.ui.downloadFilename')} /><Button type="button" variant="primary" size="sm" onClick={handleDownload} disabled={!markdown}>{t('tool-markdown.ui.download')}</Button><Button type="button" variant="secondary" size="sm" onClick={handleClear} disabled={!markdown}>{t('tool-markdown.ui.clear')}</Button></div>
      </div>
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label={t('tool-markdown.ui.formattingAria')}>{FORMAT_ACTIONS.map((action) => <Button key={action.key} type="button" variant="secondary" size="sm" onClick={() => insertFormat(action)} aria-label={t('tool-markdown.ui.formatAs', { format: t(`tool-markdown.ui.format.${action.key}.label`) })}>{t(`tool-markdown.ui.format.${action.key}.label`)}</Button>)}</div>
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:h-[560px] lg:grid-cols-2">
        <section className="flex min-h-[420px] min-w-0 flex-col border-b border-border lg:min-h-0 lg:border-b-0 lg:border-r" aria-labelledby="markdown-editor-title">
          <div className="relative flex min-h-12 items-center justify-between border-b border-border bg-app/70 px-4 py-2 pr-14"><h3 id="markdown-editor-title" className="text-sm font-bold text-text-main">{t('tool-markdown.ui.editorTitle')}</h3><span className="text-xs tabular-nums text-text-muted">{t('tool-markdown.ui.characterCount', { count: markdown.length.toLocaleString(i18n.language) })}</span><FullscreenPreviewButton label={`${t('tool-markdown.ui.editorTitle')} — ${t('tool-markdown.ui.previewTitle')}`} onClick={() => openFocusedPanel('editor')} /></div>
          <textarea ref={textareaRef} value={markdown} onChange={handleEditorChange} onScroll={(event) => { editorScrollRef.current = { top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft }; syncEditorToPreview(event.currentTarget, previewRef.current); }} spellCheck={false} wrap="off" aria-label={t('tool-markdown.ui.editorAria')} placeholder={t('tool-markdown.ui.editorPlaceholder')} className="min-h-0 flex-1 resize-none overflow-auto border-0 bg-transparent p-4 font-mono text-sm leading-6 text-text-main outline-none placeholder:text-text-muted/50 focus:ring-0" />
        </section>
        <section className="flex min-h-[420px] min-w-0 flex-col bg-accent-light/10 lg:min-h-0" aria-labelledby="markdown-preview-title">
          <div className="relative flex min-h-12 items-center border-b border-border bg-app/45 px-4 py-2 pr-14"><h3 id="markdown-preview-title" className="text-sm font-bold text-text-main">{t('tool-markdown.ui.previewTitle')}</h3><FullscreenPreviewButton label={`${t('tool-markdown.ui.previewTitle')} — ${t('tool-markdown.ui.editorTitle')}`} onClick={() => openFocusedPanel('preview')} /></div>
          <div className="min-h-0 flex-1"><MarkdownPreview blocks={blocks} previewRef={previewRef} onScroll={(event) => { previewScrollRef.current = { top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft }; syncPreviewToEditor(event.currentTarget, textareaRef.current); }} /></div>
        </section>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted"><p>{t('tool-markdown.ui.privacyNote')}</p><p role="status" aria-live="polite">{status}</p></div>

      <FullscreenPreview open={focusedPanel === 'editor'} onClose={closeFocusedPanel} title={t('tool-markdown.ui.editorTitle')} surfaceClassName="bg-card !p-0">
        <textarea ref={fullscreenTextareaRef} value={markdown} onChange={handleEditorChange} onScroll={(event) => { editorScrollRef.current = { top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft }; syncEditorToPreview(event.currentTarget, previewRef.current); }} spellCheck={false} wrap="off" aria-label={t('tool-markdown.ui.editorAria')} placeholder={t('tool-markdown.ui.editorPlaceholder')} className="h-[80vh] min-h-[420px] w-full resize-none overflow-auto rounded-lg border-0 bg-card p-5 font-mono text-sm leading-6 text-text-main outline-none focus:ring-2 focus:ring-focus" />
      </FullscreenPreview>
      <FullscreenPreview open={focusedPanel === 'preview'} onClose={closeFocusedPanel} title={t('tool-markdown.ui.previewTitle')} surfaceClassName="bg-card !p-0">
        <div className="h-[80vh] min-h-[420px] w-full"><MarkdownPreview blocks={blocks} previewRef={fullscreenPreviewRef} className="rounded-lg bg-card" /></div>
      </FullscreenPreview>
    </Card>
  );
}
