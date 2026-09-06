import React from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE } from '../../i18n/index.js';

/**
 * Shared layout for every routed document page.
 *
 * Document pages are read, not operated: they use a single reading column with
 * an ordinary page scroll instead of the tool `Card` shell. `legal` adds the
 * translation notice required whenever a document with legal effect is shown in
 * a language other than the English original.
 *
 * @typedef {{
 *   title: string,
 *   updated: string,
 *   legal?: boolean,
 *   sourceUrl?: string | null,
 *   children?: React.ReactNode,
 * }} DocumentPageProps
 */

/** @param {DocumentPageProps} props */
export default function DocumentPage({ title, updated, legal = false, sourceUrl = null, children }) {
  const { t, i18n } = useTranslation('docs');
  const isTranslation = i18n.resolvedLanguage !== DEFAULT_LOCALE;
  return (
    <article className="mx-auto flex w-full max-w-[820px] flex-col gap-8 pb-10 text-[0.92rem] leading-7 text-text-main">
      <header className="flex flex-col gap-2 border-b border-border pb-5">
        <h1 className="m-0 text-3xl font-bold tracking-tight max-md:text-2xl">{title}</h1>
        <p className="m-0 text-xs text-text-muted">{t('meta.lastUpdated', { date: updated })}</p>
        {legal && isTranslation && (
          <p className="m-0 rounded-lg border border-border bg-app px-3 py-2 text-xs text-text-muted">
            {t('meta.translationNotice')}
          </p>
        )}
      </header>
      <div className="flex flex-col gap-8">{children}</div>
      {sourceUrl && (
        <footer className="border-t border-border pt-4">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-accent hover:underline"
          >
            {t('meta.sourceLink')} ↗
          </a>
        </footer>
      )}
    </article>
  );
}

/**
 * i18next hands back a translation object for `returnObjects` lookups, so the
 * document bodies are normalized before rendering.
 *
 * @param {unknown} value
 * @returns {any[]}
 */
export function toDocumentArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Heading-and-paragraphs body shared by the prose document pages.
 *
 * @param {{ sections: unknown }} props
 */
export function DocumentSections({ sections }) {
  return (
    <>
      {toDocumentArray(sections).map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="m-0 text-lg font-semibold text-text-main">{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="m-0 text-text-muted">{paragraph}</p>
          ))}
        </section>
      ))}
    </>
  );
}

/** @param {{ children: React.ReactNode }} props */
export function DocumentIntro({ children }) {
  return <p className="m-0 text-text-main">{children}</p>;
}
