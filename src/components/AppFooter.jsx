import { DOCUMENT_ROUTE_IDS, sortLocalizedTools } from '../toolRouteMetadata.js';
import { PROJECT_REPOSITORY_URL } from '../lib/projectLinks.js';

const footerLinkClass = 'border-none bg-transparent p-0 font-sans text-[0.78rem] text-text-muted transition-colors hover:text-accent';
const externalLinkClass = 'inline-flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export default function AppFooter({
  activeTool,
  appVersion,
  categories,
  language,
  modeId,
  navItems,
  t,
  onEmailClick,
  onSelectCategory,
  onSelectDocument,
  onSelectTool,
}) {
  const showSitemap = activeTool === 'tool-home' && modeId === 'all';

  return (
    <footer className="mt-auto w-full border-t border-border bg-footer">
      {showSitemap && (
        <div className="mx-auto grid max-w-[1200px] grid-cols-6 gap-x-4 gap-y-6 px-12 py-7 max-[1200px]:grid-cols-4 max-md:grid-cols-3 max-md:px-8 max-md:py-6 max-[500px]:grid-cols-2 max-[500px]:px-4 max-[500px]:py-5">
          {categories.map((category) => {
            const categoryItems = navItems.filter((item) => item.category === category.id);
            if (categoryItems.length === 0) return null;
            const groups = categoryItems.reduce((result, item) => {
              const group = item.subGroup || 'Utilities';
              return { ...result, [group]: [...(result[group] || []), item] };
            }, {});
            return (
              <div key={category.id} className="flex flex-col gap-[10px]">
                <button type="button" className="mb-1 border-none bg-transparent p-0 text-left font-sans text-[0.72rem] font-bold uppercase tracking-[0.08em] text-text-muted transition-colors hover:text-accent" onClick={() => onSelectCategory(category.id)}>
                  {category.name}
                </button>
                {category.id === 'utilities'
                  ? Object.keys(groups).sort().flatMap((groupName) => [
                    <span key={`${groupName}-heading`} className="mt-2 text-[0.65rem] font-bold uppercase tracking-[0.05em] text-text-muted opacity-50">{groupName}</span>,
                    ...sortLocalizedTools(groups[groupName], language).map((item) => (
                      <button type="button" key={item.id} className="border-none bg-transparent p-0 pl-2 text-left font-sans text-[0.83rem] leading-[1.5] text-text-muted transition-colors hover:text-accent" onClick={() => onSelectTool(item.id)}>{item.name}</button>
                    )),
                  ])
                  : categoryItems.map((item) => (
                    <button type="button" key={item.id} className="border-none bg-transparent p-0 text-left font-sans text-[0.83rem] leading-[1.5] text-text-muted transition-colors hover:text-accent" onClick={() => onSelectTool(item.id)}>{item.name}</button>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="mx-auto w-full max-w-[1200px] px-12 py-4 text-[0.78rem] text-text-muted max-md:px-8 max-[500px]:px-4">
        <div className={`flex flex-wrap items-center justify-between gap-x-8 gap-y-3 max-md:flex-col max-md:items-start ${showSitemap ? 'border-t border-border pt-4' : ''}`}>
          <div className="flex items-center max-md:flex-col max-md:items-start max-md:gap-1">
            <span className="font-display font-bold text-text-main">{t('common:productName')}</span>
            <span className="mx-1 text-text-muted max-md:hidden" aria-hidden="true"> · </span>
            <span>{t('navigation:footer.copyright', { year: new Date().getFullYear(), version: appVersion })}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 max-md:gap-x-4">
            <nav aria-label={t('navigation:footer.documents')} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {DOCUMENT_ROUTE_IDS.map((documentId) => (
                <button
                  key={documentId}
                  type="button"
                  className={footerLinkClass}
                  title={t(`tools:${documentId}.tooltip`)}
                  onClick={() => onSelectDocument(documentId)}
                >
                  {t(`tools:${documentId}.title`)}
                </button>
              ))}
            </nav>
            <nav aria-label={t('navigation:footer.external')} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <a href="mailto:emailforvirtualmachine@gmail.com" onClick={onEmailClick} className={externalLinkClass} title={t('navigation:footer.email')} aria-label={t('navigation:footer.email')}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              </a>
              <a href="https://rhosiqs.com" target="_blank" rel="noopener noreferrer" className={externalLinkClass} title={t('navigation:footer.website')} aria-label={t('navigation:footer.website')}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
              </a>
              <a href={PROJECT_REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className={externalLinkClass} title={t('navigation:footer.github')} aria-label={t('navigation:footer.github')}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.74-1.33-1.74-1.09-.74.08-.73.08-.73 1.2.08 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.48 1 .11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02.01 2.04.14 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" /></svg>
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
