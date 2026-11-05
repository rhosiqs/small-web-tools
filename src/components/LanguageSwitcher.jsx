import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLocale, SUPPORTED_LOCALES } from '../i18n/index.js';

const DESKTOP_TRIGGER_CLASSES = 'flex items-center gap-[6px] bg-app border border-border pl-[10px] pr-2 rounded h-8 text-text-muted transition-all duration-150 cursor-pointer hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const MOBILE_TRIGGER_CLASSES = 'flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-app text-text-muted transition hover:border-accent hover:bg-accent-light hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const MENU_CLASSES = 'absolute right-0 top-full z-[1100] mt-2 flex min-w-[10rem] flex-col gap-1 rounded-lg border border-border bg-[var(--bg-card-solid,var(--bg-card))] p-1 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)]';

function clampIndex(index) {
  return (index + SUPPORTED_LOCALES.length) % SUPPORTED_LOCALES.length;
}

export default function LanguageSwitcher({
  variant = 'desktop',
  className = '',
  onOpen = () => {},
}) {
  const { t, i18n } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const containerRef = useRef(null);
  /** @type {React.MutableRefObject<HTMLButtonElement | null>} */
  const triggerRef = useRef(null);
  /** @type {React.MutableRefObject<Array<HTMLButtonElement | null>>} */
  const itemRefs = useRef([]);
  const menuId = `language-menu-${useId().replaceAll(':', '')}`;
  const isMobile = variant === 'mobile';

  const currentLocale = i18n.resolvedLanguage ?? i18n.language ?? SUPPORTED_LOCALES[0];
  const currentLocaleIndex = Math.max(
    0,
    SUPPORTED_LOCALES.indexOf(currentLocale),
  );

  const restoreTriggerFocus = () => {
    queueMicrotask(() => triggerRef.current?.focus());
  };

  const closeMenu = ({ restoreFocus = false } = {}) => {
    setIsOpen(false);
    if (restoreFocus) restoreTriggerFocus();
  };

  const openMenu = (nextIndex = currentLocaleIndex) => {
    onOpen();
    setActiveIndex(clampIndex(nextIndex));
    setIsOpen(true);
  };

  const focusItem = (nextIndex) => {
    const normalizedIndex = clampIndex(nextIndex);
    setActiveIndex(normalizedIndex);
    queueMicrotask(() => itemRefs.current[normalizedIndex]?.focus());
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    queueMicrotask(() => itemRefs.current[activeIndex]?.focus());

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [activeIndex, isOpen]);

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openMenu(currentLocaleIndex);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(currentLocaleIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      openMenu(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      openMenu(SUPPORTED_LOCALES.length - 1);
    }
  };

  const handleMenuKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        focusItem(activeIndex + 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        focusItem(activeIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(SUPPORTED_LOCALES.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu({ restoreFocus: true });
        break;
      case 'Tab':
        closeMenu();
        break;
      default:
        break;
    }
  };

  const selectLocale = (locale) => {
    void changeLocale(locale);
    closeMenu({ restoreFocus: true });
  };

  return (
    <div
      ref={containerRef}
      className={`${isMobile ? 'relative shrink-0' : 'relative'} ${className}`.trim()}
      data-language-switcher={variant}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`${isMobile ? MOBILE_TRIGGER_CLASSES : DESKTOP_TRIGGER_CLASSES} ${isOpen ? 'border-accent text-accent shadow-[0_0_0_2px_var(--focus-ring)]' : ''}`}
        aria-label={isMobile ? t('language.label') : t('language.trigger', { current: t(`language.${currentLocale}`) })}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => {
          if (isOpen) {
            closeMenu();
          } else {
            openMenu();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <svg
          className="shrink-0 opacity-80"
          viewBox="0 0 24 24"
          width={isMobile ? 16 : 14}
          height={isMobile ? 16 : 14}
          stroke="currentColor"
          strokeWidth={isMobile ? 2.25 : 2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {!isMobile && (
          <>
            <span className="hidden select-none text-[0.8rem] font-medium text-text-main xl:inline">
              {t(`language.${currentLocale}`)}
            </span>
            <svg
              className="ml-0.5 shrink-0 opacity-50"
              viewBox="0 0 24 24"
              width="10"
              height="10"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </>
        )}
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label={t('language.label')}
          className={MENU_CLASSES}
          onKeyDown={handleMenuKeyDown}
        >
          {SUPPORTED_LOCALES.map((locale, index) => (
            <button
              key={locale}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={currentLocale === locale}
              tabIndex={activeIndex === index ? 0 : -1}
              className={`w-full rounded-sm border-none px-3 py-2 text-left text-[0.8rem] font-medium ${currentLocale === locale ? 'bg-accent-light text-accent' : 'bg-transparent text-text-main hover:bg-nav-hover-bg'}`}
              onFocus={() => setActiveIndex(index)}
              onClick={() => selectLocale(locale)}
            >
              {t(`language.${locale}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
