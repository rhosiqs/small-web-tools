import React from 'react';
import { useTranslation } from 'react-i18next';
import DocumentPage, { DocumentIntro, DocumentSections } from './DocumentPage.jsx';
import { getDocumentSourceUrl } from '../../lib/projectLinks.js';

export default function TermsPage() {
  const { t, i18n } = useTranslation(['docs', 'tools']);
  return (
    <DocumentPage
      legal
      title={t('tools:terms.title')}
      updated={t('docs:terms.updated')}
      sourceUrl={getDocumentSourceUrl('terms', i18n.resolvedLanguage)}
    >
      <DocumentIntro>{t('docs:terms.intro')}</DocumentIntro>
      <DocumentSections sections={t('docs:terms.sections', { returnObjects: true })} />
    </DocumentPage>
  );
}
