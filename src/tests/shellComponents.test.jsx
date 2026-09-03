import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppFooter from '../components/AppFooter.jsx';
import AppHeader from '../components/AppHeader.jsx';
import { DOCUMENT_ROUTE_IDS } from '../toolRouteMetadata.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const icon = <svg aria-hidden="true" />;
const category = { id: 'media', name: 'Media', icon };
const item = { id: 'tool-imgmeta', name: 'Image Metadata', category: 'media', icon };
const t = (key, values = {}) => ({
  'common:productName': 'Small Web Tools',
  'navigation:goHome': 'Go home',
  'navigation:simpleMode': 'Simple mode',
  'navigation:exitSimpleMode': 'Exit Simple mode',
  'navigation:search.placeholder': 'Search tools',
  'navigation:search.label': 'Search tools',
  'navigation:search.noResults': 'No tools found',
  'navigation:toggleTheme': 'Toggle theme',
  'navigation:footer.copyright': `${values.year} ${values.version}`,
  'navigation:footer.website': 'Website',
  'navigation:footer.email': 'Email',
  'navigation:footer.documents': 'Site documents',
  'navigation:footer.external': 'Project links',
  'navigation:footer.emailLabel': 'Contact',
  'navigation:footer.websiteLabel': 'Website',
  'navigation:footer.githubLabel': 'Repository',
  'navigation:footer.github': 'Repository',
}[key] || key);

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

describe('application shell components', () => {
  it('keeps desktop categories ordinary buttons and delegates search and shell actions', async () => {
    const callbacks = {
      onGoHome: vi.fn(), onModeChange: vi.fn(), onOpenCategory: vi.fn(),
      onSearchChange: vi.fn(), onSearchFocus: vi.fn(), onSelectCategory: vi.fn(),
      onSelectTool: vi.fn(), onToggleTheme: vi.fn(),
    };
    await act(async () => root.render(
      <AppHeader
        activeTool="tool-home"
        categories={[category]}
        isSearchFocused
        modeProfile={{ id: 'all', simplified: false }}
        navItems={[item]}
        openCategory="media"
        searchQuery="image"
        searchRef={createRef()}
        searchResults={[item]}
        t={t}
        theme="dark"
        {...callbacks}
      />,
    ));

    const categoryButton = container.querySelector('nav button');
    expect(categoryButton).not.toHaveAttribute('aria-haspopup');
    expect(categoryButton).not.toHaveAttribute('aria-expanded');
    await act(async () => categoryButton.click());
    expect(callbacks.onSelectCategory).toHaveBeenCalledWith('media');

    const search = container.querySelector('input');
    await act(async () => search.dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
    expect(callbacks.onSearchFocus).toHaveBeenCalled();
    const result = [...container.querySelectorAll('button')].filter((button) => button.textContent.includes('Image Metadata')).at(-1);
    await act(async () => result.click());
    expect(callbacks.onSelectTool).toHaveBeenCalledWith('tool-imgmeta');
    expect(callbacks.onSearchChange).toHaveBeenCalledWith('');

    await act(async () => container.querySelector('[aria-label="Toggle theme"]').click());
    expect(callbacks.onToggleTheme).toHaveBeenCalled();
  });

  it('renders registry-derived footer navigation and delegates project actions', async () => {
    const callbacks = {
      onEmailClick: vi.fn(), onSelectCategory: vi.fn(),
      onSelectDocument: vi.fn(), onSelectTool: vi.fn(),
    };
    await act(async () => root.render(
      <AppFooter
        activeTool="tool-home"
        appVersion="v0.9.10-beta"
        categories={[category]}
        language="en-US"
        modeId="all"
        navItems={[item]}
        t={t}
        {...callbacks}
      />,
    ));
    await act(async () => container.querySelector('footer button').click());
    expect(callbacks.onSelectCategory).toHaveBeenCalledWith('media');
    const toolButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Image Metadata');
    await act(async () => toolButton.click());
    expect(callbacks.onSelectTool).toHaveBeenCalledWith('tool-imgmeta');
    const documentNav = container.querySelector('[aria-label="Site documents"]');
    const documentLabels = [...documentNav.querySelectorAll('button')].map((button) => button.textContent);
    expect(documentLabels).toEqual(DOCUMENT_ROUTE_IDS.map((id) => `tools:${id}.title`));

    const consentLink = [...documentNav.querySelectorAll('button')].find(
      (button) => button.textContent === 'tools:consent.title',
    );
    await act(async () => consentLink.click());
    expect(callbacks.onSelectDocument).toHaveBeenCalledWith('consent');

    await act(async () => container.querySelector('[aria-label="Project links"] a').click());
    expect(callbacks.onEmailClick).toHaveBeenCalled();
  });
});
