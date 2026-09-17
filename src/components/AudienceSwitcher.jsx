import React from 'react';
import { useTranslation } from 'react-i18next';
import { AUDIENCE_MODES, localizeToolMode } from '../toolModes.js';

export default function AudienceSwitcher({ activeModeId, onSelectMode, mobile = false }) {
  const { t } = useTranslation('navigation');
  return (
    <nav
      aria-label={t('audience.choose')}
      className={`flex min-w-0 items-center rounded-lg border border-border bg-app p-0.5 ${
        mobile ? 'w-max' : 'max-w-full'
      }`}
    >
      {AUDIENCE_MODES.map((definition) => {
        const mode = localizeToolMode(definition, t);
        const isActive = mode.id === activeModeId;
        return (
          <button
            key={mode.id}
            type="button"
            aria-pressed={isActive}
            aria-label={mode.id === 'all' ? t('audience.showAll') : t('audience.switchTo', { audience: mode.label })}
            title={mode.label}
            onClick={() => onSelectMode(mode.id)}
            className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              isActive
                ? 'border-accent bg-accent-fill text-accent-on-fill shadow-sm'
                : 'border-transparent bg-transparent text-text-muted hover:bg-accent-light hover:text-accent'
            }`}
          >
            {t(`audience.short.${mode.id}`)}
          </button>
        );
      })}
    </nav>
  );
}
