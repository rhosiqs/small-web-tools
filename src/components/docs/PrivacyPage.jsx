import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DocumentPage, { DocumentIntro } from './DocumentPage.jsx';
import Button from '../ui/Button';
import {
  NETWORK_SERVICES,
  THIRD_PARTY_SERVICES,
  getStoredConsents,
  grantConsent,
  resetAllConsent,
  revokeConsent,
} from '../../lib/thirdPartyServices.js';
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

/**
 * Privacy policy and consent settings on one page.
 *
 * The policy explains which features leave the browser and the settings decide
 * whether they may; keeping them apart made the footer carry two links to what
 * readers treat as one subject. Every consent change is written to local storage
 * immediately, so the section needs no confirmation step.
 */
export default function PrivacyPage() {
  const { t, i18n } = useTranslation(['docs', 'tools']);
  const [consents, setConsents] = useState({});
  const [announcement, setAnnouncement] = useState('');
  const heading = (key) => t(`docs:privacy.heading.${key}`);
  const serviceText = (service, field) => t(`docs:services.${service.id}.${field}`);

  useEffect(() => {
    const refreshConsents = () => setConsents(getStoredConsents().services || {});
    refreshConsents();
    window.addEventListener('consent_updated', refreshConsents);
    return () => window.removeEventListener('consent_updated', refreshConsents);
  }, []);

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
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-lg font-semibold text-text-main">{t('docs:privacy.consentHeading')}</h2>
        <p className="m-0 text-text-muted">{t('docs:privacy.consent.description')}</p>

        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {Object.values(THIRD_PARTY_SERVICES).map((service) => {
            const isGranted = Boolean(consents[service.id]);
            const serviceName = t(`docs:services.${service.id}.name`);
            return (
              <li key={service.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-app p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-text-main">{serviceName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isGranted) {
                        revokeConsent(service.id);
                        setAnnouncement(t('docs:privacy.consent.blockedAnnouncement', { service: serviceName }));
                      } else {
                        grantConsent(service.id);
                        setAnnouncement(t('docs:privacy.consent.allowedAnnouncement', { service: serviceName }));
                      }
                    }}
                    aria-pressed={isGranted}
                    aria-label={t(isGranted ? 'docs:privacy.consent.revoke' : 'docs:privacy.consent.allow', { service: serviceName })}
                    className={`flex-shrink-0 rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                      isGranted
                        ? 'border border-accent/30 bg-accent/15 text-accent hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-500'
                        : 'border border-border bg-card text-text-muted hover:border-accent hover:text-accent'
                    }`}
                  >
                    {t(isGranted ? 'docs:privacy.consent.allowed' : 'docs:privacy.consent.blocked')}
                  </button>
                </div>
                <p className="m-0 text-xs text-text-muted">{t(`docs:services.${service.id}.purpose`)}</p>
                <div className="flex flex-wrap justify-between gap-2 text-[0.72rem] text-text-muted/80">
                  <span>{t('docs:privacy.consent.fallback', { fallback: t(`docs:services.${service.id}.fallback`) })}</span>
                  <a
                    href={service.privacyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {t('docs:privacy.consent.privacyPolicy')} ↗
                  </a>
                </div>
              </li>
            );
          })}
        </ul>

        <Button
          variant="secondary"
          className="self-start text-xs text-red-500 hover:border-red-500/50"
          onClick={() => {
            resetAllConsent();
            setAnnouncement(t('docs:privacy.consent.resetAnnouncement'));
          }}
        >
          {t('docs:privacy.consent.reset')}
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-lg font-semibold text-text-main">{t('docs:privacy.inventoryHeading')}</h2>

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
      </section>

      <p className="m-0 text-xs text-text-muted">{t('docs:meta.storageNote')}</p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </DocumentPage>
  );
}
