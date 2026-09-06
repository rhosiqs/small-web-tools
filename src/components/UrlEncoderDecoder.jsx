import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AutoDetectConverter from './ui/AutoDetectConverter';
import { analyzeUrl } from './UrlEncoderDecoder/lib/urlDomain';

function ScopeSelector({ scope, setScope }) {
  const { t } = useTranslation('tools');
  return (
    <section className="flex flex-col gap-2" aria-labelledby="url-scope-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="url-scope-title" className="m-0 text-[0.9375rem] font-medium text-text-main">{t('tool-url.ui.scope')}</h3>
          <p className="m-0 mt-0.5 text-xs text-text-muted">
            {t('tool-url.ui.scopeHint')}
          </p>
        </div>
        <div className="flex flex-none rounded border border-border p-0.5" role="group" aria-label={t('tool-url.ui.scopeLabel')}>
          <button
            type="button"
            aria-pressed={scope === 'full'}
            onClick={() => setScope('full')}
            className={`rounded px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors ${
              scope === 'full' ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
            }`}
          >
            {t('tool-url.ui.fullUrl')}
          </button>
          <button
            type="button"
            aria-pressed={scope === 'component'}
            onClick={() => setScope('component')}
            className={`rounded px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors ${
              scope === 'component' ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
            }`}
          >
            {t('tool-url.ui.component')}
          </button>
        </div>
      </div>
      <p className="m-0 text-xs text-text-muted">
        {scope === 'full'
          ? t('tool-url.ui.fullHint')
          : t('tool-url.ui.componentHint')}
      </p>
    </section>
  );
}

export default function UrlEncoderDecoder() {
  const { t } = useTranslation('tools');
  const [scope, setScope] = useState('full');
  const analyze = useCallback(
    (input, mode) => {
      const result = analyzeUrl(input, mode, scope);
      return {
        ...result,
        sourceLabel: result.sourceKey ? t(`tool-url.ui.${result.sourceKey}`) : '',
        targetLabel: result.targetKey ? t(`tool-url.ui.${result.targetKey}`) : '',
        outputPlaceholder: t(`tool-url.ui.${result.outputPlaceholderKey}`),
        error: result.errorKey ? t(`tool-url.ui.${result.errorKey}`) : result.error,
      };
    },
    [scope, t],
  );

  return (
    <AutoDetectConverter
      toolId="tool-url"
      kicker={t('navigation:categories.developer')}
      title={t('tool-url.title')}
      inputPlaceholder={t('tool-url.ui.placeholder')}
      emptyTargetLabel={t('tool-url.ui.converted')}
      analyze={analyze}
      renderSupplementary={() => <ScopeSelector scope={scope} setScope={setScope} />}
    />
  );
}
