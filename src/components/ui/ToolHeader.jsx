import React from 'react';

/**
 * Shared page identity for every routed tool.
 *
 * Tool pages intentionally contain only a title and the tool itself. Supporting
 * labels and instructions belong inside the feature UI, not in this header.
 *
 * Passing a `kicker` (the tool's category) switches the header to the layout the
 * conversion-tool blueprint uses: the category set small above the title, with
 * the rule dropped so the screen carries a single frame. The title itself keeps
 * the type the rest of the site sets it in, so a converter page and a page like
 * Website Font Extractor read as the same heading. Tools that pass no kicker
 * keep the bordered header unchanged.
 */
export default function ToolHeader({ title, kicker = null, className = '' }) {
  if (kicker) {
    return (
      <header className={['tool-header', className].filter(Boolean).join(' ')}>
        <p className="m-0 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-accent">
          {kicker}
        </p>
        <h1 className="m-0 mt-2 text-2xl font-bold tracking-tight text-text-main">
          {title}
        </h1>
      </header>
    );
  }

  return (
    <header className={['tool-header pb-2 border-b border-border', className].filter(Boolean).join(' ')}>
      <h1 className="text-2xl font-bold tracking-tight text-text-main m-0">{title}</h1>
    </header>
  );
}
