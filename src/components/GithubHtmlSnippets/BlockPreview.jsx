import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Renders a composed README.
 *
 * Sanitized HTML nodes and parsed Markdown blocks both become real React
 * elements — there is no `dangerouslySetInnerHTML` on this path, so markup that
 * survived the allow-list still cannot introduce behavior.
 *
 * Images are never fetched. Like the Markdown Previewer, a remote badge or
 * screenshot renders as a labelled placeholder, which keeps the tool free of any
 * third-party request.
 */

/** HTML attribute names that React spells differently. */
const REACT_ATTRIBUTE_NAMES = { colspan: 'colSpan', rowspan: 'rowSpan', srcset: 'srcSet' };

/** Wrappers whose only job is to hold an `<img>`, which becomes the placeholder. */
const TRANSPARENT_TAGS = new Set(['picture', 'source']);

const ALERT_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;

/** Elements a browser parser tidies up before it builds their children. */
const TABLE_CONTEXT_TAGS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup']);

/**
 * Applies the two table fix-ups a browser parser performs and React does not.
 *
 * Sanitized markup keeps the line breaks and indentation the author typed, and
 * `<table>` followed by an indented `<tr>` is the shape every table block in the
 * catalogue has. Rendered as-is, React reports the whitespace between the tags
 * and the row that sits directly under `<table>` as invalid nesting, so the
 * whitespace is dropped and loose rows are collected into a `<tbody>` — exactly
 * what the browser does with the same markup, and what GitHub therefore shows.
 *
 * @param {string} tag lowercase tag of the element about to be created
 * @param {object[]} children its sanitized child nodes
 * @param {(child: object) => string | undefined} tagOf reads a child's tag, which the two node shapes spell differently
 * @param {(rows: object[]) => object} rowSection builds the wrapping `<tbody>` in the caller's node shape
 * @returns {object[]} children that nest validly
 */
function tableSafeChildren(tag, children, tagOf, rowSection) {
  if (!TABLE_CONTEXT_TAGS.has(tag)) return children;

  const kept = children.filter((child) => child.type !== 'text' || child.value.trim() !== '');
  if (tag !== 'table') return kept;

  const grouped = [];
  let rows = null;
  for (const child of kept) {
    if (tagOf(child) === 'tr') {
      if (!rows) rows = [];
      rows.push(child);
      continue;
    }
    if (rows) {
      grouped.push(rowSection(rows));
      rows = null;
    }
    grouped.push(child);
  }
  if (rows) grouped.push(rowSection(rows));
  return grouped;
}

function ImagePlaceholder({ alt }) {
  const { t } = useTranslation('tools');
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-dashed border-border-hover bg-app px-2 py-1 text-xs text-text-muted">
      {t('tool-github-html.ui.imagePlaceholder', { alt: alt || t('tool-github-html.ui.untitledImage') })}
    </span>
  );
}

