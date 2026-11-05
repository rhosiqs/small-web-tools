import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AudienceSwitcher from '../components/AudienceSwitcher.jsx';

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

describe('AudienceSwitcher', () => {
  it('shows Home plus only the five requested audiences', async () => {
    await act(async () => root.render(
      <AudienceSwitcher activeModeId="developer" onSelectMode={vi.fn()} />,
    ));

    expect([...container.querySelectorAll('button')].map((button) => button.textContent))
      .toEqual(['Home', 'Daily', 'Developer', 'Bioinfo', 'Designer', 'Student']);
    expect(container).not.toHaveTextContent('Simple');
    expect(container.querySelector('[aria-pressed="true"]')).toHaveTextContent('Developer');
    expect(container.querySelector('button')).toHaveAccessibleName('Home, show all tools');
  });

  it('switches immediately from a segmented button', async () => {
    const onSelectMode = vi.fn();
    await act(async () => root.render(
      <AudienceSwitcher activeModeId="all" onSelectMode={onSelectMode} />,
    ));

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Bioinfo')
        .click();
    });
    expect(onSelectMode).toHaveBeenCalledWith('bioinformatics');
  });
});
