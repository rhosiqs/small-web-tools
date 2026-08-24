import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS_DIR = path.join(ROOT, 'src', 'components');
const USER_FACING_ATTRIBUTES = new Set(['alt', 'aria-label', 'placeholder', 'title']);
const USER_FACING_PROPERTIES = new Set(['label']);
const UI_DATA_CONTEXT = /^(?:compare_?fields|.*rows|.*tabs|.*parameters)$/i;
const TECHNICAL_TERMS = new Set([
  '⬇ JSON', '⁺NH₃', 'H₂N', '⁺NH₂', 'COO⁻', '&times;', '&nbsp;',
  '#4F46E5 or rgb(79, 70, 229) or hsl(244, 76%, 59%)',
  "[]&#123;&#125;|;:',.&lt;&gt;?/~", 'Q = −10 × log₁₀(P), and P = 10^(−Q/10).',
  '256 x 256 px', '512 x 512 px', '1024 x 1024 px', '2048 x 2048 px',
  'Arial', 'Georgia', 'Impact', 'Courier New', 'Trebuchet MS', 'Verdana',
  'QR Code', 'Data Matrix', 'Aztec', 'PDF 417', 'Code 128', 'Code 39', 'Code 93',
  'Codabar', 'RSS 14', '2026 or MMXXVI', '<svg …>…</svg>', 's', 'Ctrl+↵',
  'Codec:', 'Res:', 'FPS:', 'Audio:', 'Subs:',
]);

// Reviewed protocol, format, unit, and keyboard notation that should remain language-neutral.
const TECHNICAL_ALLOWLIST = [
  /^(?:JSON|SVG|URL|URI|DNS|HEX|RGB|RGBA|HSL|HSLA|CMYK|WPA|WEP|WPM|CPM|FPS|Hz|Mbps)$/i,
  /^(?:Ctrl|Cmd|Alt|Shift)(?:\s*\+\s*(?:Ctrl|Cmd|Alt|Shift|[A-Z0-9]))+$/,
  /^(?:[A-Z0-9][A-Z0-9+./_-]*)(?:\s*\([^)]*\))?$/,
  /^[×÷+−=<>%#0-9.,:;()[\]{}\s/-]+$/,
];

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function isAllowed(value) {
  return TECHNICAL_TERMS.has(value) || !/[A-Za-z]/.test(value)
    || TECHNICAL_ALLOWLIST.some((pattern) => pattern.test(value));
}

function visitFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visitFiles(target, files);
    else if (/\.[jt]sx$/.test(entry.name)) files.push(target);
  }
  return files;
}

function propertyName(node) {
  if (!node) return '';
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return '';
}

function hasUiDataContext(node) {
  let current = node;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)
        && UI_DATA_CONTEXT.test(current.name.text)) {
      return true;
    }
    if (ts.isPropertyAssignment(current) && /^(?:rows|tabs)$/.test(propertyName(current.name))) {
      return true;
    }
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)
        && current.expression.name.text === 'push'
        && ts.isIdentifier(current.expression.expression)
        && UI_DATA_CONTEXT.test(current.expression.expression.text)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isDataDrivenLabel(node) {
  const parent = node.parent;
  if (ts.isPropertyAssignment(parent)
      && USER_FACING_PROPERTIES.has(propertyName(parent.name))) {
    const owner = parent.parent;
    const ownsRows = ts.isObjectLiteralExpression(owner)
      && owner.properties.some((property) => ts.isPropertyAssignment(property)
        && propertyName(property.name) === 'rows');
    return ownsRows || hasUiDataContext(parent);
  }

  if (!ts.isArrayLiteralExpression(parent) || parent.elements[0] !== node || parent.elements.length < 2) {
    return false;
  }

  const container = ts.isArrayLiteralExpression(parent.parent) ? parent.parent.parent : parent.parent;
  if (ts.isPropertyAssignment(container) && propertyName(container.name) === 'rows') return true;
  return ts.isVariableDeclaration(container) && ts.isIdentifier(container.name)
    && /rows/i.test(container.name.text);
}

export function findHardcodedUiInSource(sourceText, file = 'fixture.jsx') {
  const findings = [];
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const record = (node, raw) => {
    const value = normalizeText(raw);
    if (!value || isAllowed(value)) return;
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    findings.push(`${path.relative(ROOT, file)}:${line}: ${JSON.stringify(value)}`);
  };
  const visit = (node) => {
    if (ts.isJsxText(node)) record(node, node.getText(source));
    if (ts.isJsxAttribute(node) && USER_FACING_ATTRIBUTES.has(node.name.text)
        && node.initializer && ts.isStringLiteral(node.initializer)) {
      record(node, node.initializer.text);
    }
    if (ts.isStringLiteral(node) && isDataDrivenLabel(node)) record(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings.sort();
}

export function checkHardcodedUi() {
  return visitFiles(COMPONENTS_DIR)
    .flatMap((file) => findHardcodedUiInSource(fs.readFileSync(file, 'utf8'), file))
    .sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = checkHardcodedUi();
  if (findings.length) {
    console.error('Hardcoded user-facing strings found outside the reviewed technical allowlist:');
    console.error(findings.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('No unreviewed hardcoded user-facing strings found.');
  }
}
