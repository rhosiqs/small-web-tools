import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimpleLayout } from '../hooks/useSimpleLayout.js';

const iconProps = {
  viewBox: '0 0 24 24',
  width: 16,
  height: 16,
  stroke: 'currentColor',
  strokeWidth: 2,
  fill: 'none',
  strokeLinecap: /** @type {const} */ ('round'),
  strokeLinejoin: /** @type {const} */ ('round'),
  'aria-hidden': true,
};

export default function SimpleHome({ tools = [], onSelectTool }) {
  const { t, i18n } = useTranslation('navigation');
  const [query, setQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [addQuery, setAddQuery] = useState('');

  const availableIds = useMemo(() => tools.map((tool) => tool.id), [tools]);
  const {
    toolIds,
    isCustomized,
    canAddTool,
    canRemoveTool,
    maxTools,
    addTool,
    removeTool,
    moveTool,
    resetLayout,
  } = useSimpleLayout(availableIds);

  const localeTag = i18n.resolvedLanguage;
  const normalizedQuery = query.trim().toLocaleLowerCase(localeTag);
  const normalizedAddQuery = addQuery.trim().toLocaleLowerCase(localeTag);
  const matchesQuery = useCallback(
    (tool, term) => (tool.searchMetadata ?? [tool.name, tool.desc, tool.category])
      .some((entry) => entry.toLocaleLowerCase(localeTag).includes(term)),
    [localeTag],
  );

  const toolsById = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools]);
  const essentialTools = toolIds
    .map((toolId) => toolsById.get(toolId))
    .filter((tool) => Boolean(tool));

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return tools.filter((tool) => matchesQuery(tool, normalizedQuery));
  }, [matchesQuery, normalizedQuery, tools]);

  const addableTools = useMemo(() => {
    if (!isEditing) return [];
    const selected = new Set(toolIds);
    return tools.filter((tool) => !selected.has(tool.id)
      && (!normalizedAddQuery || matchesQuery(tool, normalizedAddQuery)));
  }, [isEditing, matchesQuery, normalizedAddQuery, toolIds, tools]);

  const openTool = (toolId) => {
    setQuery('');
    onSelectTool(toolId);
  };

  const toggleEditing = () => {
    setAddQuery('');
    setIsEditing((editing) => !editing);
  };

  const cardClasses = 'flex min-h-[112px] flex-col items-start rounded-xl border border-border bg-card p-4 text-left shadow-sm';
  const editorButtonClasses = 'inline-flex items-center gap-1.5 rounded-lg border border-border bg-app px-2.5 py-1.5 text-xs font-bold text-text-main transition hover:border-accent hover:bg-accent-light hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border disabled:hover:bg-app disabled:hover:text-text-main';

  return (
    <div id="simple-home" className="mx-auto w-full max-w-[980px]">
      <header className="mx-auto mb-8 max-w-[720px] text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">{t('simpleHome.eyebrow')}</p>
        <h1 className="text-3xl font-bold tracking-[-0.025em] text-text-main sm:text-4xl">
          {t('simpleHome.heading')}
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          {t('simpleHome.description')}
        </p>
      </header>

      <section className="relative mx-auto mb-10 max-w-[720px]" aria-label={t('simpleHome.searchLabel')}>
        <label htmlFor="simple-tool-search" className="sr-only">{t('simpleHome.searchLabel')}</label>
        <svg
          className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-text-muted"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          id="simple-tool-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('simpleHome.searchPlaceholder')}
          autoComplete="off"
          className="h-14 w-full rounded-xl border border-border bg-card !pl-12 !pr-4 text-base text-text-main shadow-card outline-none transition focus:border-accent focus:ring-2 focus:ring-focus"
        />
        {normalizedQuery && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[320px] overflow-y-auto rounded-xl border border-border bg-[var(--bg-card-solid,var(--bg-card))] p-2 shadow-xl">
            {searchResults.length > 0 ? searchResults.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => openTool(tool.id)}
                className="flex w-full items-center gap-3 rounded-lg border-none bg-transparent px-3 py-2.5 text-left text-sm text-text-main transition hover:bg-accent-light hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent [&_svg]:h-4 [&_svg]:w-4">
                  {tool.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{tool.name}</span>
                  <span className="block truncate text-xs text-text-muted">{tool.desc}</span>
                </span>
              </button>
            )) : (
              <p className="px-3 py-5 text-center text-sm text-text-muted">{t('simpleHome.noResults')}</p>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="simple-essentials-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="simple-essentials-heading" className="text-lg font-bold text-text-main">
            {t('simpleHome.essentials')}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-text-muted">{t('homeGrid.toolCount', { count: essentialTools.length })}</span>
            <button
              type="button"
              onClick={toggleEditing}
              aria-expanded={isEditing}
              aria-controls="simple-layout-editor"
              className={editorButtonClasses}
            >
              <svg {...iconProps}>
                {isEditing
                  ? <polyline points="20 6 9 17 4 12" />
                  : <><path d="M4 21v-3.5L16.5 5a2.1 2.1 0 013 3L7 20.5H4z" /><line x1="14.5" y1="7" x2="17" y2="9.5" /></>}
              </svg>
              {t(isEditing ? 'simpleHome.editDone' : 'simpleHome.edit')}
            </button>
          </div>
        </div>

        {isEditing && (
          <div id="simple-layout-editor" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <p className="max-w-[560px] text-xs leading-5 text-text-muted">{t('simpleHome.editHint')}</p>
            <button
              type="button"
              onClick={resetLayout}
              disabled={!isCustomized}
              className={editorButtonClasses}
            >
              <svg {...iconProps}>
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
              </svg>
              {t('simpleHome.resetLayout')}
            </button>
          </div>
        )}

        <div id="simple-essentials-grid" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {essentialTools.map((tool, index) => (isEditing ? (
            <div key={tool.id} className={cardClasses}>
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent-light text-accent [&_svg]:h-[18px] [&_svg]:w-[18px]">
                {tool.icon}
              </span>
              <span className="text-sm font-bold text-text-main">{tool.name}</span>
              <span className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">{tool.desc}</span>
              <div className="mt-3 flex w-full items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => moveTool(tool.id, -1)}
                  disabled={index === 0}
                  aria-label={t('simpleHome.moveEarlier', { name: tool.name })}
                  className={editorButtonClasses}
                >
                  <svg {...iconProps}><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveTool(tool.id, 1)}
                  disabled={index === essentialTools.length - 1}
                  aria-label={t('simpleHome.moveLater', { name: tool.name })}
                  className={editorButtonClasses}
                >
                  <svg {...iconProps}><polyline points="9 18 15 12 9 6" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeTool(tool.id)}
                  disabled={!canRemoveTool}
                  aria-label={t('simpleHome.removeTool', { name: tool.name })}
                  title={canRemoveTool ? undefined : t('simpleHome.keepOne')}
                  className={`${editorButtonClasses} ml-auto`}
                >
                  <svg {...iconProps}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <button
              key={tool.id}
              type="button"
              onClick={() => openTool(tool.id)}
              className={`${cardClasses} group transition hover:-translate-y-0.5 hover:border-accent hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
            >
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent-light text-accent [&_svg]:h-[18px] [&_svg]:w-[18px]">
                {tool.icon}
              </span>
              <span className="text-sm font-bold text-text-main transition group-hover:text-accent">
                {tool.name}
              </span>
              <span className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">{tool.desc}</span>
            </button>
          )))}
        </div>
      </section>

      {isEditing && (
        <section className="mt-8" aria-labelledby="simple-add-heading">
          <h2 id="simple-add-heading" className="mb-3 text-lg font-bold text-text-main">
            {t('simpleHome.addHeading')}
          </h2>
          {canAddTool ? (
            <>
              <label htmlFor="simple-add-search" className="sr-only">{t('simpleHome.addSearchLabel')}</label>
              <input
                id="simple-add-search"
                type="search"
                value={addQuery}
                onChange={(event) => setAddQuery(event.target.value)}
                placeholder={t('simpleHome.addSearchPlaceholder')}
                autoComplete="off"
                className="mb-3 h-11 w-full rounded-xl border border-border bg-card !px-4 text-sm text-text-main outline-none transition focus:border-accent focus:ring-2 focus:ring-focus"
              />
              {addableTools.length > 0 ? (
                <ul className="grid max-h-[320px] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                  {addableTools.map((tool) => (
                    <li key={tool.id}>
                      <button
                        type="button"
                        onClick={() => addTool(tool.id)}
                        aria-label={t('simpleHome.addTool', { name: tool.name })}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm text-text-main transition hover:border-accent hover:bg-accent-light hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent [&_svg]:h-4 [&_svg]:w-4">
                          {tool.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{tool.name}</span>
                          <span className="block truncate text-xs text-text-muted">{tool.desc}</span>
                        </span>
                        <svg {...iconProps}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-text-muted">
                  {t('simpleHome.addNone')}
                </p>
              )}
            </>
          ) : (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-text-muted">
              {t('simpleHome.limitReached', { count: maxTools })}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
