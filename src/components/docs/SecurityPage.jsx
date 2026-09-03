import React from 'react';
import { useTranslation } from 'react-i18next';
import DocumentPage, { DocumentIntro, DocumentSections } from './DocumentPage.jsx';
import { getDocumentSourceUrl } from '../../lib/projectLinks.js';

export default function SecurityPage() {
  const { t, i18n } = useTranslation(['docs', 'tools']);
  return (
    <DocumentPage
      title={t('tools:security.title')}
      updated={t('docs:security.updated')}
      sourceUrl={getDocumentSourceUrl('security', i18n.resolvedLanguage)}
    >
      <DocumentIntro>{t('docs:security.intro')}</DocumentIntro>
      <DocumentSections sections={t('docs:security.sections', { returnObjects: true })} />
    </DocumentPage>
  );
}
