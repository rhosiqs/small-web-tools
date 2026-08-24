import React from 'react';
import { useTranslation } from 'react-i18next';
import AudienceSwitcher from './AudienceSwitcher.jsx';
import { CATEGORY_DEFINITIONS as categories } from '../categoryDefinitions.jsx';
import { getToolMode, localizeToolMode } from '../toolModes.js';
import { sortLocalizedTools } from '../toolRegistry.js';
import Card from './ui/Card.jsx';

// Theme config: border, icon bg/color, hover border, hover shadow
const THEME = {
  green:  { border: 'border-[rgba(16,185,129,0.15)]',   iconBg: 'bg-[rgba(16,185,129,0.08)] text-[#10b981]',   hover: 'hover:border-[#10b981] hover:shadow-[0_12px_30px_-10px_rgba(16,185,129,0.2),0_0_1px_1px_rgba(16,185,129,0.1)]' },
  blue:   { border: 'border-[rgba(59,130,246,0.15)]',   iconBg: 'bg-[rgba(59,130,246,0.08)] text-[#3b82f6]',   hover: 'hover:border-[#3b82f6] hover:shadow-[0_12px_30px_-10px_rgba(59,130,246,0.2),0_0_1px_1px_rgba(59,130,246,0.1)]' },
  purple: { border: 'border-[rgba(139,92,246,0.15)]',   iconBg: 'bg-[rgba(139,92,246,0.08)] text-[#8b5cf6]',   hover: 'hover:border-[#8b5cf6] hover:shadow-[0_12px_30px_-10px_rgba(139,92,246,0.2),0_0_1px_1px_rgba(139,92,246,0.1)]' },
  pink:   { border: 'border-[rgba(236,72,153,0.15)]',   iconBg: 'bg-[rgba(236,72,153,0.08)] text-[#ec4899]',   hover: 'hover:border-[#ec4899] hover:shadow-[0_12px_30px_-10px_rgba(236,72,153,0.2),0_0_1px_1px_rgba(236,72,153,0.1)]' },
  gold:   { border: 'border-[rgba(245,158,11,0.15)]',   iconBg: 'bg-[rgba(245,158,11,0.08)] text-[#f59e0b]',   hover: 'hover:border-[#f59e0b] hover:shadow-[0_12px_30px_-10px_rgba(245,158,11,0.2),0_0_1px_1px_rgba(245,158,11,0.1)]' },
  teal:   { border: 'border-[rgba(20,184,166,0.15)]',   iconBg: 'bg-[rgba(20,184,166,0.08)] text-[#14b8a6]',   hover: 'hover:border-[#14b8a6] hover:shadow-[0_12px_30px_-10px_rgba(20,184,166,0.2),0_0_1px_1px_rgba(20,184,166,0.1)]' },
};

const getTheme = (category) => {
  const map = { text: 'pink', developer: 'green', network: 'blue', media: 'gold', bioinfo: 'teal', utilities: 'purple' };
  return THEME[map[category]] ?? THEME.purple;
};

function ToolCard({ tool, onSelectTool }) {
  const theme = getTheme(tool.category);
  return (
    <Card
      variant="home"
      clickable
      className={`${theme.border} ${theme.hover}`}
      onClick={() => onSelectTool(tool.id)}
    >
      <div className="flex items-start gap-4 w-full">
        <div className={`w-[46px] h-[46px] rounded-[10px] flex items-center justify-center flex-shrink-0 transition-all duration-300 ${theme.iconBg} [&_svg]:w-5 [&_svg]:h-5 [&_svg]:flex-shrink-0`}>
          {tool.icon}
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <h3 className="text-[1.05rem] font-bold text-text-main tracking-[-0.01em] m-0">{tool.name}</h3>
          <p className="text-[0.84rem] text-text-muted leading-[1.45] m-0">{tool.desc}</p>
        </div>
      </div>
    </Card>
  );
}

