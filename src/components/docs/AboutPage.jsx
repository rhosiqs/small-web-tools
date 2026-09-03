import React from 'react';
import { useTranslation } from 'react-i18next';
import DocumentPage, { DocumentIntro, DocumentSections } from './DocumentPage.jsx';
import { getDocumentSourceUrl } from '../../lib/projectLinks.js';

export default function AboutPage() {
  const { t, i18n } = useTranslation(['docs', 'tools']);
  return (
    <DocumentPage
      title={t('tools:about.title')}
      updated={t('docs:about.updated')}
      sourceUrl={getDocumentSourceUrl('about', i18n.resolvedLanguage)}
    >
      <DocumentIntro>{t('docs:about.intro')}</DocumentIntro>
      <DocumentSections sections={t('docs:about.sections', { returnObjects: true })} />
    </DocumentPage>
  );
}
