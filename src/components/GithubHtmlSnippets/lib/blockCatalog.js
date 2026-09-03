/**
 * The blocks this tool can stack, and the pure placement rules for dropping one
 * into a document.
 *
 * Every human-readable word lives in the `tools` translation namespace under
 * `tool-github-html.blocks.<id>`; this file holds only ids, grouping, and the
 * markup template, so the catalogue stays language-neutral and unit-testable.
 *
 * `template` slots are `{{selection}}` — replaced by whatever the editor has
 * selected, or the block's translated name — plus any named slot listed in
 * `slots`, filled from that block's translations.
 *
 * Every URL in a template is a local placeholder (`light.png`, `badge-build.svg`,
 * `link-target`) that the author replaces with their own. No absolute third-party
 * URL is shipped here: the tool never fetches anything, so a real host in this
 * file would show up in the external-host inventory as a network flow that does
 * not exist.
 */

export const BLOCKS = Object.freeze([
  // -- layout -----------------------------------------------------------------
  {
    id: 'center-block', group: 'layout', tag: '<div align="center">',
    template: '<div align="center">\n  {{selection}}\n</div>',
  },
  {
    id: 'center-title', group: 'layout', tag: '<h1 align="center">', slots: ['tagline'],
    template: '<h1 align="center">{{selection}}</h1>\n<p align="center">{{tagline}}</p>',
  },
  {
    id: 'align-right', group: 'layout', tag: '<div align="right">',
    template: '<div align="right">\n  {{selection}}\n</div>',
  },
  {
    id: 'two-column', group: 'layout', tag: '<table>', slots: ['left', 'right'],
    template: '<table>\n  <tr>\n    <td align="center"><img src="light.png" width="380" alt="{{left}}" /><br /><sub>{{left}}</sub></td>\n    <td align="center"><img src="dark.png" width="380" alt="{{right}}" /><br /><sub>{{right}}</sub></td>\n  </tr>\n</table>',
  },
  {
    id: 'line-break', group: 'layout', tag: '<br />',
    template: '{{selection}}<br />', sample: '{{selection}}<br />{{selection}}',
  },
  { id: 'rule', group: 'layout', tag: '<hr />', template: '<hr />' },

  // -- collapsible ------------------------------------------------------------
  {
    id: 'details', group: 'collapsible', tag: '<details>', slots: ['body'],
    template: '<details>\n<summary>{{selection}}</summary>\n\n{{body}}\n\n</details>',
  },
  {
    id: 'details-open', group: 'collapsible', tag: '<details open>', slots: ['body'],
    template: '<details open>\n<summary>{{selection}}</summary>\n\n{{body}}\n\n</details>',
  },
  {
    id: 'details-code', group: 'collapsible', tag: '<details> + ```',
    template: '<details>\n<summary>{{selection}}</summary>\n\n```bash\nnpm install\nnpm run dev\n```\n\n</details>',
  },

  // -- badges -----------------------------------------------------------------
  {
    id: 'badge-link', group: 'badges', tag: '<a><img></a>', slots: ['alt'],
    template: '<a href="link-target"><img src="badge-build.svg" alt="{{alt}}" /></a>',
  },
  {
    id: 'badge-row', group: 'badges', tag: '<p align="center">',
    template: '<p align="center">\n  <img src="badge-license.svg" alt="License" />\n  <img src="badge-build.svg" alt="Build" />\n  <img src="badge-version.svg" alt="Version" />\n</p>',
  },

  // -- text -------------------------------------------------------------------
  { id: 'kbd', group: 'text', tag: '<kbd>', template: '<kbd>{{selection}}</kbd>' },
  { id: 'subscript', group: 'text', tag: '<sub>', template: '<sub>{{selection}}</sub>' },
  { id: 'superscript', group: 'text', tag: '<sup>', template: '<sup>{{selection}}</sup>' },
  { id: 'sample-output', group: 'text', tag: '<samp>', template: '<samp>{{selection}}</samp>' },
  { id: 'underline', group: 'text', tag: '<ins>', template: '<ins>{{selection}}</ins>' },
  { id: 'highlight', group: 'text', tag: '<mark>', template: '<mark>{{selection}}</mark>' },
  {
    id: 'coloured-text', group: 'text', tag: '<font color>',
    template: '<font color="red">{{selection}}</font>', sample: '<p align="center">{{selection}}</p>',
  },
  {
    id: 'inline-style', group: 'text', tag: 'style="…"',
    template: '<p style="color:#f00">{{selection}}</p>', sample: '<p align="center">{{selection}}</p>',
  },

  // -- media ------------------------------------------------------------------
  {
    id: 'sized-image', group: 'media', tag: '<img width>', slots: ['alt'],
    template: '<img src="{{selection}}" alt="{{alt}}" width="480" />',
  },
  {
    id: 'theme-image', group: 'media', tag: '<picture>', slots: ['alt'],
    template: '<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="logo-dark.png" />\n  <source media="(prefers-color-scheme: light)" srcset="logo-light.png" />\n  <img alt="{{alt}}" src="logo-light.png" width="320" />\n</picture>',
  },
  {
    id: 'floated-image', group: 'media', tag: '<img align>', slots: ['alt'],
    template: '<img src="icon.png" align="left" width="96" alt="{{alt}}" />\n\n{{selection}}',
  },
  {
    id: 'video', group: 'media', tag: '<video>',
    template: '<video src="demo.mp4" controls></video>', sample: '<img src="demo.mp4" alt="{{selection}}" />',
  },

  // -- navigation -------------------------------------------------------------
  {
    id: 'anchor', group: 'navigation', tag: '<a id>',
    template: '<a id="{{selection}}"></a>', sample: '<a href="#top">#{{selection}}</a>',
  },
  {
    id: 'back-to-top', group: 'navigation', tag: '<div align="right">', slots: ['label'],
    template: '<div align="right">\n  <a href="#top">{{label}}</a>\n</div>',
  },

  // -- alerts -----------------------------------------------------------------
  { id: 'alert-note', group: 'alerts', tag: '> [!NOTE]', template: '> [!NOTE]\n> {{selection}}' },
  { id: 'alert-warning', group: 'alerts', tag: '> [!WARNING]', template: '> [!WARNING]\n> {{selection}}' },
  { id: 'quote', group: 'alerts', tag: '<blockquote>', template: '<blockquote>\n  {{selection}}\n</blockquote>' },
]);

