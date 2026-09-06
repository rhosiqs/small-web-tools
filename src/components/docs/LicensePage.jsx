import React from 'react';
import { useTranslation } from 'react-i18next';
import DocumentPage, { toDocumentArray } from './DocumentPage.jsx';
import { getDocumentSourceUrl } from '../../lib/projectLinks.js';
import { MIT_LICENSE_TEXT } from '../../lib/licenseText.js';

export default function LicensePage() {
  const { t, i18n } = useTranslation(['docs', 'tools']);
  const intro = toDocumentArray(t('docs:license.intro', { returnObjects: true }));
  return (
    <DocumentPage
      legal
      title={t('tools:license.title')}
      updated={t('docs:license.updated')}
      sourceUrl={getDocumentSourceUrl('license', i18n.resolvedLanguage)}
    >
      <section className="flex flex-col gap-2">
        {intro.map((paragraph) => <p key={paragraph} className="m-0 text-text-muted">{paragraph}</p>)}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="m-0 text-lg font-semibold text-text-main">{t('docs:license.textLabel')}</h2>
        <pre
          lang="en"
          className="m-0 overflow-x-auto rounded-xl border border-border bg-app p-4 font-mono text-xs leading-6 text-text-main"
        >
          {MIT_LICENSE_TEXT}
        </pre>
      </section>
    </DocumentPage>
  );
}
