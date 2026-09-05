/**
 * All values below map 1:1 to the CSS custom properties already defined in
 * src/styles.css (:root and html[data-theme="dark"]). We reference them via
 * var(--token) rather than hardcoding hex values, so light/dark theming
 * keeps working exactly as it does today — Tailwind classes like `bg-app`
 * or `text-main` just resolve to whatever the current theme's CSS variable
 * is, with zero duplication of the color values themselves.
 */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'], // matches existing html[data-theme="dark"] toggle
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        sidebar: 'var(--bg-sidebar)',
        card: 'var(--bg-card)',
        header: 'var(--bg-header)',
        footer: 'var(--bg-footer)',

        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        'text-sidebar': 'var(--text-sidebar)',
        'text-sidebar-muted': 'var(--text-sidebar-muted)',

        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-light': 'var(--accent-light)',
        'accent-edge': 'var(--accent-edge)',

        border: 'var(--border-color)',
        'border-hover': 'var(--border-hover)',
        'border-sidebar': 'var(--border-sidebar)',

        'nav-active-bg': 'var(--nav-active-bg)',
        'nav-active-text': 'var(--nav-active-text)',
        'nav-hover-bg': 'var(--nav-hover-bg)',

        'warning-bg': 'var(--bg-warning-banner)',
        'warning-border': 'var(--border-warning-banner)',
        'warning-text': 'var(--text-warning-banner)',
      },
      backgroundImage: {
        'accent-gradient': 'var(--accent-gradient)',
      },
      borderRadius: {
        // codifies the ad-hoc radius values found across styles.css
        // (2px–28px with no scale) into a small deliberate set
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '14px',
        xl: '18px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        sidebar: 'var(--shadow-sidebar)',
      },
      ringColor: {
        focus: 'var(--focus-ring)',
      },
      fontFamily: {
        // unchanged for this phase — do not touch typography here.
        // (Font-family cleanup, if wanted, is a separate visual decision
        // from the earlier design discussion, not part of this refactor.)
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
