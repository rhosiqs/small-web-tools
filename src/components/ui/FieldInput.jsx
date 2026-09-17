import React from 'react';

/**
 * Shared FieldInput primitive — Phase 1 Tailwind migration.
 *
 * Parity target: the generic `textarea, input[type="text"], ...` block
 * in styles.css (line 672-752), which currently styles every plain input/textarea
 * in the app via bare element selectors (no class needed today — so this is the
 * one primitive where adopting it is an actual behavior change: existing raw
 * <input>/<textarea> tags elsewhere keep working unchanged from that global rule
 * during the coexistence period; FieldInput is for new/migrated code that wants
 * label + hint + error affordances the current markup doesn't have anywhere).
 *
 * Adds: label, hint text, error state — none of which exist in the current
 * global input styling (there's no shared error/hint pattern in styles.css
 * today; each tool improvises its own, e.g. `.password-check-input`,
 * `.color-picker-input`). This is a genuine small upgrade — intentional.
 */

const baseControl =
  'w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 ' +
  'hover:border-border-hover ' +
  'focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card ' +
  'read-only:bg-app read-only:opacity-80 read-only:focus:ring-0 read-only:focus:border-border';

const errorControl = 'border-red-400 focus:border-red-500 focus:ring-red-200';

export default function FieldInput({
  label,
  hint = null,
  error = null,
  as = 'input', // 'input' | 'textarea'
  className = '',
  id,
  ...rest
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const controlProps = {
    id: inputId,
    className: [baseControl, error ? errorControl : '', className].filter(Boolean).join(' '),
    'aria-invalid': Boolean(error) || undefined,
    'aria-describedby': error || hint ? `${inputId}-note` : undefined,
    ...rest,
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-main">
          {label}
        </label>
      )}
      {as === 'textarea' ? <textarea {...controlProps} /> : <input {...controlProps} />}
      {(error || hint) && (
        <span
          id={`${inputId}-note`}
          className={error ? 'text-xs text-red-600 dark:text-red-400' : 'text-xs text-text-muted'}
        >
          {error || hint}
        </span>
      )}
    </div>
  );
}
