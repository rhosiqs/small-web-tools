import React from 'react';

/**
 * Shared Button primitive — Phase 1 Tailwind migration.
 *
 * Parity targets in the pre-migration styles.css (revision 7ee9174, the last
 * revision that still carried these blocks; the line numbers below are that
 * file's):
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
 *   variant="danger"    -> `.btn-danger-custom` (line 2449)
 *   variant="dangerConfirm"
 *                       -> `.btn-danger-confirm` (line 2691)
 *                          Both were compared property by property in a dedicated
 *                          parity pass (issue #75); the classes below now match the
 *                          legacy rules, so these are no longer placeholders and
 *                          `variant="danger"` is free to use in tool components.
 *                          `.btn-danger-custom` already had no JSX caller at that
 *                          revision (dead CSS), so `danger` is a verified styling
 *                          contract rather than a restored call site.
 *                          Two deliberate equivalences, not drift: `border: none` on
 *                          `.btn-danger-confirm` is expressed by simply omitting a
 *                          border utility, and its `transition: background-color .2s`
 *                          is covered by the shared `transition-all duration-200`
 *                          (background-color is the only property that changes).
 *
 * Border radius lives on each variant rather than on `base` because the legacy
 * rules disagreed: 8px for primary/secondary/dangerConfirm (`rounded`) but 10px
 * for `.btn-danger-custom` (`rounded-md`). Stacking `rounded-md` on top of a
 * `rounded` in `base` would leave the winner up to stylesheet order.
 */

const base =
  'inline-flex items-center justify-center gap-1.5 font-semibold cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

const variants = {
  primary:
    'rounded bg-accent-gradient text-white px-5 py-2.5 text-[0.88rem] shadow-[0_4px_10px_var(--accent-light)] hover:-translate-y-px hover:shadow-[0_6px_14px_var(--accent-light)] active:translate-y-0',
  secondary:
    'rounded bg-app border border-border text-text-muted px-3.5 py-[7px] text-[0.82rem] hover:bg-nav-hover-bg hover:border-accent hover:text-accent aria-pressed:bg-nav-active-bg aria-pressed:border-accent aria-pressed:text-nav-active-text',
  danger:
    'rounded-md bg-red-500/[0.08] border border-red-500/20 text-red-500 px-6 py-3 text-[0.95rem] hover:bg-red-500 hover:text-white hover:border-red-500 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(239,68,68,0.2)] active:translate-y-0',
  dangerConfirm:
    'rounded bg-red-500 text-white px-[18px] py-2.5 text-[0.9rem] hover:bg-red-600',
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
