import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import SimpleHome from './components/SimpleHome.jsx';
import LanguageSwitcher from './components/LanguageSwitcher.jsx';
import MobileDrawer from './components/MobileDrawer.jsx';
import AppHeader from './components/AppHeader.jsx';
import AppFooter from './components/AppFooter.jsx';
import ThirdPartyConsentModal from './components/ui/ThirdPartyConsentModal';
import Spinner from './components/ui/Spinner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { STATIC_LAYOUT_IDS, getLocalizedToolRoutes, getToolRoute, localizeToolRoute, sortLocalizedTools } from './toolRegistry.js';
import { TOOL_ICONS } from './toolIcons.jsx';
import {
  filterToolsForMode,
  getToolMode,
  localizeToolMode,
} from './toolModes.js';
import { useAppRouting } from './hooks/useAppRouting.js';
import { useDocumentTitle } from './hooks/useDocumentTitle.js';
import { readStoredActiveTool, useShellPreferences } from './hooks/useShellPersistence.js';
import { CATEGORY_DEFINITIONS as categories } from './categoryDefinitions.jsx';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
const SHOW_CHANNEL_ALERT = typeof __SHOW_CHANNEL_ALERT__ !== 'undefined' ? __SHOW_CHANNEL_ALERT__ : false;
const APP_CHANNEL = typeof __APP_CHANNEL__ !== 'undefined' ? __APP_CHANNEL__ : '';


const staticTools = STATIC_LAYOUT_IDS;