export default function HomeGrid({
  tools = [],
  onSelectTool,
  activeTab = 'all',
  modeId = 'all',
  onSelectMode = () => {},
}) {
  const { t, i18n } = useTranslation('navigation');
  const mode = localizeToolMode(getToolMode(modeId), t);
  const localizedCategories = categories.map((category) => ({
    ...category,
    name: t(`categories.${category.nameKey}`),
  }));
  const isCuratedMode = mode.id !== 'all';
  const curatedTools = activeTab === 'all'
    ? tools
    : tools.filter((tool) => tool.category === activeTab);
  const activeCategory = localizedCategories.find((category) => category.id === activeTab);

  function renderGrid(toolList) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5 mt-6">
        {toolList.map(tool => (
          <ToolCard key={tool.id} tool={tool} onSelectTool={onSelectTool} />
        ))}
      </div>
    );
  }

  function renderSubGroups(catTools) {
    const subGroups = {};
    catTools.forEach(tool => {
      const sg = tool.subGroup || t('categories.utilities');
      if (!subGroups[sg]) subGroups[sg] = [];
      subGroups[sg].push(tool);
    });
    const sortedSubGroupNames = Object.keys(subGroups).sort();
    return sortedSubGroupNames.map(sgName => (
      <div key={sgName} className="mt-6 mb-6">
        <h4 className="text-[0.9rem] font-bold uppercase tracking-[0.05em] text-text-muted mb-3 pl-1.5 border-l-2 border-accent leading-none">
          {sgName}
        </h4>
        {renderGrid(sortLocalizedTools(subGroups[sgName], i18n.resolvedLanguage))}
      </div>
    ));
  }

  return (
    <div id="tool-home" className="w-full max-w-[1200px] mx-auto">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[1.85rem] font-bold text-text-main tracking-[-0.02em]">{mode.heading}</h1>
          <p className="text-[0.95rem] text-text-muted leading-[1.5]">{mode.description}</p>
        </div>
        <div className="max-w-full overflow-x-auto pb-1 lg:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <AudienceSwitcher
            activeModeId={mode.id}
            onSelectMode={onSelectMode}
            mobile
          />
        </div>
      </div>

      {isCuratedMode ? (
        <section aria-label={t('homeGrid.categoryTools', { category: mode.label })}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-text-main">
              {activeCategory
                ? t('homeGrid.categoryTools', { category: activeCategory.name })
                : t('homeGrid.recommended', { audience: mode.label })}
            </h2>
            <span className="rounded-full border border-border bg-app px-3 py-1 text-xs font-semibold text-text-muted">
              {t('homeGrid.toolCount', { count: curatedTools.length })}
            </span>
          </div>
          {renderGrid(curatedTools)}
        </section>
      ) : activeTab === 'all' ? (
        localizedCategories.map(cat => {
          const catTools = tools.filter(t => t.category === cat.id);
          if (catTools.length === 0) return null;

          return (
            <div key={cat.id} className="mb-10 last:mb-0">
              <h3 className="text-[1.25rem] font-bold text-text-main mb-[18px] flex items-center gap-2 tracking-[-0.01em] [&>svg]:text-accent [&>svg]:w-[18px] [&>svg]:h-[18px]">
                {cat.icon}
                {cat.name}
              </h3>
              {cat.id === 'utilities'
                ? renderSubGroups(catTools)
                : renderGrid(catTools)
              }
            </div>
          );
        })
      ) : activeTab === 'utilities' ? (
        <div className="mb-10">
          {renderSubGroups(tools.filter(t => t.category === 'utilities'))}
        </div>
      ) : (
        <div className="mb-10">
          {(() => {
            const cat = localizedCategories.find(c => c.id === activeTab);
            return (
              <>
                {cat && (
                  <h3 className="text-[1.25rem] font-bold text-text-main mb-[18px] flex items-center gap-2 tracking-[-0.01em] [&>svg]:text-accent [&>svg]:w-[18px] [&>svg]:h-[18px]">
                    {cat.icon}
                    {cat.name}
                  </h3>
                )}
                {renderGrid(tools.filter(t => t.category === activeTab))}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
