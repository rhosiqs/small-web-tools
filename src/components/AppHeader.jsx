import LanguageSwitcher from './LanguageSwitcher.jsx';
import DesktopCategoryNav from './DesktopCategoryNav.jsx';

function ThemeIcon({ dark }) {
  return dark ? (
    <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ) : (
    <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function AppHeader({
  activeTool,
  categories,
  isSearchFocused,
  modeProfile,
  navItems,
  openCategory,
  searchQuery,
  searchRef,
  searchResults,
  t,
  theme,
  onGoHome,
  onModeChange,
  onOpenCategory,
  onSearchChange,
  onSearchFocus,
  onSelectCategory,
  onSelectTool,
  onToggleTheme,
}) {
  return (
    <header className="z-[1000] hidden min-h-[48px] min-w-0 items-center justify-between border-b border-border bg-header px-4 py-[6px] backdrop-blur-[10px] transition-all duration-300 md:flex md:px-8 xl:px-12">
      <button
        type="button"
        id="desktop-brand-logo"
        className="flex cursor-pointer items-center gap-[10px] border-none bg-transparent p-0 text-accent transition-opacity duration-200 hover:opacity-85"
        title={t('navigation:goHome')}
        aria-label={t('navigation:brandHome', { product: t('common:productName') })}
        onClick={onGoHome}
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-gradient text-white shadow-[0_4px_10px_rgba(99,102,241,0.15)] [&_svg]:w-[18px]">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </span>
        <span className="hidden font-['TASA_Orbiter',sans-serif] text-[0.95rem] font-bold tracking-[-0.02em] text-accent xl:inline">{t('common:productName')}</span>
      </button>

      <DesktopCategoryNav
        activeTool={activeTool}
        categories={categories}
        navItems={navItems}
        openCategory={openCategory}
        simplified={modeProfile.simplified}
        onOpenCategory={onOpenCategory}
        onSelectCategory={onSelectCategory}
        onSelectTool={onSelectTool}
      />

      <div className="flex shrink-0 items-center gap-2 xl:gap-4">
        <button
          type="button"
          className="flex h-8 shrink-0 items-center rounded border border-border bg-app px-2.5 text-xs font-bold text-text-main transition hover:border-accent hover:bg-accent-light hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus xl:px-3"
          onClick={() => (modeProfile.simplified ? onGoHome() : onModeChange('simple'))}
        >
          {t(modeProfile.simplified ? 'navigation:exitSimpleMode' : 'navigation:simpleMode')}
        </button>

        <div
          ref={searchRef}
          className="relative hidden w-[180px] transition-[width] duration-300 focus-within:w-[240px] lg:block"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="relative flex items-center">
            <svg className="pointer-events-none absolute left-[10px] text-text-muted" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="header-search-input h-8 w-full rounded border border-border bg-[var(--bg-search-sidebar)] py-0 !pl-8 !pr-8 font-sans text-[0.8rem] text-text-main outline-none transition-all duration-200 focus:border-accent focus:bg-card focus:shadow-[0_0_0_2px_var(--focus-ring)]"
              placeholder={t('navigation:search.placeholder')}
              aria-label={t('navigation:search.label')}
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              onFocus={onSearchFocus}
            />
            <kbd className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 rounded-[4px] border border-border bg-[rgba(255,255,255,0.05)] px-[5px] py-[1px] font-sans text-[0.65rem] font-semibold text-text-muted transition-opacity duration-150 [.header-search-input:focus~&]:opacity-0">/</kbd>
          </div>
          {searchQuery.trim() !== '' && isSearchFocused && (
            <div className="absolute right-0 top-full z-[1200] mt-2 flex max-h-[300px] w-[280px] flex-col gap-0.5 overflow-y-auto rounded-md border border-border bg-card p-[6px] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)]">
              {searchResults.length > 0 ? searchResults.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="flex w-full items-center gap-[10px] rounded-sm border-none bg-transparent px-3 py-2 text-left font-sans text-[0.82rem] text-text-main transition-colors duration-150 hover:bg-accent-light hover:text-accent [&_.item-icon]:inline-flex [&_.item-icon]:h-[14px] [&_.item-icon]:w-[14px] [&_.item-icon]:items-center [&_.item-icon]:justify-center [&_.item-icon]:text-text-muted [&_.item-icon_svg]:h-full [&_.item-icon_svg]:w-full"
                  onClick={() => {
                    onSelectTool(item.id);
                    onSearchChange('');
                  }}
                >
                  <span className="item-icon">{item.icon}</span>
                  <span>{item.name}</span>
                </button>
              )) : (
                <div className="p-3 text-center text-[0.8rem] text-text-muted">{t('navigation:search.noResults')}</div>
              )}
            </div>
          )}
        </div>

        {!modeProfile.simplified && <LanguageSwitcher variant="desktop" onOpen={() => onOpenCategory(null)} />}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-transparent text-text-muted transition-all duration-150 hover:border-accent hover:bg-accent-light hover:text-accent"
          aria-label={t('navigation:toggleTheme')}
          onClick={onToggleTheme}
        >
          <ThemeIcon dark={theme === 'dark'} />
        </button>
      </div>
    </header>
  );
}