/** Fills `{{slot}}` placeholders. Unknown slots are left untouched, not blanked. */
export function fillTemplate(template, values) {
  return String(template).replace(/{{(\w+)}}/g, (match, key) => (
    Object.hasOwn(values, key) ? String(values[key]) : match
  ));
}

/**
 * Which blocks match a free-text query. `terms` is the caller's translated
 * search text for each block, so searching works in the reader's language, and
 * the group name is part of the haystack so typing "media" narrows to media.
 */
export function searchBlocks(query, terms) {
  const needle = String(query).trim().toLowerCase();
  if (!needle) return [...BLOCKS];
  return BLOCKS.filter(
    (block) => `${terms[block.id] || ''} ${block.tag} ${block.group}`.toLowerCase().includes(needle),
  );
}

/**
 * Where a block lands.
 *
 * A multi-line block is stacked: it takes its own lines below the caret's line
 * and leaves the caret after it, so clicking repeatedly piles blocks up in
 * order instead of nesting them inside each other. A single-line block is
 * inline markup, so it goes at the caret with its placeholder selected and
 * ready to be typed over.
 *
 * @returns {{ text: string, selectionStart: number, selectionEnd: number, stacked: boolean }}
 */
export function placeBlock(text, selectionStart, selectionEnd, body) {
  const source = String(text);
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);

  if (!body.includes('\n')) {
    const before = source.slice(0, start);
    const after = source.slice(end);
    return {
      text: before + body + after,
      selectionStart: before.length,
      selectionEnd: before.length + body.length,
      stacked: false,
    };
  }

  const lineEnd = source.indexOf('\n', end);
  const at = lineEnd === -1 ? source.length : lineEnd;
  const head = source.slice(0, at);
  const tail = source.slice(at);
  const lead = head === '' ? '' : head.endsWith('\n\n') ? '' : head.endsWith('\n') ? '\n' : '\n\n';
  const trail = tail.startsWith('\n\n') ? '' : '\n';
  const caret = head.length + lead.length + body.length;

  return {
    text: head + lead + body + trail + tail,
    selectionStart: caret,
    selectionEnd: caret,
    stacked: true,
  };
}
