function route(id, category, options = {}) {
  return {
    id, aliases: [], category, subGroupKey: null, iconKey: id,
    componentProps: {}, staticLayout: false, navigationVisible: true,
    ...options,
  };
}

export const ROUTE_DEFINITIONS = [
  route('tool-home', 'home', { navigationVisible: false }),
  route('tool-slash', 'developer'), route('tool-wc', 'text'),
  route('tool-casing', 'text', { staticLayout: true }),
  route('tool-color', 'media', { staticLayout: true }),
  route('tool-ascii', 'developer', { staticLayout: true }), route('tool-unicode', 'developer', { staticLayout: true }),
  route('tool-url', 'developer'), route('tool-markdown', 'developer'),
  route('tool-mermaid', 'developer', { iconKey: 'tool-markdown' }), route('tool-code-preview', 'developer'),
  route('tool-fontextractor', 'developer', { staticLayout: true }), route('tool-base', 'developer', { staticLayout: true }),
  route('tool-folder-analyzer', 'developer'), route('tool-dna', 'bioinfo', { staticLayout: true }),
  route('tool-codon', 'bioinfo'), route('tool-phred', 'bioinfo'), route('tool-iplookup', 'network'),
  route('tool-speedtest', 'network', { staticLayout: true }), route('tool-imgmeta', 'media'),
  route('tool-docmeta', 'media', { aliases: ['tool-officemeta'] }), route('tool-audiometa', 'media'),
  route('tool-videometa', 'media'), route('tool-mediasplit', 'media'), route('tool-svg-png', 'media'),
  route('tool-barcode', 'utilities', { subGroupKey: 'utilities', componentProps: { initialTab: 'barcode' }, staticLayout: true }),
  route('tool-currency', 'utilities', { subGroupKey: 'calculation', staticLayout: true }),
  route('tool-date', 'utilities', { subGroupKey: 'calculation' }), route('tool-roman', 'utilities', { subGroupKey: 'calculation' }),
  route('tool-password', 'utilities', { subGroupKey: 'utilities', componentProps: { initialTab: 'generate' }, staticLayout: true }),
  route('tool-pwstrength', 'utilities', { subGroupKey: 'utilities', componentProps: { initialTab: 'check' }, staticLayout: true }),
  route('tool-qrcode', 'utilities', { subGroupKey: 'utilities', componentProps: { initialTab: 'qr' }, staticLayout: true }),
  route('tool-qrbarcodescan', 'utilities', { subGroupKey: 'utilities', staticLayout: true }),
  route('tool-wheel', 'utilities', { subGroupKey: 'utilities', staticLayout: true }),
  route('privacy', 'policy', { navigationVisible: false, staticLayout: true }),
];

export const PUBLIC_ROUTE_IDS = ROUTE_DEFINITIONS.flatMap((item) => [item.id, ...item.aliases]);
export const STATIC_LAYOUT_IDS = new Set(ROUTE_DEFINITIONS.flatMap((item) => item.staticLayout ? [item.id, ...item.aliases] : []));

const metadataById = new Map(ROUTE_DEFINITIONS.flatMap((item) => [item.id, ...item.aliases].map((id) => [id, item])));

export function getRouteMetadata(id) {
  return metadataById.get(id) || null;
}

export function localizeToolRoute(item, t, englishT) {
  const prefix = `tools:${item.id}`;
  const translateEnglish = englishT || ((key, options) => t(key, { ...options, lng: 'en-US' }));
  const currentSearch = t(`${prefix}.search`, { returnObjects: true });
  const englishSearch = translateEnglish(`${prefix}.search`, { returnObjects: true });
  return {
    ...item,
    title: t(`${prefix}.title`), tooltip: t(`${prefix}.tooltip`), description: t(`${prefix}.description`),
    searchMetadata: [...new Set([
      t(`${prefix}.title`), ...(Array.isArray(currentSearch) ? currentSearch : []),
      translateEnglish(`${prefix}.title`), ...(Array.isArray(englishSearch) ? englishSearch : []),
    ])],
    subGroup: item.subGroupKey ? t(`navigation:categories.${item.subGroupKey}`) : null,
  };
}

export function sortLocalizedTools(items, locale) {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return [...items].sort((a, b) => collator.compare(a.title ?? a.name, b.title ?? b.name));
}