function InlineTokens({ tokens }) {
  const { t } = useTranslation('tools');
  return tokens.map((token, index) => {
    const key = `${token.type}-${index}`;
    if (token.type === 'code') {
      return <code key={key} className="rounded bg-app px-1.5 py-0.5 font-mono text-[0.9em] text-accent">{token.value}</code>;
    }
    if (token.type === 'strong') return <strong key={key}>{token.value}</strong>;
    if (token.type === 'emphasis') return <em key={key}>{token.value}</em>;
    if (token.type === 'strike') return <del key={key}>{token.value}</del>;
    if (token.type === 'image') return <ImagePlaceholder key={key} alt={token.alt} />;
    if (token.type === 'html') return <DomainHtmlNode key={key} node={token.node} />;
    if (token.type === 'link') {
      if (!token.href) return <span key={key}>{token.value}</span>;
      const external = /^https?:/i.test(token.href);
      return (
        <a
          key={key}
          href={token.href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
          className="font-semibold text-accent underline decoration-accent/40 underline-offset-2 hover:text-accent-hover"
        >
          {token.value || t('tool-github-html.ui.untitledLink')}
        </a>
      );
    }
    return <React.Fragment key={key}>{token.value}</React.Fragment>;
  });
}

function reactProps(tag, attributes) {
  const props = {};
  for (const [name, value] of Object.entries(attributes || {})) {
    if (name === 'open') {
      props.open = true;
      continue;
    }
    props[REACT_ATTRIBUTE_NAMES[name] || name] = value;
  }
  if (tag === 'a' && /^https?:/i.test(attributes?.href || '')) {
    props.target = '_blank';
    props.rel = 'noreferrer';
  }
  return props;
}

/**
 * Renders the node shape the Markdown Previewer's parser produces.
 *
 * Inline HTML inside a paragraph (`press <kbd>Ctrl</kbd> now`) never reaches
 * this tool's own splitter — it arrives already parsed and sanitized as an
 * `html` token from the shared Markdown domain, which spells its nodes
 * `name`/`inline` where this file spells them `tag`/`text`. Without this branch
 * that markup would silently vanish from the preview.
 */
function DomainHtmlNode({ node }) {
  if (node.type === 'text') return <React.Fragment>{node.value}</React.Fragment>;
  if (node.type === 'inline') return <InlineTokens tokens={node.inline} />;
  if (node.type === 'image') return <ImagePlaceholder alt={node.alt} />;
  if (node.type !== 'element') return null;
  if (node.name === 'img') return <ImagePlaceholder alt={node.attributes?.alt} />;
  if (TRANSPARENT_TAGS.has(node.name)) {
    return node.children?.map((child, index) => <DomainHtmlNode key={index} node={child} />);
  }

  const children = tableSafeChildren(
    node.name,
    node.children || [],
    (child) => child.name,
    (rows) => ({ type: 'element', name: 'tbody', attributes: {}, children: rows }),
  );

  return React.createElement(
    node.name,
    reactProps(node.name, node.attributes),
    children.length > 0
      ? children.map((child, index) => <DomainHtmlNode key={index} node={child} />)
      : undefined,
  );
}

function HtmlNodes({ nodes }) {
  return nodes.map((node, index) => {
    if (node.type === 'text') return <React.Fragment key={`text-${index}`}>{node.value}</React.Fragment>;

    const key = `${node.tag}-${index}`;
    if (node.tag === 'img') return <ImagePlaceholder key={key} alt={node.attributes.alt} />;
    if (TRANSPARENT_TAGS.has(node.tag)) return <HtmlNodes key={key} nodes={node.children} />;

    const children = tableSafeChildren(
      node.tag,
      node.children,
      (child) => child.tag,
      (rows) => ({ type: 'element', tag: 'tbody', attributes: {}, children: rows }),
    );

    return React.createElement(
      node.tag,
      { key, ...reactProps(node.tag, node.attributes) },
      children.length > 0 ? <HtmlNodes nodes={children} /> : undefined,
    );
  });
}

const HEADING_SIZES = { 1: 'text-3xl', 2: 'text-2xl', 3: 'text-xl', 4: 'text-lg', 5: 'text-base', 6: 'text-sm' };

function MarkdownBlock({ block }) {
  const { t } = useTranslation('tools');

  if (block.type === 'heading') {
    return React.createElement(
      `h${block.level}`,
      { className: `${HEADING_SIZES[block.level]} font-extrabold leading-tight text-text-main` },
      <InlineTokens tokens={block.inline} />,
    );
  }
  if (block.type === 'paragraph') {
    return <p className="whitespace-pre-wrap"><InlineTokens tokens={block.inline} /></p>;
  }
  if (block.type === 'rule') return <hr className="border-border" />;
  if (block.type === 'html') {
    return block.nodes.map((node, index) => <DomainHtmlNode key={index} node={node} />);
  }
  if (block.type === 'quote') {
    // GitHub's alert syntax arrives as an ordinary quote, so the callout is
    // recognised here rather than in the shared Markdown parser.
    const leading = block.inline[0];
    const alert = leading?.type === 'text' ? leading.value.match(ALERT_PATTERN) : null;
    if (alert) {
      const tokens = [{ ...leading, value: leading.value.replace(ALERT_PATTERN, '') }, ...block.inline.slice(1)];
      return (
        <div className="rounded-r-lg border-l-4 border-accent bg-accent-light/40 px-4 py-2">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">
            {t(`tool-github-html.ui.alert.${alert[1].toLowerCase()}`)}
          </p>
          <div className="whitespace-pre-wrap text-text-muted"><InlineTokens tokens={tokens} /></div>
        </div>
      );
    }
    return (
      <blockquote className="whitespace-pre-wrap border-l-4 border-border-hover px-4 py-2 text-text-muted">
        <InlineTokens tokens={block.inline} />
      </blockquote>
    );
  }
  if (block.type === 'codeBlock') {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-app">
        {block.language && (
          <div className="border-b border-border px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-text-muted">
            {block.language}
          </div>
        )}
        <pre className="overflow-x-auto p-4 text-sm leading-6"><code>{block.value}</code></pre>
      </div>
    );
  }
  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul';
    return (
      <ListTag className={`space-y-1 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
        {block.items.map((item, index) => (
          <li key={index} className={item.task ? 'list-none' : ''}>
            {item.task && (
              <input
                type="checkbox"
                checked={item.checked}
                readOnly
                aria-label={t(item.checked ? 'tool-github-html.ui.completedTask' : 'tool-github-html.ui.incompleteTask')}
                className="mr-2 accent-accent"
              />
            )}
            <InlineTokens tokens={item.inline} />
          </li>
        ))}
      </ListTag>
    );
  }
  if (block.type === 'table') {
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead className="bg-app">
            <tr>
              {block.header.map((cell, index) => (
                <th key={index} className="border-b border-border px-3 py-2 font-bold" style={{ textAlign: block.alignments[index] || 'left' }}>
                  <InlineTokens tokens={cell} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border last:border-b-0">
                {block.header.map((_, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 align-top" style={{ textAlign: block.alignments[cellIndex] || 'left' }}>
                    <InlineTokens tokens={row[cellIndex] || []} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

export default function BlockPreview({ segments, className = '', previewRef = undefined }) {
  const { t } = useTranslation('tools');

  if (segments.length === 0) {
    return (
      <div
        ref={previewRef}
        aria-label={t('tool-github-html.ui.previewAria')}
        className={`flex h-full min-h-0 items-center justify-center overflow-auto p-8 text-center text-sm text-text-muted ${className}`}
      >
        {t('tool-github-html.ui.emptyPreview')}
      </div>
    );
  }

  return (
    <div
      ref={previewRef}
      aria-label={t('tool-github-html.ui.previewAria')}
      className={`h-full min-h-0 space-y-4 overflow-auto p-5 text-[0.95rem] leading-7 text-text-main ${className}`}
    >
      {segments.map((segment, index) => (
        segment.kind === 'html'
          ? <div key={index}><HtmlNodes nodes={segment.nodes} /></div>
          : segment.blocks.map((block, blockIndex) => <MarkdownBlock key={`${index}-${blockIndex}`} block={block} />)
      ))}
    </div>
  );
}
