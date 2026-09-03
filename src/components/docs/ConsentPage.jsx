import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DocumentPage, { DocumentIntro } from './DocumentPage.jsx';
import Button from '../ui/Button';
import {
  THIRD_PARTY_SERVICES,
  getStoredConsents,
  grantConsent,
  resetAllConsent,
  revokeConsent,
} from '../../lib/thirdPartyServices.js';

/**
 * Consent settings as an ordinary page.
 *
 * Every change is written to local storage immediately, so the page needs no
 * confirmation step and no way to close itself; the shell breadcrumb leads back
 * to the rest of the site.
 *
 * @param {{ onNavigateDocument: (documentId: string) => void }} props
 */
export default function ConsentPage({ onNavigateDocument }) {
  const { t } = useTranslation(['docs', 'tools']);
  const [consents, setConsents] = useState({});
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const refreshConsents = () => setConsents(getStoredConsents().services || {});
    refreshConsents();
    window.addEventListener('consent_updated', refreshConsents);
    return () => window.removeEventListener('consent_updated', refreshConsents);
  }, []);

  return (
    <DocumentPage title={t('tools:consent.title')} updated={t('docs:consent.updated')}>
      <section className="flex flex-col gap-3">
        <DocumentIntro>{t('docs:consent.description')}</DocumentIntro>
        <button
          type="button"
          onClick={() => onNavigateDocument('privacy')}
          className="self-start text-sm font-semibold text-accent hover:underline"
        >
          {t('docs:consent.readPolicy')}
        </button>
      </section>

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
                      setAnnouncement(t('docs:consent.blockedAnnouncement', { service: serviceName }));
                    } else {
                      grantConsent(service.id);
                      setAnnouncement(t('docs:consent.allowedAnnouncement', { service: serviceName }));
                    }
                  }}
                  aria-pressed={isGranted}
                  aria-label={t(isGranted ? 'docs:consent.revoke' : 'docs:consent.allow', { service: serviceName })}
                  className={`flex-shrink-0 rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                    isGranted
                      ? 'border border-accent/30 bg-accent/15 text-accent hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-500'
                      : 'border border-border bg-card text-text-muted hover:border-accent hover:text-accent'
                  }`}
                >
                  {t(isGranted ? 'docs:consent.allowed' : 'docs:consent.blocked')}
                </button>
              </div>
              <p className="m-0 text-xs text-text-muted">{t(`docs:services.${service.id}.purpose`)}</p>
              <div className="flex flex-wrap justify-between gap-2 text-[0.72rem] text-text-muted/80">
                <span>{t('docs:consent.fallback', { fallback: t(`docs:services.${service.id}.fallback`) })}</span>
                <a
                  href={service.privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {t('docs:consent.privacyPolicy')} ↗
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="m-0 text-xs text-text-muted">{t('docs:meta.storageNote')}</p>
        <Button
          variant="secondary"
          className="self-start text-xs text-red-500 hover:border-red-500/50"
          onClick={() => {
            resetAllConsent();
            setAnnouncement(t('docs:consent.resetAnnouncement'));
          }}
        >
          {t('docs:consent.reset')}
        </Button>
      </section>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </DocumentPage>
  );
}
