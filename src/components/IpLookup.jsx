import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';
import { hasConsent, grantConsent } from '../lib/thirdPartyServices';
import { parseIpInput } from '../lib/ipValidation';
import ExternalMapPreview from './ExternalMapPreview';

async function ipLookup(ip, t) {
  const parsed = parseIpInput(ip);
  if (parsed.error) throw new Error(t(`tool-iplookup.ui.${parsed.errorCode}`));
  const query = parsed.value ? '?ip=' + encodeURIComponent(parsed.value) : '';
  const response = await fetch('/api/iplookup' + query);
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error || t('tool-iplookup.ui.serverError'));
  }
  return result.data;
}
function getFlagEmoji(countryCode) {
  if (!countryCode) return "";
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(char.charCodeAt(0) + 127397)
    );
}

function CopyBtn({ value, copiedKey, thisKey, onCopy }) {
  const { t } = useTranslation('tools');
  const isCopied = copiedKey === thisKey;
  return (
    <button
      type="button"
      onClick={() => onCopy(value, thisKey)}
      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all duration-200 leading-none border
        ${isCopied
          ? 'bg-[#10b981] text-white border-[#10b981]'
          : 'bg-accent-light text-accent border-accent/15 hover:bg-accent-fill hover:text-accent-on-fill hover:border-accent'
        }`}
    >
      {t(isCopied ? 'tool-iplookup.ui.copied' : 'tool-iplookup.ui.copy')}
    </button>
  );
}

export default function IpLookup() {
  const { t } = useTranslation('tools');
  const [ipInput, setIpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [copiedBtn, setCopiedBtn] = useState(null);
  const [result, setResult] = useState(null);
  const [lookupAllowed, setLookupAllowed] = useState(() => hasConsent('iplookup'));

  useEffect(() => {
    const handleConsentUpdate = () => {
      setLookupAllowed(hasConsent('iplookup'));
    };
    window.addEventListener('consent_updated', handleConsentUpdate);
    return () => window.removeEventListener('consent_updated', handleConsentUpdate);
  }, []);

  const handleCopy = (val, key) => {
    if (!val) return;
    navigator.clipboard.writeText(val).then(() => {
      setCopiedBtn(key);
      setTimeout(() => setCopiedBtn(null), 1500);
    });
  };

  const doLookup = async () => {
    if (!lookupAllowed) {
      setStatus(t('tool-iplookup.ui.blocked'));
      return;
    }
    const parsed = parseIpInput(ipInput);
    if (parsed.error) {
      setStatus(t('tool-iplookup.ui.error', { message: t(`tool-iplookup.ui.${parsed.errorCode}`) }));
      setResult(null);
      return;
    }

    setLoading(true);
    setResult(null);
    setStatus('');

    try {
      const data = await ipLookup(parsed.value, t);
      setResult(data);
    } catch (err) {
      setStatus(t('tool-iplookup.ui.error', { message: err.message }));
    } finally {
      setLoading(false);
    }
  };

  const showResults = result && !loading;

  let locationVal = '';
  let regionCountryVal = '';
  let timezoneVal = '';
  let coordsVal = '';

  if (result) {
    const city = result.city || '';
    const postal = result.postal || '';
    locationVal = city && postal ? `${city} (${postal})` : (city || postal || t('tool-iplookup.ui.unknown'));

    const countryCode = result.country_code || '';
    const flag = getFlagEmoji(countryCode);
    const region = result.region || '';
    const country = result.country_name || '';
    regionCountryVal = `${region}${region && country ? ", " : ""}${country} ${flag}`.trim() || t('tool-iplookup.ui.unknown');

    timezoneVal = result.timezone ? `${result.timezone} (UTC ${result.utc_offset || ""})` : t('tool-iplookup.ui.unknown');

    if (result.latitude !== undefined && result.latitude !== null && result.longitude !== undefined && result.longitude !== null) {
      coordsVal = `${result.latitude}, ${result.longitude}`;
    } else {
      coordsVal = t('tool-iplookup.ui.unknown');
    }
  }

  return (
    <Card id="tool-iplookup" variant="tool" size="wide">
      <ToolHeader title={t('tool-iplookup.ui.heading')} />
      <p className="text-xs text-text-muted">
        {t('tool-iplookup.ui.disclosure')}
      </p>
      {!lookupAllowed && (
        <div className="p-3 bg-app border border-border rounded-xl flex items-center justify-between gap-3 text-xs">
          <span>
            {t('tool-iplookup.ui.consentDisclosure')}
          </span>
          <Button variant="secondary" onClick={() => grantConsent('iplookup')}>
            {t('tool-iplookup.ui.allow')}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2 w-full">
        <label htmlFor="iplookup-input" className="text-sm font-semibold text-text-main">{t('tool-iplookup.ui.ipAddress')}</label>
        <div className="flex gap-3 w-full">
          <input
            id="iplookup-input"
            type="text"
            placeholder={t('tool-iplookup.ui.placeholder')}
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                doLookup();
              }
            }}
            className="flex-1 px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card"
          />
          <Button
            id="iplookup-btn"
            type="button"
            variant="primary"
            onClick={doLookup}
            disabled={loading}
          >
            {t('tool-iplookup.ui.lookup')}
          </Button>
        </div>
      </div>

      {loading && (
        <div id="iplookup-loader" className="flex flex-col items-center justify-center gap-3 py-6">
          <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
          <span>{t('tool-iplookup.ui.fetching')}</span>
        </div>
      )}

      {showResults && (
        <div id="iplookup-results" className="w-full">
          <div className="grid grid-cols-[1.2fr_1fr] gap-6 w-full max-[900px]:grid-cols-1 max-[900px]:gap-5">
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'iplookup-res-ip', label: t('tool-iplookup.ui.ipAddress'), val: result.ip || t('tool-iplookup.ui.unknown'), copyKey: 'ip' },
                { id: 'iplookup-res-location', label: t('tool-iplookup.ui.location'), val: locationVal, copyKey: 'location' },
                { id: 'iplookup-res-region-country', label: t('tool-iplookup.ui.regionCountry'), val: regionCountryVal, copyKey: 'regionCountry' },
                { id: 'iplookup-res-org', label: t('tool-iplookup.ui.organization'), val: result.org || t('tool-iplookup.ui.unknown'), copyKey: 'org' },
                { id: 'iplookup-res-timezone', label: t('tool-iplookup.ui.timezone'), val: timezoneVal, copyKey: 'timezone' },
                { id: 'iplookup-res-coords', label: t('tool-iplookup.ui.coordinates'), val: coordsVal, copyKey: 'coords' },
              ].map(({ id, label, val, copyKey }) => (
                <div key={copyKey} className="flex flex-col gap-2 w-full">
                  <div className="flex justify-between items-center mb-0.5">
                    <label htmlFor={id} className="text-sm font-semibold text-text-main">{label}</label>
                    <CopyBtn value={val} copiedKey={copiedBtn} thisKey={copyKey} onCopy={handleCopy} />
                  </div>
                  <input
                    id={id}
                    type="text"
                    readOnly
                    value={val}
                    className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none read-only:opacity-80"
                  />
                </div>
              ))}
            </div>

            {/* Interactive Map Section */}
            {result.latitude != null && result.longitude != null && (
              <ExternalMapPreview
                latitude={Number(result.latitude)}
                longitude={Number(result.longitude)}
                title={t('tool-iplookup.ui.mapTitle')}
                delta={0.02}
              />
            )}
          </div>
        </div>
      )}

      {status && <p className="min-h-[18px] text-red-500 font-medium text-sm mt-2" id="iplookup-status">{status}</p>}
    </Card>
  );
}
