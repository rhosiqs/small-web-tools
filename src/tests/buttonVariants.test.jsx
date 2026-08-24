import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Button, { variants } from '../components/ui/Button.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderButton(props) {
  await act(async () => root.render(<Button {...props}>Action</Button>));
  return container.querySelector('button');
}

/**
 * These assertions pin the danger variants to the pre-migration CSS they were
 * ported from (`.btn-danger-custom` and `.btn-danger-confirm` in styles.css at
 * revision 7ee9174), so the parity pass from issue #75 cannot silently drift.
 */
describe('Button danger variants', () => {
  it('matches the legacy .btn-danger-custom rule for variant="danger"', async () => {
    const button = await renderButton({ variant: 'danger' });
    const classes = button.className.split(' ');

    // background: rgba(239, 68, 68, 0.08); color/border: #ef4444 at 20%
    expect(classes).toContain('bg-red-500/[0.08]');
    expect(classes).toContain('text-red-500');
    expect(classes).toContain('border-red-500/20');
    // padding: 12px 24px; border-radius: 10px; font-size: 0.95rem
    expect(classes).toContain('px-6');
    expect(classes).toContain('py-3');
    expect(classes).toContain('rounded-md');
    expect(classes).toContain('text-[0.95rem]');
    // hover fills solid red and lifts; active drops back
    expect(classes).toContain('hover:bg-red-500');
    expect(classes).toContain('hover:text-white');
    expect(classes).toContain('hover:border-red-500');
    expect(classes).toContain('hover:-translate-y-px');
    expect(classes).toContain('hover:shadow-[0_4px_12px_rgba(239,68,68,0.2)]');
    expect(classes).toContain('active:translate-y-0');
  });

  it('matches the legacy .btn-danger-confirm rule for variant="dangerConfirm"', async () => {
    const button = await renderButton({ variant: 'dangerConfirm' });
    const classes = button.className.split(' ');

    // background #ef4444 / hover #dc2626, white text, no border
    expect(classes).toContain('bg-red-500');
    expect(classes).toContain('text-white');
    expect(classes).toContain('hover:bg-red-600');
    expect(classes).not.toContain('border');
    // padding: 10px 18px; border-radius: 8px; font-size: 0.9rem
    expect(classes).toContain('px-[18px]');
    expect(classes).toContain('py-2.5');
    expect(classes).toContain('rounded');
    expect(classes).toContain('text-[0.9rem]');
  });

  // Enumerated from the map rather than a literal list: `base` no longer carries
  // a radius, so a variant added later without one would render square.
  it('keeps a single border-radius utility per variant', async () => {
    expect(Object.keys(variants).length).toBeGreaterThan(0);

    for (const variant of Object.keys(variants)) {
      const button = await renderButton({ variant });
      const radii = button.className
        .split(' ')
        .filter((token) => token === 'rounded' || token.startsWith('rounded-'));
      expect(radii, `variant="${variant}"`).toHaveLength(1);
    }
  });
});
