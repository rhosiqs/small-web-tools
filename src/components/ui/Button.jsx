import React from 'react';

/**
 * Shared Button primitive — Phase 1 Tailwind migration.
 *
 * Parity targets in current styles.css:
 *   variant="primary"   -> `.btn-primary` (line 755). Note: its box-shadow was
 *                          hardcoded as `rgba(99, 102, 241, 0.2)` — that's Tailwind's
 *                          indigo-500, left over from before --accent was switched to
 *                          emerald (#10b981). This component uses `--accent-light`
 *                          instead to fix that drift (intentional visible change,
 *                          flagged in DRAFT-NOTES.md).
 *
 *   variant="secondary" -> `.btn-secondary` (line 1508, the winning duplicate — the
 *                          dead block at line 1116 was deleted as part of Phase 1).
 *
 *   variant="danger"    -> `.btn-danger-custom` (line 2449) / `.btn-danger-confirm`
 *                          (2691) — these two were NOT compared in this draft pass;
 *                          this variant is a placeholder pending a real parity pass.
 */

const base =
  'inline-flex items-center justify-center gap-1.5 rounded font-semibold cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

const variants = {
  primary:
    'bg-accent-gradient text-white px-5 py-2.5 text-[0.88rem] shadow-[0_4px_10px_var(--accent-light)] hover:-translate-y-px hover:shadow-[0_6px_14px_var(--accent-light)] active:translate-y-0',
  secondary:
    'bg-app border border-border text-text-muted px-3.5 py-[7px] text-[0.82rem] hover:bg-nav-hover-bg hover:border-accent hover:text-accent aria-pressed:bg-nav-active-bg aria-pressed:border-accent aria-pressed:text-nav-active-text',
  danger:
    'bg-red-500/10 border border-red-500/25 text-red-500 px-3.5 py-[7px] text-[0.82rem] hover:bg-red-500 hover:text-white hover:border-red-500 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(239,68,68,0.2)] active:translate-y-0',
  dangerConfirm:
    'bg-red-500 text-white px-5 py-2.5 text-[0.88rem] hover:bg-red-600 active:bg-red-700',
};

const sizes = {
  default: '',
  sm: 'text-xs px-3 py-1.5',
};

export default function Button({
  variant = 'secondary',
  size = 'default',
  active = false, // maps the old `.btn-secondary.active` state
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      className={[base, variants[variant], sizes[size], className].filter(Boolean).join(' ')}
      aria-pressed={active || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
