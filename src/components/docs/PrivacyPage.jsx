import React from 'react';
import { useTranslation } from 'react-i18next';
import DocumentPage, { DocumentIntro } from './DocumentPage.jsx';
import { NETWORK_SERVICES } from '../../lib/thirdPartyServices.js';
import { getDocumentSourceUrl } from '../../lib/projectLinks.js';

const HEADINGS = ['service', 'purpose', 'data', 'mode'];

/**
 * Provider policy link. Font Extractor points back at this page, so an internal
 * target must not open a new tab.
 *
 * @param {{ url: string, label: string }} props
 */
function ProviderPolicyLink({ url, label }) {
  const isExternal = url.startsWith('http');
  return (
    <a
      href={url}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="text-accent hover:underline"
    >
      {label}
    </a>
  );
}

export default function PrivacyPage({ onNavigateDocument }) {
  const { t, i18n } = useTranslation(['docs', 'tools']);
  const heading = (key) => t(`docs:privacy.heading.${key}`);
  const serviceText = (service, field) => t(`docs:services.${service.id}.${field}`);

  return (
    <DocumentPage
      legal
      title={t('tools:privacy.title')}
      updated={t('docs:privacy.updated')}
      sourceUrl={getDocumentSourceUrl('privacy', i18n.resolvedLanguage)}
    >
      <section className="flex flex-col gap-3">
        <DocumentIntro>{t('docs:privacy.intro')}</DocumentIntro>
        <p className="m-0 text-text-muted">{t('docs:privacy.consentExplanation')}</p>
        <button
          type="button"
          onClick={() => onNavigateDocument('consent')}
          className="self-start text-sm font-semibold text-accent hover:underline"
        >
          {t('docs:privacy.manageConsent')}
        </button>
      </section>

      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-app">
            <tr>
              {HEADINGS.map((key) => (
                <th key={key} className="border-b border-border p-3 font-bold">{heading(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NETWORK_SERVICES.map((service) => (
              <tr key={service.id} className="border-b border-border align-top last:border-b-0">
                <td className="p-3">
                  <strong>{serviceText(service, 'name')}</strong>
                  <div className="text-text-muted">{service.provider}</div>
                  <ProviderPolicyLink url={service.policyUrl} label={t('docs:privacy.providerPolicy')} />
                </td>
                <td className="p-3">
                  {serviceText(service, 'purpose')}
                  <div className="mt-1 text-text-muted">{serviceText(service, 'trigger')}</div>
                </td>
                <td className="p-3">{serviceText(service, 'data')}</td>
                <td className="p-3">
                  <strong>{t(`docs:privacy.consentMode.${service.consentMode}`)}</strong>
                  <div className="mt-1 text-text-muted">{serviceText(service, 'fallback')}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
        {NETWORK_SERVICES.map((service) => (
          <li key={service.id} className="flex flex-col gap-2 rounded-xl border border-border bg-app p-3 text-xs">
            <div className="flex flex-col gap-0.5">
              <strong className="text-sm text-text-main">{serviceText(service, 'name')}</strong>
              <span className="text-text-muted">{service.provider}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-text-main">{heading('purpose')}</span>
              <span className="text-text-muted">{serviceText(service, 'purpose')}</span>
              <span className="text-text-muted">{serviceText(service, 'trigger')}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-text-main">{heading('data')}</span>
              <span className="text-text-muted">{serviceText(service, 'data')}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-text-main">{heading('mode')}</span>
              <span className="text-text-muted">{t(`docs:privacy.consentMode.${service.consentMode}`)}</span>
              <span className="text-text-muted">{serviceText(service, 'fallback')}</span>
            </div>
            <ProviderPolicyLink url={service.policyUrl} label={t('docs:privacy.providerPolicy')} />
          </li>
        ))}
      </ul>

      <p className="m-0 text-xs text-text-muted">{t('docs:meta.storageNote')}</p>
    </DocumentPage>
  );
}
