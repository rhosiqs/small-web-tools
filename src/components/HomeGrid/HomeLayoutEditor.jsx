import React, { useEffect, useState } from 'react';
import { sanitizeGroupName } from '../../lib/homeLayout.js';

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

const controlClasses = 'inline-flex items-center gap-1.5 rounded-lg border border-border bg-app px-2.5 py-1.5 text-xs font-bold text-text-main transition hover:border-accent hover:bg-accent-light hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border disabled:hover:bg-app disabled:hover:text-text-main';
const selectClasses = 'max-w-[150px] truncate rounded-lg border border-border bg-app px-2 py-1.5 text-xs font-semibold text-text-main outline-none transition focus:border-accent focus:ring-2 focus:ring-focus';

/**
 * The stored name is trimmed, so the field keeps its own draft: typing a space
 * inside a name must not be swallowed by the record it is being written to.
 */
function GroupNameField({ group, onRename, t }) {
  const [draft, setDraft] = useState(group.name ?? '');

  useEffect(() => {
    setDraft((current) => (sanitizeGroupName(current) === group.name ? current : group.name ?? ''));
  }, [group.name]);

  return (
    <input
      type="text"
      value={draft}
      placeholder={group.label}
      aria-label={t('homeGrid.groupName', { group: group.label })}
      onChange={(event) => {
        setDraft(event.target.value);
        onRename(group.id, event.target.value);
      }}
      className="min-w-0 flex-1 rounded-lg border border-border bg-app !px-3 !py-1.5 text-sm font-bold text-text-main outline-none transition focus:border-accent focus:ring-2 focus:ring-focus"
    />
  );
}

function GroupSelect({ groups, value, label, placeholder = null, onSelect }) {
  return (
    <select
      value={value ?? ''}
      aria-label={label}
      onChange={(event) => onSelect(event.target.value)}
      className={selectClasses}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {groups.map((group) => (
        <option key={group.id} value={group.id}>{group.label}</option>
      ))}
    </select>
  );
}

function ToolRow({ tool, icon, children = null }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-text-main">{tool.name}</span>
        <span className="block truncate text-xs text-text-muted">{tool.desc}</span>
      </span>
      {children}
    </div>
  );
}

/**
 * The homepage arrangement editor. Every control writes through to the stored
 * layout immediately, so there is nothing to save and nothing to lose.
 */
export default function HomeLayoutEditor({
  groups,
  hiddenTools,
  isCustomized,
  canAddGroup,
  canRemoveGroup,
  maxGroups,
  onAddGroup,
  onRemoveGroup,
  onRenameGroup,
  onMoveGroup,
  onMoveTool,
  onPlaceTool,
  onHideTool,
  onReset,
  t,
}) {
  return (
    <div id="home-layout-editor">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <p className="max-w-[560px] text-xs leading-5 text-text-muted">{t('homeGrid.editHint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAddGroup}
            disabled={!canAddGroup}
            title={canAddGroup ? undefined : t('homeGrid.groupLimit', { count: maxGroups })}
            className={controlClasses}
          >
            <svg {...iconProps}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            {t('homeGrid.addGroup')}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={!isCustomized}
            className={controlClasses}
          >
            <svg {...iconProps}>
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
            {t('homeGrid.resetLayout')}
          </button>
        </div>
      </div>

      {groups.map((group, groupIndex) => (
        <section
          key={group.id}
          data-group={group.id}
          aria-label={group.label}
          className="mb-5 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent [&_svg]:h-[18px] [&_svg]:w-[18px]">
              {group.icon}
            </span>
            <GroupNameField group={group} onRename={onRenameGroup} t={t} />
            <span className="shrink-0 text-xs font-semibold text-text-muted">
              {t('homeGrid.toolCount', { count: group.tools.length })}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => onMoveGroup(group.id, -1)}
                disabled={groupIndex === 0}
                aria-label={t('homeGrid.moveGroupEarlier', { group: group.label })}
                className={controlClasses}
              >
                <svg {...iconProps}><polyline points="18 15 12 9 6 15" /></svg>
              </button>
              <button
                type="button"
                onClick={() => onMoveGroup(group.id, 1)}
                disabled={groupIndex === groups.length - 1}
                aria-label={t('homeGrid.moveGroupLater', { group: group.label })}
                className={controlClasses}
              >
                <svg {...iconProps}><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              <button
                type="button"
                onClick={() => onRemoveGroup(group.id)}
                disabled={!canRemoveGroup}
                aria-label={t('homeGrid.removeGroup', { group: group.label })}
                title={canRemoveGroup ? t('homeGrid.removeGroupHint') : t('homeGrid.keepOneGroup')}
                className={controlClasses}
              >
                <svg {...iconProps}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>

          {group.tools.length > 0 ? (
            <ul className="mt-4 grid gap-2 lg:grid-cols-2">
              {group.tools.map((tool, toolIndex) => (
                <li
                  key={tool.id}
                  className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-app p-3"
                >
                  <ToolRow tool={tool} icon={tool.icon} />
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onMoveTool(group.id, tool.id, -1)}
                      disabled={toolIndex === 0}
                      aria-label={t('homeGrid.moveToolEarlier', { name: tool.name })}
                      className={controlClasses}
                    >
                      <svg {...iconProps}><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveTool(group.id, tool.id, 1)}
                      disabled={toolIndex === group.tools.length - 1}
                      aria-label={t('homeGrid.moveToolLater', { name: tool.name })}
                      className={controlClasses}
                    >
                      <svg {...iconProps}><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                    <GroupSelect
                      groups={groups}
                      value={group.id}
                      label={t('homeGrid.toolGroup', { name: tool.name })}
                      onSelect={(groupId) => onPlaceTool(tool.id, groupId)}
                    />
                    <button
                      type="button"
                      onClick={() => onHideTool(tool.id)}
                      aria-label={t('homeGrid.hideTool', { name: tool.name })}
                      className={controlClasses}
                    >
                      <svg {...iconProps}>
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-4 text-center text-xs text-text-muted">
              {t('homeGrid.emptyGroup')}
            </p>
          )}
        </section>
      ))}

      <section className="mt-8" aria-labelledby="home-hidden-heading">
        <h2 id="home-hidden-heading" className="mb-3 text-lg font-bold text-text-main">
          {t('homeGrid.hiddenHeading')}
        </h2>
        {hiddenTools.length > 0 ? (
          <ul className="grid max-h-[360px] gap-2 overflow-y-auto lg:grid-cols-2">
            {hiddenTools.map((tool) => (
              <li
                key={tool.id}
                className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
              >
                <ToolRow tool={tool} icon={tool.icon} />
                <GroupSelect
                  groups={groups}
                  value=""
                  placeholder={t('homeGrid.restoreTool')}
                  label={t('homeGrid.restoreToolLabel', { name: tool.name })}
                  onSelect={(groupId) => onPlaceTool(tool.id, groupId)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-text-muted">
            {t('homeGrid.hiddenNone')}
          </p>
        )}
      </section>
    </div>
  );
}
