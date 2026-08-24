import React from 'react';
import {
  PUBLIC_ROUTE_IDS,
  ROUTE_DEFINITIONS,
  STATIC_LAYOUT_IDS,
  localizeToolRoute,
  sortLocalizedTools,
} from './toolRouteMetadata.js';

const loaders = {
  'tool-home': () => import('./components/HomeGrid.jsx'),
  'tool-slash': () => import('./components/SlashesConverter.jsx'),
  'tool-wc': () => import('./components/WordCounter.jsx'),
  'tool-casing': () => import('./components/CasingSwitcher.jsx'),
  'tool-color': () => import('./components/ColorConverter.jsx'),
  'tool-ascii': () => import('./components/AsciiConverter.jsx'),
  'tool-unicode': () => import('./components/UnicodeConverter.jsx'),
  'tool-url': () => import('./components/UrlEncoderDecoder.jsx'),
  'tool-markdown': () => import('./components/MarkdownPreviewer.jsx'),
  'tool-mermaid': () => import('./components/MermaidConverter.jsx'),
  'tool-code-preview': () => import('./components/CodePreviewer.jsx'),
  'tool-fontextractor': () => import('./components/WebsiteFontExtractor.jsx'),
  'tool-base': () => import('./components/BaseConverter.jsx'),
  'tool-folder-analyzer': () => import('./components/FolderAnalyzer.jsx'),
  'tool-dna': () => import('./components/DnaConverter.jsx'),
  'tool-codon': () => import('./components/CodonTable.jsx'),
  'tool-phred': () => import('./components/PhredScaleConverter.jsx'),
  'tool-iplookup': () => import('./components/IpLookup.jsx'),
  'tool-speedtest': () => import('./components/NetworkSpeedTest.jsx'),
  'tool-imgmeta': () => import('./components/ImgMeta.jsx'),
  'tool-docmeta': () => import('./components/DocMeta.jsx'),
  'tool-audiometa': () => import('./components/AudioMeta.jsx'),
  'tool-videometa': () => import('./components/VideoMeta.jsx'),
  'tool-mediasplit': () => import('./components/MediaSeparator.jsx'),
  'tool-svg-png': () => import('./components/SvgToPngConverter.jsx'),
  'tool-barcode': () => import('./components/QrBarcodeGenerator.jsx'),
  'tool-currency': () => import('./components/CurrencyCounter.jsx'),
  'tool-date': () => import('./components/DateCounter.jsx'),
  'tool-roman': () => import('./components/RomanNumeralConverter.jsx'),
  'tool-password': () => import('./components/PasswordGenerator.jsx'),
  'tool-pwstrength': () => import('./components/PasswordGenerator.jsx'),
  'tool-qrcode': () => import('./components/QrBarcodeGenerator.jsx'),
  'tool-qrbarcodescan': () => import('./components/QrBarcodeScanner.jsx'),
  'tool-wheel': () => import('./components/RandomWheel.jsx'),
  privacy: () => import('./components/PrivacyPolicy.jsx'),
};

export const TOOL_ROUTES = ROUTE_DEFINITIONS.map((definition) => {
  const loader = loaders[definition.id];
  return { ...definition, loader, component: React.lazy(loader) };
});
export const NAVIGATION_ROUTES = TOOL_ROUTES.filter((item) => item.navigationVisible);
const routesById = new Map(TOOL_ROUTES.flatMap((item) => [item.id, ...item.aliases].map((id) => [id, item])));

export function getToolRoute(id) { return routesById.get(id) || null; }
export function getLocalizedToolRoutes(t) { return TOOL_ROUTES.map((item) => localizeToolRoute(item, t)); }
export { PUBLIC_ROUTE_IDS, STATIC_LAYOUT_IDS, localizeToolRoute, sortLocalizedTools };