export default function App() {
  const { t, i18n } = useTranslation(['common', 'navigation', 'tools', 'errors']);
  const { activeTool, toolMode, navigateToTool, changeMode } = useAppRouting(readStoredActiveTool);
  const { theme, setTheme, isSidebarCollapsed, setIsSidebarCollapsed } = useShellPreferences(activeTool);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const mobileSidebarOpenerRef = useRef(null);
  const [tooltipState, setTooltipState] = useState({ text: '', top: 0, left: 0, visible: false });
  const [openDropdown, setOpenDropdown] = useState(null);
  const [selectedHomeTab, setSelectedHomeTab] = useState('all');
  const [toastMessage, setToastMessage] = useState('');
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (message) => {
    setToastMessage(message);
  };

  const handleEmailClick = () => {
    navigator.clipboard.writeText("emailforvirtualmachine@gmail.com")
      .then(() => {
        showToast(t('navigation:toast.emailCopied'));
      })
      .catch(() => {});
  };

  // Close dropdowns on clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      setOpenDropdown(null);
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const modeProfile = localizeToolMode(getToolMode(toolMode), t);
  const categoriesLocalized = useMemo(() => categories.map((category) => ({
    ...category,
    name: t(`navigation:categories.${category.nameKey}`),
  })), [t]);
  const navItems = useMemo(() => getLocalizedToolRoutes(t)
    .filter((route) => route.navigationVisible)
    .map((route) => ({
      ...route,
      name: route.title,
      desc: route.description,
      icon: TOOL_ICONS[route.iconKey],
    })), [t]);

  useDocumentTitle({
    activeTool,
    modeProfile,
    language: i18n.resolvedLanguage,
    t,
  });
  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        /** @type {HTMLInputElement | null} */
        const searchInput = document.querySelector('.header-search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
          setIsSearchFocused(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  const handleNavClick = (toolId) => {
    navigateToTool(toolId);
    setMobileSidebarOpen(false);
  };

  const handleModeChange = (nextModeId) => {
    changeMode(nextModeId);
    setSelectedHomeTab('all');
    setSearchQuery('');
    setMobileSidebarOpen(false);
  };

  const handleAllToolsHomeClick = () => {
    handleModeChange('all');
  };

  // Tooltip logic for collapsed sidebar
  const handleMouseEnter = (e, item) => {
    if (isSidebarCollapsed) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipState({
        text: item.tooltip,
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
        visible: true
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltipState(prev => ({ ...prev, visible: false }));
  };

  // Audience modes filter the home, sidebar, and search; header shortcuts stay complete.
  const modeNavItems = filterToolsForMode(navItems, toolMode);
  const searchNavItems = modeProfile.simplified ? navItems : modeNavItems;
  const normalizedQuery = searchQuery.toLocaleLowerCase(i18n.resolvedLanguage).trim();
  const matchesSearch = (item) => item.searchMetadata.some((term) =>
    term.toLocaleLowerCase(i18n.resolvedLanguage).includes(normalizedQuery));
  const filteredModeNavItems = modeNavItems.filter(matchesSearch);
  const filteredSearchNavItems = searchNavItems.filter(matchesSearch);
  // Render the active registry component.
  const renderActiveTool = () => {
    const route = getToolRoute(activeTool) || getToolRoute('tool-home');
    if (route.id === 'tool-home' && modeProfile.simplified) {
      return (
        <ErrorBoundary key="simple-home">
          <SimpleHome tools={navItems} onSelectTool={handleNavClick} />
        </ErrorBoundary>
      );
    }
    const ToolComponent = route.component;
    const componentProps = route.id === 'tool-home'
      ? {
        tools: filteredModeNavItems,
        onSelectTool: handleNavClick,
        activeTab: selectedHomeTab,
        modeId: modeProfile.id,
        onSelectMode: handleModeChange,
      }
      : route.componentProps;
    return (
      <ErrorBoundary key={activeTool}>
        <Suspense fallback={<div className="flex flex-col items-center justify-center p-12 gap-3"><Spinner /><span className="text-xs text-text-muted">{t('common:states.loadingTool')}</span></div>}>
          <ToolComponent {...componentProps} key={activeTool} />
        </Suspense>
      </ErrorBoundary>
    );
  };

  const activeTitle = activeTool === 'tool-home' && modeProfile.id !== 'all'
    ? modeProfile.label
    : (() => {
      const route = getToolRoute(activeTool);
      return route ? localizeToolRoute(route, t).title : '';
    })();

  // --banner-height is 0px by default, 36px when SHOW_CHANNEL_ALERT is true
  // We must use inline styles for calc() expressions using this CSS variable
  const bannerHeightStyle = { marginTop: 'var(--banner-height)' };
  const sidebarHeightStyle = {
    height: 'calc(100vh - var(--banner-height))',
    top: 'var(--banner-height)',
  };
  const mainContentHeightStyle = { height: 'calc(100vh - var(--banner-height))' };

  // Nav item — shared classes
  const navItemBase =
    'flex items-center gap-[9px] py-[7px] px-[10px] border-none bg-transparent rounded-sm text-text-sidebar-muted cursor-pointer text-left transition-[background,color] duration-150 ease-linear font-medium text-[0.84rem] font-sans w-full [&_svg]:w-[15px] [&_svg]:h-[15px] [&_svg]:flex-shrink-0 [&_svg]:opacity-70';
  const navItemActive =
    'bg-nav-active-bg text-nav-active-text font-semibold border border-[rgba(16,185,129,0.25)] shadow-[0_0_10px_rgba(16,185,129,0.08)] [&_svg]:opacity-100 [&_svg]:text-nav-active-text';
  const navItemHover =
    'hover:bg-nav-hover-bg hover:text-text-sidebar [&:hover_svg]:opacity-100';

  return (
    <div className={SHOW_CHANNEL_ALERT ? 'has-banner' : ''}>
      {/* Warning Banner */}
      {SHOW_CHANNEL_ALERT && (
        <aside
          id="channel-alert-banner"
          aria-label={t('navigation:banner.label')}
          className="fixed top-0 left-0 right-0 h-9 bg-warning-bg border-b border-warning-border text-warning-text flex items-center justify-center gap-2 text-[0.82rem] font-semibold z-[9999] px-4 box-border"
        >
          <svg
            className="flex-shrink-0"
            viewBox="0 0 24 24" width="16" height="16"
            stroke="currentColor" strokeWidth="2.5" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          {/* Desktop text */}
          <span className="hidden sm:inline">
            {t('navigation:banner.desktop', { channel: APP_CHANNEL, version: APP_VERSION })}
          </span>
          {/* Mobile text */}
          <span className="sm:hidden">
            {t('navigation:banner.mobile', { channel: APP_CHANNEL, version: APP_VERSION })}
          </span>
        </aside>
      )}

      {/* App layout: flex row, offset below banner */}
      <div
        className={`flex overflow-x-hidden ${isSidebarCollapsed ? 'collapsed-sidebar' : ''}`}
        style={{ ...bannerHeightStyle, minHeight: 'calc(100vh - var(--banner-height))' }}
      >

        {/* Mobile Header — hidden on desktop (md+) */}
        <header
          data-drawer-background
          id="mobile-header"
          className="hidden max-md:flex bg-sidebar border-b border-border-sidebar px-5 py-3 items-center gap-4 fixed left-0 right-0 z-[90] h-[60px] shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
          style={{ top: 'var(--banner-height)' }}
        >
          <button
            ref={mobileSidebarOpenerRef}
            id="sidebar-toggle"
            className="bg-transparent border-none text-text-main cursor-pointer p-1 flex items-center justify-center rounded-sm transition-colors duration-200 hover:bg-accent-light hover:text-accent"
            aria-label={t('navigation:sidebar.toggle')}
            aria-expanded={mobileSidebarOpen}
            aria-controls="mobile-navigation-drawer"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <span className="min-w-0 flex-1 truncate font-['TASA_Orbiter',sans-serif] font-bold text-[1.15rem] text-accent">Small Web Tools</span>
          <LanguageSwitcher variant="mobile" />
          <button
            type="button"
            onClick={() => (
              modeProfile.simplified
                ? handleAllToolsHomeClick()
                : handleModeChange('simple')
            )}
            className="shrink-0 rounded-lg border border-border bg-app px-2.5 py-1.5 text-xs font-bold text-text-main transition hover:border-accent hover:bg-accent-light hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {t(modeProfile.simplified ? 'navigation:exitSimpleMode' : 'navigation:simpleMode')}
          </button>
        </header>

        {/* Closed drawers are unmounted so their controls leave the focus and accessibility trees. */}
        {mobileSidebarOpen && <MobileDrawer
          label={t('navigation:sidebar.navigationLabel')}
          closeLabel={t('navigation:sidebar.close')}
          onClose={() => setMobileSidebarOpen(false)}
          openerRef={mobileSidebarOpenerRef}
          style={sidebarHeightStyle}
        >
          {/* Sidebar Brand */}
          <div className={`px-[18px] py-4 flex items-center justify-between border-b border-border-sidebar gap-3 transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isSidebarCollapsed ? 'md:flex-col md:justify-center md:px-0 md:py-4 md:gap-[10px]' : ''}`}>
            <button
              type="button"
              className={`flex items-center gap-[10px] cursor-pointer bg-transparent border-none p-0 text-left ${isSidebarCollapsed ? 'md:justify-center' : ''}`}
              id="brand-logo-btn"
              title={t('navigation:goHome')}
              aria-label={t('navigation:goHome')}
              onClick={() => {
                handleAllToolsHomeClick();
              }}
            >
              {/* Brand Icon Box */}
              <div className="bg-accent-gradient text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-[0_4px_10px_rgba(99,102,241,0.15)] flex-shrink-0 [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:[stroke-width:2.2]">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              {/* Brand Text — hidden when collapsed on desktop */}
              <span className={`font-display text-[0.95rem] font-extrabold tracking-[-0.02em] text-text-sidebar ${isSidebarCollapsed ? 'md:hidden' : ''}`}>Small Web Tools</span>
            </button>

            {/* Collapse button — hidden on mobile */}
            <button
              id="sidebar-collapse-btn"
              className={`
                hidden md:flex bg-transparent border-none text-text-sidebar-muted cursor-pointer
                w-[30px] h-[30px] rounded-sm items-center justify-center
                transition-all duration-200
                hover:bg-nav-hover-bg hover:text-text-sidebar
                ${isSidebarCollapsed ? 'md:bg-accent md:text-white md:rotate-180 hover:md:bg-accent-hover hover:md:text-white hover:md:scale-105' : ''}
              `}
              aria-label={t('navigation:sidebar.collapse')}
              onClick={toggleSidebarCollapse}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
          </div>

          {/* Sidebar Search — hidden when collapsed on desktop */}
          <div className={`px-4 pt-[10px] pb-[6px] ${isSidebarCollapsed ? 'md:hidden' : ''}`}>
            <div className="relative flex items-center">
              <svg className="absolute left-[10px] text-text-muted pointer-events-none" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                id="tool-search"
                className="w-full !py-2 !pl-8 !pr-3 text-[0.83rem] rounded-[7px] bg-[var(--bg-search-sidebar)] border border-border-sidebar text-text-sidebar outline-none transition-all duration-200 placeholder:text-text-sidebar-muted focus:border-accent focus:shadow-[0_0_0_2px_var(--focus-ring)]"
                placeholder={t('navigation:search.placeholder')}
                aria-label={t('navigation:search.label')}
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Sidebar Nav */}
          <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[var(--scrollbar-thumb)] [&::-webkit-scrollbar-thumb]:rounded-[3px]">
            {searchQuery.trim() !== '' ? (
              filteredModeNavItems.map(item => (
                <button
                  key={item.id}
                  className={`${navItemBase} ${navItemHover} ${activeTool === item.id ? navItemActive : ''} ${isSidebarCollapsed ? 'md:justify-center md:px-0 md:py-2' : ''}`}
                  data-tool={item.id}
                  data-tooltip={item.tooltip}
                  onClick={() => handleNavClick(item.id)}
                  onMouseEnter={(e) => handleMouseEnter(e, item)}
                  onMouseLeave={handleMouseLeave}
                >
                  {item.icon}
                  <span className={isSidebarCollapsed ? 'md:hidden' : ''}>{item.name}</span>
                </button>
              ))
            ) : (
              categoriesLocalized.map(cat => {
                const catItems = filteredModeNavItems.filter(item => item.category === cat.id);
                if (catItems.length === 0) return null;

                if (cat.id === 'utilities') {
                  const subGroups = {};
                  catItems.forEach(item => {
                    const sg = item.subGroup || 'Utilities';
                    if (!subGroups[sg]) subGroups[sg] = [];
                    subGroups[sg].push(item);
                  });
                  const sortedSubGroupNames = Object.keys(subGroups).sort();

                  return (
                    <div key={cat.id} className={`flex flex-col gap-0.5 mb-3 last:mb-0 ${isSidebarCollapsed ? 'md:mb-2 md:relative md:after:content-[""] md:after:block md:after:w-6 md:after:h-px md:after:bg-border-sidebar md:after:mx-auto md:after:mt-2 md:after:opacity-50 md:last:after:hidden' : ''}`} data-category={cat.id}>
                      {/* Category Header — hidden when collapsed on desktop */}
                      <div className={`flex items-center gap-[10px] px-3 pt-[10px] pb-[6px] text-text-sidebar-muted font-display select-none ${isSidebarCollapsed ? 'md:hidden' : ''}`}>
                        <span className="inline-flex items-center justify-center w-[15px] h-[15px] text-text-sidebar-muted opacity-80 [&_svg]:w-full [&_svg]:h-full">
                          {cat.icon}
                        </span>
                        <span className="text-[0.82rem] font-semibold text-text-sidebar-muted flex-1 capitalize tracking-normal">{cat.name}</span>
                        <svg className="w-3 h-3 text-text-sidebar-muted opacity-60" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                      {sortedSubGroupNames.map(sgName => (
                        <div key={sgName} className={`flex flex-col gap-0.5 mt-1 ${isSidebarCollapsed ? 'md:mt-0' : ''}`}>
                          {/* Subcategory header — hidden when collapsed on desktop */}
                          <div className={`px-3 py-[2px] flex items-center select-none ${isSidebarCollapsed ? 'md:hidden' : ''}`}>
                            <span className="text-[0.65rem] font-bold uppercase tracking-[0.05em] text-text-sidebar-muted opacity-55">
                              {sgName}
                            </span>
                          </div>
                          {sortLocalizedTools(subGroups[sgName], i18n.resolvedLanguage).map(item => (
                            <button
                              key={item.id}
                              className={`${navItemBase} ${navItemHover} pl-5 ${activeTool === item.id ? navItemActive : ''} ${isSidebarCollapsed ? 'md:justify-center md:pl-0 md:px-0 md:py-2' : ''}`}
                              data-tool={item.id}
                              data-tooltip={item.tooltip}
                              onClick={() => handleNavClick(item.id)}
                              onMouseEnter={(e) => handleMouseEnter(e, item)}
                              onMouseLeave={handleMouseLeave}
                            >
                              {item.icon}
                              <span className={isSidebarCollapsed ? 'md:hidden' : ''}>{item.name}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <div key={cat.id} className={`flex flex-col gap-0.5 mb-3 last:mb-0 ${isSidebarCollapsed ? 'md:mb-2 md:relative md:after:content-[""] md:after:block md:after:w-6 md:after:h-px md:after:bg-border-sidebar md:after:mx-auto md:after:mt-2 md:after:opacity-50 md:last:after:hidden' : ''}`} data-category={cat.id}>
                    {/* Category Header — hidden when collapsed on desktop */}
                    <div className={`flex items-center gap-[10px] px-3 pt-[10px] pb-[6px] text-text-sidebar-muted font-display select-none ${isSidebarCollapsed ? 'md:hidden' : ''}`}>
                      <span className="inline-flex items-center justify-center w-[15px] h-[15px] text-text-sidebar-muted opacity-80 [&_svg]:w-full [&_svg]:h-full">
                        {cat.icon}
                      </span>
                      <span className="text-[0.82rem] font-semibold text-text-sidebar-muted flex-1 capitalize tracking-normal">{cat.name}</span>
                      <svg className="w-3 h-3 text-text-sidebar-muted opacity-60" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                    {catItems.map(item => (
                      <button
                        key={item.id}
                        className={`${navItemBase} ${navItemHover} ${activeTool === item.id ? navItemActive : ''} ${isSidebarCollapsed ? 'md:justify-center md:px-0 md:py-2' : ''}`}
                        data-tool={item.id}
                        data-tooltip={item.tooltip}
                        onClick={() => handleNavClick(item.id)}
                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {item.icon}
                        <span className={isSidebarCollapsed ? 'md:hidden' : ''}>{item.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </nav>

          {/* Sidebar Footer */}
          <div className={`px-[14px] py-3 border-t border-border-sidebar flex flex-col gap-[10px] transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isSidebarCollapsed ? 'md:px-0 md:items-center' : ''}`}>
            <div className={`flex items-center justify-between ${isSidebarCollapsed ? 'md:justify-center md:w-full' : ''}`}>
              {/* Theme label — hidden when collapsed on desktop */}
              <span className={`text-[0.82rem] font-medium text-text-sidebar-muted ${isSidebarCollapsed ? 'md:hidden' : ''}`}>{t('navigation:theme')}</span>
              <button
                id="theme-toggle"
                className="bg-[var(--bg-search-sidebar)] border border-border-sidebar text-text-sidebar-muted cursor-pointer w-[34px] h-[34px] rounded flex items-center justify-center transition-all duration-200 hover:bg-nav-hover-bg hover:text-text-sidebar"
                aria-label={t('navigation:toggleTheme')}
                onClick={toggleTheme}
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </MobileDrawer>}

        {/* Main Content Area */}
        <main
          data-drawer-background
          className={`flex-1 min-w-0 p-0 flex flex-col overflow-x-hidden ${staticTools.has(activeTool) ? 'overflow-y-auto md:overflow-y-hidden' : 'overflow-y-auto'}`}
          style={mainContentHeightStyle}
        >
          {/* Desktop Top Header — hidden on mobile (max-md) */}
          <AppHeader
            activeTool={activeTool}
            categories={categoriesLocalized}
            isSearchFocused={isSearchFocused}
            modeProfile={modeProfile}
            navItems={navItems}
            openCategory={openDropdown}
            searchQuery={searchQuery}
            searchRef={searchRef}
            searchResults={filteredSearchNavItems}
            t={t}
            theme={theme}
            onGoHome={handleAllToolsHomeClick}
            onModeChange={handleModeChange}
            onOpenCategory={setOpenDropdown}
            onSearchChange={setSearchQuery}
            onSearchFocus={() => setIsSearchFocused(true)}
            onSelectCategory={(categoryId) => {
              handleNavClick('tool-home');
              setSelectedHomeTab(categoryId);
              setOpenDropdown(null);
            }}
            onSelectTool={(toolId) => {
              handleNavClick(toolId);
              setOpenDropdown(null);
              setSearchQuery('');
            }}
            onToggleTheme={toggleTheme}
          />

          {/* Mobile Top Bar — shown only on mobile (max-md) */}
          <div
            id="mobile-breadcrumb"
            className="hidden max-md:flex items-center justify-between py-3 border-b border-border min-h-[52px] sticky bg-app z-10 px-4"
            style={{ top: '60px' }}
          >
            <div className="flex items-center gap-2">
              {/* Brand logo for mobile breadcrumb */}
              <button
                type="button"
                id="top-brand-logo"
                className="cursor-pointer bg-transparent border-none p-0 text-accent"
                title={t('navigation:goHome')}
                aria-label={t('navigation:goHome')}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  handleAllToolsHomeClick();
                }}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </button>
              {activeTool !== 'tool-home' && (
                <>
                  <button
                    className="flex items-center gap-1 bg-transparent border-none text-text-muted cursor-pointer text-[0.82rem] font-sans px-2 py-1 rounded-sm transition-[color,background] duration-150 hover:text-accent hover:bg-accent-light"
                    onClick={() => handleNavClick('tool-home')}
                    title={t('navigation:backHome')}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    {t('navigation:home')}
                  </button>
                  <span className="text-text-muted text-[0.82rem] opacity-50">/</span>
                </>
              )}
              <span className="text-[0.9rem] font-semibold text-text-main">{activeTitle}</span>
            </div>
          </div>

          {/* Tool Stage */}
          <section className={`tool-stage w-full flex-1 flex flex-col items-center px-12 max-md:px-[14px] max-[500px]:px-[10px] ${staticTools.has(activeTool) ? 'tool-stage--static py-4 md:py-1.5 max-md:pt-[100px] md:max-h-[calc(100vh-var(--banner-height)-98px)] md:overflow-y-auto' : 'py-8 max-md:pt-[100px]'}`}>
            {renderActiveTool()}
          </section>

          {/* Footer */}
          <AppFooter
            activeTool={activeTool}
            appVersion={APP_VERSION}
            categories={categoriesLocalized}
            language={i18n.resolvedLanguage}
            modeId={modeProfile.id}
            navItems={modeNavItems}
            t={t}
            onEmailClick={handleEmailClick}
            onOpenConsent={() => setIsConsentModalOpen(true)}
            onOpenPrivacy={() => handleNavClick('privacy')}
            onSelectCategory={(categoryId) => {
              navigateToTool('tool-home');
              setSelectedHomeTab(categoryId);
            }}
            onSelectTool={handleNavClick}
          />
        </main>

        {/* Third Party Consent Manager Modal */}
        <ThirdPartyConsentModal
          isOpen={isConsentModalOpen}
          onClose={() => setIsConsentModalOpen(false)}
          onOpenPrivacy={() => {
            setIsConsentModalOpen(false);
            handleNavClick('privacy');
          }}
        />

        {/* Collapsed Sidebar Hover Tooltip */}
        {tooltipState.visible && (
          <div
            className="fixed bg-card text-text-main px-3 py-[6px] rounded text-[0.8rem] font-semibold whitespace-nowrap border border-border shadow-card opacity-100 pointer-events-none -translate-y-1/2 z-[1000] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ top: `${tooltipState.top}px`, left: `${tooltipState.left}px` }}
          >
            {tooltipState.text}
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 bg-[var(--bg-card-solid,var(--bg-card))] border border-border px-4 py-3 rounded-lg shadow-lg z-[9999] flex items-center gap-2 text-text-main text-[0.85rem] font-medium animate-fade-in">
            <svg className="text-[#10b981] w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
