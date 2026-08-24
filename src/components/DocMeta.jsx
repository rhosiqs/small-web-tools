import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';
import JSZip from 'jszip';
import {
  FILE_RESOURCE_POLICIES,
  validateResourceAddition,
  validateZipArchive,
} from '../lib/resourceLimits';
import useObjectUrlRegistry from '../hooks/useObjectUrlRegistry';
import {
  formatBytes,
  formatDocumentDate as formatDate,
  formatDurationMinutes as formatMinutes,
} from './DocMeta/lib/documentMetadata';

const loadSafeZip = async (file) => {
  const archiveCheck = await validateZipArchive(file);
  if (!archiveCheck.valid) throw new Error(archiveCheck.error);
  return JSZip.loadAsync(file);
};

// Helper to get element textContent by checking localName
const getTagValue = (xmlDoc, tagName) => {
  const elements = xmlDoc.getElementsByTagName("*");
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.localName === tagName || el.tagName.split(':').pop() === tagName) {
      return el.textContent || '';
    }
  }
  return '';
};

// Helper to parse Excel HeadingPairs
const parseHeadingPairs = (xmlDoc) => {
  const headingPairsEls = xmlDoc.getElementsByTagName("*");
  let headingPairsEl = null;
  for (let i = 0; i < headingPairsEls.length; i++) {
    if (headingPairsEls[i].localName === "HeadingPairs") {
      headingPairsEl = headingPairsEls[i];
      break;
    }
  }
  if (!headingPairsEl) return null;
  
  let vectorEl = null;
  for (let i = 0; i < headingPairsEl.children.length; i++) {
    if (headingPairsEl.children[i].localName === "vector") {
      vectorEl = headingPairsEl.children[i];
      break;
    }
  }
  if (!vectorEl) return null;

  const variants = [];
  for (let i = 0; i < vectorEl.children.length; i++) {
    if (vectorEl.children[i].localName === "variant") {
      variants.push(vectorEl.children[i]);
    }
  }

  const pairs = [];
  for (let i = 0; i < variants.length; i += 2) {
    if (i + 1 < variants.length) {
      const labelText = variants[i].textContent.trim();
      const countText = variants[i+1].textContent.trim();
      if (labelText) {
        pairs.push({ label: labelText, count: countText });
      }
    }
  }
  return pairs.length > 0 ? pairs : null;
};

// Helper to parse Excel sheets
const extractWorksheets = async (zip) => {
  const workbookFile = zip.file("xl/workbook.xml");
  if (!workbookFile) return [];
  try {
    const text = await workbookFile.async("string");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "application/xml");
    const sheets = xmlDoc.getElementsByTagName("sheet");
    const list = [];
    for (let i = 0; i < sheets.length; i++) {
      const s = sheets[i];
      list.push({
        name: s.getAttribute("name") || `Sheet${i + 1}`,
        state: s.getAttribute("state") || "visible"
      });
    }
    return list;
  } catch (err) {
    console.error("Error parsing xl/workbook.xml", err);
    return [];
  }
};

// Helper to parse Custom Properties
const parseCustomProperties = (xmlDoc) => {
  const properties = xmlDoc.getElementsByTagName("property");
  const customData = {};
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    const name = prop.getAttribute("name");
    if (name) {
      const valEl = prop.firstElementChild;
      const value = valEl ? valEl.textContent.trim() : '';
      customData[name] = value;
    }
  }
  return customData;
};

// Helper to decode PDF literal / hex strings
const decodePdfString = (str) => {
  if (!str) return '';
  str = str.trim();
  if (str.startsWith('(') && str.endsWith(')')) {
    str = str.slice(1, -1);
    return str.replace(/\\([()\\])/g, '$1')
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t');
  }
  if (str.startsWith('<') && str.endsWith('>')) {
    const hex = str.slice(1, -1).replace(/\s+/g, '');
    let bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16) || 0);
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      let result = '';
      for (let i = 2; i < bytes.length; i += 2) {
        result += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
      }
      return result;
    }
    return String.fromCharCode(...bytes);
  }
  return str;
};

// Helper to parse comprehensive PDF metadata
const parsePdfFile = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const textDecoder = new TextDecoder('latin1');
  const text = textDecoder.decode(bytes);

  const coreData = {};
  const appData = {};
  const customData = {};

  // 1. PDF Version from file header
  const headerMatch = text.slice(0, 1024).match(/%PDF-(\d+\.\d+)/);
  if (headerMatch) {
    appData.PdfVersion = `PDF ${headerMatch[1]}`;
  }

  // 2. Linearized (Fast Web View)
  const isLinearized = /\/Linearized\s+\d+/.test(text.slice(0, 1024));
  appData.Linearized = isLinearized ? 'Yes (Fast Web View enabled)' : 'No';

  // 3. Encryption / Password Protection
  const isEncrypted = /\/Encrypt\s+\d+/.test(text);
  appData.Encrypted = isEncrypted ? 'Yes (Encrypted / Security applied)' : 'No (Unencrypted)';

  // 4. Find /Info dictionary in PDF
  const infoMatch = text.match(/\/Info\s+(\d+)\s+(\d+)\s+R/);
  let infoBlock = '';
  if (infoMatch) {
    const objNum = infoMatch[1];
    const genNum = infoMatch[2];
    const objRegex = new RegExp(`${objNum}\\s+${genNum}\\s+obj[\\s\\S]*?<<([\\s\\S]*?)>>[\\s\\S]*?endobj`);
    const objMatch = text.match(objRegex);
    if (objMatch) {
      infoBlock = objMatch[1];
    }
  }

  if (!infoBlock) {
    const genericInfo = text.match(/<<\s*\/Title[\s\S]*?>>/);
    if (genericInfo) {
      infoBlock = genericInfo[0];
    }
  }

  if (infoBlock) {
    const extractPdfKey = (key) => {
      const re = new RegExp(`\\/${key}\\s*(\\([^)]*\\)|<[^>]*>)`);
      const m = infoBlock.match(re);
      return m ? decodePdfString(m[1]) : '';
    };

    coreData.title = extractPdfKey('Title');
    coreData.creator = extractPdfKey('Author');
    coreData.subject = extractPdfKey('Subject');
    coreData.keywords = extractPdfKey('Keywords');
    coreData.created = extractPdfKey('CreationDate');
    coreData.modified = extractPdfKey('ModDate');
    appData.Application = extractPdfKey('Creator');
    appData.Producer = extractPdfKey('Producer');

    const trapped = infoBlock.match(/\/Trapped\s*\/(\w+)/);
    if (trapped) {
      appData.Trapped = trapped[1];
    }
  }

  // 5. XMP Metadata Block
  const xmpMatch = text.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/i);
  if (xmpMatch) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmpMatch[0], 'application/xml');

      if (!coreData.title) coreData.title = getTagValue(xmlDoc, 'title') || getTagValue(xmlDoc, 'Title');
      if (!coreData.creator) coreData.creator = getTagValue(xmlDoc, 'creator') || getTagValue(xmlDoc, 'Author');
      if (!coreData.subject) coreData.subject = getTagValue(xmlDoc, 'description') || getTagValue(xmlDoc, 'subject');
      if (!coreData.keywords) coreData.keywords = getTagValue(xmlDoc, 'keywords') || getTagValue(xmlDoc, 'Keywords');
      if (!coreData.created) coreData.created = getTagValue(xmlDoc, 'CreateDate');
      if (!coreData.modified) coreData.modified = getTagValue(xmlDoc, 'ModifyDate');
      if (!appData.Application) appData.Application = getTagValue(xmlDoc, 'CreatorTool');
      if (!appData.Producer) appData.Producer = getTagValue(xmlDoc, 'Producer');

      const pdfaPart = getTagValue(xmlDoc, 'part');
      const pdfaConf = getTagValue(xmlDoc, 'conformance');
      if (pdfaPart) {
        appData.PdfStandard = `PDF/A-${pdfaPart}${pdfaConf ? pdfaConf.toUpperCase() : ''}`;
      }

      const docId = getTagValue(xmlDoc, 'DocumentID');
      const instId = getTagValue(xmlDoc, 'InstanceID');
      if (docId) customData['XMP Document ID'] = docId;
      if (instId) customData['XMP Instance ID'] = instId;

      const rights = getTagValue(xmlDoc, 'rights');
      if (rights) coreData.category = `Copyright: ${rights}`;
    } catch (e) {
      console.warn('XMP parse error', e);
    }
  }

  // 6. Count Pages
  let pageCount = 0;
  const countMatch = text.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  if (countMatch) {
    pageCount = parseInt(countMatch[1], 10);
  } else {
    const pages = text.match(/\/Type\s*\/Page\b/g);
    if (pages) pageCount = pages.length;
  }
  if (pageCount > 0) {
    appData.Pages = String(pageCount);
  }

  // 7. Page Dimensions (MediaBox) & Orientation
  const mediaBoxMatch = text.match(/\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/);
  if (mediaBoxMatch) {
    const x1 = parseFloat(mediaBoxMatch[1]);
    const y1 = parseFloat(mediaBoxMatch[2]);
    const x2 = parseFloat(mediaBoxMatch[3]);
    const y2 = parseFloat(mediaBoxMatch[4]);
    const widthPt = Math.abs(x2 - x1);
    const heightPt = Math.abs(y2 - y1);
    
    const widthMm = Math.round(widthPt * 0.352778);
    const heightMm = Math.round(heightPt * 0.352778);
    const widthIn = (widthPt / 72).toFixed(2);
    const heightIn = (heightPt / 72).toFixed(2);

    let paperName = '';
    if (Math.abs(widthMm - 210) < 5 && Math.abs(heightMm - 297) < 5) paperName = ' (A4)';
    else if (Math.abs(widthMm - 297) < 5 && Math.abs(heightMm - 210) < 5) paperName = ' (A4)';
    else if (Math.abs(widthMm - 216) < 5 && Math.abs(heightMm - 279) < 5) paperName = ' (Letter)';
    else if (Math.abs(widthMm - 279) < 5 && Math.abs(heightMm - 216) < 5) paperName = ' (Letter)';

    const orientation = widthPt > heightPt ? 'Landscape' : 'Portrait';
    appData.PageDimensions = `${widthMm} × ${heightMm} mm (${widthIn} × ${heightIn} in)${paperName}`;
    appData.PageOrientation = orientation;
  }

  // 8. Embedded Fonts
  const fontMatches = text.match(/\/BaseFont\s*\/([A-Za-z0-9+_-]+)/g);
  if (fontMatches) {
    const fonts = Array.from(new Set(fontMatches.map(m => m.replace(/\/BaseFont\s*\//, ''))));
    appData.EmbeddedFonts = fonts.slice(0, 10).join(', ') + (fonts.length > 10 ? ` (+${fonts.length - 10} more)` : '');
    appData.FontCount = String(fonts.length);
  }

  // 9. Embedded Images Count
  const imageMatches = text.match(/\/Subtype\s*\/Image\b/g);
  if (imageMatches) {
    appData.Images = String(imageMatches.length);
  }

  // 10. Interactive Form (AcroForm)
  const hasAcroForm = /\/AcroForm\b/.test(text);
  appData.InteractiveForm = hasAcroForm ? 'Yes (Contains form fields)' : 'No';

  // 11. Tagged / Accessible PDF
  const isTagged = /\/MarkInfo[\s\S]*?\/Marked\s+true/.test(text) || /\/StructTreeRoot\b/.test(text);
  appData.TaggedPdf = isTagged ? 'Yes (Tagged PDF for accessibility)' : 'No';

  // 12. Bookmarks / Outlines
  const hasOutlines = /\/Outlines\s+\d+/.test(text);
  appData.Bookmarks = hasOutlines ? 'Yes (Contains bookmarks/outline)' : 'No';

  // 13. JavaScript Actions
  const hasJS = /\/JavaScript\b|\/JS\b/.test(text);
  appData.JavaScriptActions = hasJS ? 'Yes (Contains JavaScript code)' : 'No';

  return { coreData, appData, customData };
};

// Helper to parse OpenOffice (ODF) metadata from meta.xml
const parseOpenOfficeFile = async (file) => {
  const zip = await loadSafeZip(file);
  const metaFile = zip.file("meta.xml");
  
  const coreData = {};
  const appData = {};
  const customData = {};

  if (metaFile) {
    const metaText = await metaFile.async("string");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(metaText, "application/xml");

    coreData.title = getTagValue(xmlDoc, "title");
    coreData.creator = getTagValue(xmlDoc, "creator");
    coreData.lastModifiedBy = getTagValue(xmlDoc, "creator");
    coreData.created = getTagValue(xmlDoc, "creation-date");
    coreData.modified = getTagValue(xmlDoc, "date");
    coreData.description = getTagValue(xmlDoc, "description");
    coreData.subject = getTagValue(xmlDoc, "subject");
    coreData.keywords = getTagValue(xmlDoc, "keyword");
    coreData.revision = getTagValue(xmlDoc, "editing-cycles");

    appData.Application = getTagValue(xmlDoc, "generator");
    appData.TotalTime = getTagValue(xmlDoc, "editing-duration");

    const statsEls = xmlDoc.getElementsByTagName("*");
    for (let i = 0; i < statsEls.length; i++) {
      if (statsEls[i].localName === "document-statistic" || statsEls[i].tagName.endsWith("document-statistic")) {
        const el = statsEls[i];
        const pageCount = el.getAttribute("meta:page-count") || el.getAttribute("page-count");
        const wordCount = el.getAttribute("meta:word-count") || el.getAttribute("word-count");
        const charCount = el.getAttribute("meta:character-count") || el.getAttribute("character-count");
        const paraCount = el.getAttribute("meta:paragraph-count") || el.getAttribute("paragraph-count");
        const tableCount = el.getAttribute("meta:table-count") || el.getAttribute("table-count");
        const imageCount = el.getAttribute("meta:image-count") || el.getAttribute("image-count");
        
        if (pageCount) appData.Pages = pageCount;
        if (wordCount) appData.Words = wordCount;
        if (charCount) appData.Characters = charCount;
        if (paraCount) appData.Paragraphs = paraCount;
        if (tableCount) appData.Tables = tableCount;
        if (imageCount) appData.Images = imageCount;
      }
    }

    const userDefinedEls = xmlDoc.getElementsByTagName("*");
    for (let i = 0; i < userDefinedEls.length; i++) {
      const el = userDefinedEls[i];
      if (el.localName === "user-defined" || el.tagName.endsWith("user-defined")) {
        const name = el.getAttribute("meta:name") || el.getAttribute("name");
        if (name) {
          customData[name] = el.textContent.trim();
        }
      }
    }
  }

  let thumbnail = null;
  try {
    const thumbFile = zip.file("Thumbnails/thumbnail.png");
    if (thumbFile) {
      const blob = await thumbFile.async("blob");
      thumbnail = URL.createObjectURL(blob);
    }
  } catch (e) {
    console.warn("Failed to extract ODF thumbnail", e);
  }

  return { coreData, appData, customData, thumbnail };
};

// Helper to get vector SVGs for files
const getFileIcon = (type, size = 20) => {
  switch (type) {
    case 'docx':
    case 'odt':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="file-svg-icon">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      );
    case 'xlsx':
    case 'ods':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="file-svg-icon">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
          <line x1="15" y1="3" x2="15" y2="21"></line>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="3" y1="15" x2="21" y2="15"></line>
        </svg>
      );
    case 'pptx':
    case 'odp':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="file-svg-icon">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="12" y1="3" x2="12" y2="21"></line>
          <path d="M7 7l10 10M17 7L7 17"></path>
        </svg>
      );
    case 'pdf':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="file-svg-icon">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <path d="M9 15h6M9 11h6"></path>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="file-svg-icon">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      );
  }
};

// Descriptions of standard metadata fields
const FIELD_DESCRIPTIONS = {
  creator: 'Original author',
  lastModifiedBy: 'Username of the last person to modify the file',
  created: 'Creation timestamp',
  modified: 'Last modified timestamp',
  revision: 'Revision count (number of times saved)',
  title: 'Document title',
  subject: 'Subject',
  description: 'Description / notes',
  keywords: 'Keywords',
  category: 'Category',
  contentStatus: 'Status (e.g. Draft, Final)',
  lastPrinted: 'Last printed timestamp',
  
  Application: 'Software used to create the file',
  AppVersion: 'Software version number',
  Company: 'Company name',
  Manager: 'Manager name',
  Template: 'Template used',
  TotalTime: 'Total editing time',
  Producer: 'PDF producer / converter engine',

  PdfVersion: 'PDF specification version',
  Linearized: 'Optimized for Fast Web View',
  Encrypted: 'PDF encryption and security status',
  PageDimensions: 'Physical page dimensions and paper size',
  PageOrientation: 'Page orientation (Portrait / Landscape)',
  EmbeddedFonts: 'List of embedded font names',
  FontCount: 'Number of embedded fonts',
  InteractiveForm: 'Interactive AcroForm fields presence',
  TaggedPdf: 'Tagged PDF accessibility status',
  Bookmarks: 'Document outline / bookmarks presence',
  JavaScriptActions: 'Contains JavaScript scripts/actions',
  PdfStandard: 'ISO Standard compliance (e.g. PDF/A, PDF/X)',
  Trapped: 'Print trapping status',
  
  Pages: 'Page count',
  Words: 'Word count',
  Characters: 'Character count',
  CharactersWithSpaces: 'Character count including spaces',
  Paragraphs: 'Paragraph count',
  Lines: 'Line count',
  Tables: 'Table count',
  Images: 'Image count',
  
  Slides: 'Total slide count',
  HiddenSlides: 'Number of hidden slides',
  Notes: 'Number of notes pages',
  PresentationFormat: 'Presentation format',
  MMClips: 'Number of multimedia objects',
  
  Sheets: 'All worksheet names',
  HeadingPairs: 'Worksheet grouping information'
};

// Fields to compare side-by-side
const COMPARE_FIELDS = [
  { labelKey: 'metadata-fields.fileType', fn: (f) => f.type.toUpperCase() },
  { labelKey: 'metadata-fields.fileSize', fn: (f) => f.formattedSize },
  { labelKey: 'metadata-fields.title', fn: (f) => f.core.title },
  { labelKey: 'metadata-fields-extra.creator', fn: (f) => f.core.creator },
  { labelKey: 'metadata-fields.subject', fn: (f) => f.core.subject },
  { labelKey: 'metadata-fields.description', fn: (f) => f.core.description },
  { labelKey: 'metadata-fields.keywords', fn: (f) => f.core.keywords },
  { labelKey: 'metadata-fields.category', fn: (f) => f.core.category },
  { labelKey: 'metadata-fields.contentStatus', fn: (f) => f.core.contentStatus },
  { labelKey: 'metadata-fields.revisionCount', fn: (f) => f.core.revision },
  { labelKey: 'metadata-fields.createdTime', fn: (f) => formatDate(f.core.created) },
  { labelKey: 'metadata-fields.lastModifiedBy', fn: (f) => f.core.lastModifiedBy },
  { labelKey: 'metadata-fields.modifiedTime', fn: (f) => formatDate(f.core.modified) },
  { labelKey: 'metadata-fields.lastPrinted', fn: (f) => formatDate(f.core.lastPrinted) },

  { labelKey: 'metadata-fields.application', fn: (f) => f.app.Application },
  { labelKey: 'metadata-fields.appVersion', fn: (f) => f.app.AppVersion },
  { labelKey: 'metadata-fields.pdfSpecification', fn: (f) => f.app.PdfVersion },
  { labelKey: 'metadata-fields.pdfProducer', fn: (f) => f.app.Producer },
  { labelKey: 'metadata-fields.encrypted', fn: (f) => f.app.Encrypted },
  { labelKey: 'metadata-fields.fastWebView', fn: (f) => f.app.Linearized },
  { labelKey: 'metadata-fields.pageDimensions', fn: (f) => f.app.PageDimensions },
  { labelKey: 'metadata-fields.company', fn: (f) => f.app.Company },
  { labelKey: 'metadata-fields.manager', fn: (f) => f.app.Manager },
  { labelKey: 'metadata-fields.template', fn: (f) => f.app.Template },
  {
    labelKey: 'metadata-fields.totalEditingTime',
    fn: (f) => formatMinutes(f.app.TotalTime) || f.app.TotalTime
  },
  {
    labelKey: 'metadata-fields.formatSpecificDetails',
    fn: (f) => {
      if (['docx', 'odt', 'pdf'].includes(f.type)) {
        return `Pages: ${f.app.Pages || '—'} | Words: ${f.app.Words || '—'} | Chars: ${f.app.Characters || '—'}`;
      } else if (['pptx', 'odp'].includes(f.type)) {
        return `Slides: ${f.app.Slides || '—'} | Hidden: ${f.app.HiddenSlides || '—'} | Notes: ${f.app.Notes || '—'}`;
      } else if (['xlsx', 'ods'].includes(f.type)) {
        return `Sheets: ${f.sheets ? f.sheets.length : '—'}`;
      }
      return '—';
    }
  }
];

export default function DocMeta() {
  const { t } = useTranslation('tools');
  const {
    createObjectUrl,
    trackObjectUrl,
    revokeObjectUrl,
    revokeAllObjectUrls,
  } = useObjectUrlRegistry();
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelectedIds, setCompareSelectedIds] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({
    core: false,
    app: false,
    format: false,
    custom: false
  });
  
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDropzoneClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processFiles = async (fileList) => {
    const resourceCheck = validateResourceAddition(
      files,
      fileList,
      FILE_RESOURCE_POLICIES.documentMetadata,
    );
    if (!resourceCheck.valid) {
      setStatus(t('tool-docmeta.ui.resourceRejected'));
      return;
    }
    setLoading(true);
    setStatus(t('tool-docmeta.ui.parsing'));
    const acceptedExtensions = ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'odg', 'pdf'];
    const newFiles = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split('.').pop().toLowerCase();
      
      if (!acceptedExtensions.includes(ext)) {
        setStatus(t('tool-docmeta.ui.unsupportedFile', { name: file.name }));
        continue;
      }

      if (files.some(f => f.name === file.name && f.size === file.size)) {
        setStatus(t('tool-docmeta.ui.alreadyAdded', { name: file.name }));
        continue;
      }

      try {
        let coreData = {};
        let appData = {};
        let customData = {};
        let sheets = [];
        let thumbnail = null;

        if (ext === 'pdf') {
          const parsedPdf = await parsePdfFile(file);
          coreData = parsedPdf.coreData;
          appData = parsedPdf.appData;
          customData = parsedPdf.customData;
        } else if (['odt', 'ods', 'odp', 'odg'].includes(ext)) {
          const parsedOdf = await parseOpenOfficeFile(file);
          coreData = parsedOdf.coreData;
          appData = parsedOdf.appData;
          customData = parsedOdf.customData;
          thumbnail = parsedOdf.thumbnail;
        } else {
          const zip = await loadSafeZip(file);
          
          const coreFile = zip.file("docProps/core.xml");
          if (coreFile) {
            const coreText = await coreFile.async("string");
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(coreText, "application/xml");
            coreData = {
              creator: getTagValue(xmlDoc, "creator"),
              lastModifiedBy: getTagValue(xmlDoc, "lastModifiedBy"),
              created: getTagValue(xmlDoc, "created"),
              modified: getTagValue(xmlDoc, "modified"),
              revision: getTagValue(xmlDoc, "revision"),
              title: getTagValue(xmlDoc, "title"),
              subject: getTagValue(xmlDoc, "subject"),
              description: getTagValue(xmlDoc, "description"),
              keywords: getTagValue(xmlDoc, "keywords"),
              category: getTagValue(xmlDoc, "category"),
              contentStatus: getTagValue(xmlDoc, "contentStatus"),
              lastPrinted: getTagValue(xmlDoc, "lastPrinted")
            };
          }

          const appFile = zip.file("docProps/app.xml");
          if (appFile) {
            const appText = await appFile.async("string");
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(appText, "application/xml");
            appData = {
              Application: getTagValue(xmlDoc, "Application"),
              AppVersion: getTagValue(xmlDoc, "AppVersion"),
              Company: getTagValue(xmlDoc, "Company"),
              Manager: getTagValue(xmlDoc, "Manager"),
              Template: getTagValue(xmlDoc, "Template"),
              TotalTime: getTagValue(xmlDoc, "TotalTime"),
              Pages: getTagValue(xmlDoc, "Pages"),
              Words: getTagValue(xmlDoc, "Words"),
              Characters: getTagValue(xmlDoc, "Characters"),
              CharactersWithSpaces: getTagValue(xmlDoc, "CharactersWithSpaces"),
              Paragraphs: getTagValue(xmlDoc, "Paragraphs"),
              Lines: getTagValue(xmlDoc, "Lines"),
              Slides: getTagValue(xmlDoc, "Slides"),
              HiddenSlides: getTagValue(xmlDoc, "HiddenSlides"),
              Notes: getTagValue(xmlDoc, "Notes"),
              PresentationFormat: getTagValue(xmlDoc, "PresentationFormat"),
              MMClips: getTagValue(xmlDoc, "MMClips"),
              headingPairs: parseHeadingPairs(xmlDoc)
            };
          }

          const customFile = zip.file("docProps/custom.xml");
          if (customFile) {
            const customText = await customFile.async("string");
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(customText, "application/xml");
            customData = parseCustomProperties(xmlDoc);
          }

          if (ext === 'xlsx') {
            sheets = await extractWorksheets(zip);
          }

          try {
            const thumbFile = zip.file("docProps/thumbnail.jpeg") || 
                              zip.file("docProps/thumbnail.png") || 
                              zip.file("docProps/thumbnail.jpg");
            if (thumbFile) {
              const blob = await thumbFile.async("blob");
              thumbnail = createObjectUrl(blob);
            }
          } catch (thumbErr) {
            console.warn("Failed fallback thumbnail extraction", thumbErr);
          }
        }

        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        trackObjectUrl(thumbnail);
        newFiles.push({
          id,
          name: file.name,
          size: file.size,
          formattedSize: formatBytes(file.size),
          type: ext,
          core: coreData,
          app: appData,
          custom: customData,
          sheets: sheets,
          thumbnail: thumbnail,
          originalFile: file
        });
      } catch (err) {
        console.error("Error parsing document file", err);
        setStatus(t('tool-docmeta.ui.parseFailed', { name: file.name }));
      }
    }

    if (newFiles.length > 0) {
      setFiles(prev => {
        const updated = [...prev, ...newFiles];
        setSelectedFileId(newFiles[0].id);
        setCompareSelectedIds(curr => [...curr, ...newFiles.map(f => f.id)]);
        return updated;
      });
      setStatus(t('tool-docmeta.ui.parsedCount', { count: newFiles.length }));
    }
    setLoading(false);
  };

  const handleRemoveFile = (id) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove && fileToRemove.thumbnail) {
        revokeObjectUrl(fileToRemove.thumbnail);
      }
      const updated = prev.filter(f => f.id !== id);
      if (selectedFileId === id) {
        setSelectedFileId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
    setCompareSelectedIds(prev => prev.filter(fId => fId !== id));
  };

  const handleClearAll = () => {
    revokeAllObjectUrls();
    setFiles([]);
    setSelectedFileId(null);
    setCompareSelectedIds([]);
    setCompareMode(false);
    setStatus(t('tool-docmeta.ui.cleared'));
  };

  const handleExportJson = () => {
    if (!displayFile) return;
    const metadata = {
      filename: activeFile.name,
      fileSize: displayFile.size,
      fileType: displayFile.type,
      coreProperties: displayFile.core,
      applicationProperties: displayFile.app,
      customProperties: displayFile.custom,
      sheets: displayFile.sheets
    };
    const jsonString = JSON.stringify(metadata, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = createObjectUrl(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name.replace(/\.[^/.]+$/, "") + "_metadata.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    revokeObjectUrl(url);
  };

  const stripDocumentMetadata = async (fileObj, mode, type) => {
    if (type === 'pdf') {
      const arrayBuffer = await fileObj.arrayBuffer();
      let text = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));

      if (mode === 'private') {
        text = text.replace(/\/Author\s*\([^)]*\)/g, '/Author ()')
                   .replace(/\/Author\s*<[^>]*>/g, '/Author ()')
                   .replace(/\/CreationDate\s*\([^)]*\)/g, '/CreationDate ()')
                   .replace(/\/ModDate\s*\([^)]*\)/g, '/ModDate ()');
      } else {
        text = text.replace(/\/Title\s*\([^)]*\)/g, '/Title ()')
                   .replace(/\/Author\s*\([^)]*\)/g, '/Author ()')
                   .replace(/\/Subject\s*\([^)]*\)/g, '/Subject ()')
                   .replace(/\/Keywords\s*\([^)]*\)/g, '/Keywords ()')
                   .replace(/\/Creator\s*\([^)]*\)/g, '/Creator ()')
                   .replace(/\/Producer\s*\([^)]*\)/g, '/Producer ()')
                   .replace(/\/CreationDate\s*\([^)]*\)/g, '/CreationDate ()')
                   .replace(/\/ModDate\s*\([^)]*\)/g, '/ModDate ()')
                   .replace(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/gi, '');
      }
      return new Blob([new TextEncoder().encode(text)], { type: 'application/pdf' });
    }

    if (['odt', 'ods', 'odp', 'odg'].includes(type)) {
      const zip = await loadSafeZip(fileObj);
      const metaFile = zip.file("meta.xml");
      if (metaFile) {
        const metaText = await metaFile.async("string");
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(metaText, "application/xml");

        const removeTags = mode === 'private'
          ? ["creator", "initial-creator", "creation-date", "date", "editing-duration"]
          : ["creator", "initial-creator", "creation-date", "date", "editing-duration", "generator", "title", "subject", "description", "keyword"];

        const els = xmlDoc.getElementsByTagName("*");
        for (let i = els.length - 1; i >= 0; i--) {
          const el = els[i];
          const localName = el.localName || el.tagName.split(':').pop();
          if (removeTags.includes(localName)) {
            el.textContent = "";
          }
          if (mode === 'all' && (localName === 'user-defined')) {
            el.parentNode.removeChild(el);
          }
        }
        const newMetaText = new XMLSerializer().serializeToString(xmlDoc);
        zip.file("meta.xml", newMetaText);
      }
      return await zip.generateAsync({ type: "blob" });
    }

    const zip = await loadSafeZip(fileObj);
    const coreFile = zip.file("docProps/core.xml");
    if (coreFile) {
      const coreText = await coreFile.async("string");
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(coreText, "application/xml");
      const elements = xmlDoc.getElementsByTagName("*");
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.localName === "coreProperties" || el.tagName.split(':').pop() === "coreProperties") continue;
        const localName = el.localName || el.tagName.split(':').pop();
        if (mode === 'private') {
          if (["creator", "lastModifiedBy", "created", "modified", "lastPrinted"].includes(localName)) {
            el.textContent = "";
          }
        } else if (mode === 'all') {
          if (localName !== "revision") {
            el.textContent = "";
          }
        }
      }
      zip.file("docProps/core.xml", new XMLSerializer().serializeToString(xmlDoc));
    }
    const appFile = zip.file("docProps/app.xml");
    if (appFile) {
      const appText = await appFile.async("string");
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(appText, "application/xml");
      const elements = xmlDoc.getElementsByTagName("*");
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        const localName = el.localName || el.tagName.split(':').pop();
        if (localName === "TotalTime") {
          el.textContent = "";
        }
      }
      zip.file("docProps/app.xml", new XMLSerializer().serializeToString(xmlDoc));
    }
    if (zip.file("docProps/custom.xml") && mode === 'all') {
      zip.remove("docProps/custom.xml");
    }
    return await zip.generateAsync({ type: "blob" });
  };

  const handleStripMetadata = async (fileObj, mode) => {
    setLoading(true);
    setStatus(t('tool-docmeta.ui.stripping', { name: fileObj.name }));
    try {
      const strippedBlob = await stripDocumentMetadata(fileObj.originalFile, mode, fileObj.type);
      
      setFiles(prev => prev.map(f => {
        if (f.id === fileObj.id) {
          return {
            ...f,
            strippedInfo: {
              mode: mode,
              blob: strippedBlob,
              size: strippedBlob.size,
              formattedSize: formatBytes(strippedBlob.size),
              core: mode === 'all' ? {} : { ...f.core, creator: '', lastModifiedBy: '', created: '', modified: '' },
              app: mode === 'all' ? {} : { ...f.app, TotalTime: '' },
              custom: mode === 'all' ? {} : f.custom,
              sheets: f.sheets,
              thumbnail: f.thumbnail
            }
          };
        }
        return f;
      }));
      
      setStatus(t('tool-docmeta.ui.stripSuccess'));
    } catch (err) {
      console.error("Error stripping metadata", err);
      setStatus(t('tool-docmeta.ui.stripFailed'));
    }
    setLoading(false);
  };

  const downloadStrippedFile = (fileObj) => {
    if (!fileObj.strippedInfo) return;
    const url = createObjectUrl(fileObj.strippedInfo.blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = fileObj.name.split('.').pop();
    const nameWithoutExt = fileObj.name.substring(0, fileObj.name.lastIndexOf('.'));
    a.download = `${nameWithoutExt}_stripped.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    revokeObjectUrl(url);
  };

  const handleRestoreOriginal = (fileId) => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        return { ...f, strippedInfo: null };
      }
      return f;
    }));
    setStatus(t('tool-docmeta.ui.restored'));
  };

  const handleToggleCompareSelection = (id) => {
    setCompareSelectedIds(prev =>
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  const activeFile = files.find(f => f.id === selectedFileId);
  const displayFile = activeFile ? (activeFile.strippedInfo || activeFile) : null;

  const getFileBadge = (type) => {
    switch (type) {
      case 'docx':
        return { label: 'Word (DOCX)', colorClass: 'badge-docx', icon: getFileIcon('docx', 20) };
      case 'xlsx':
        return { label: 'Excel (XLSX)', colorClass: 'badge-xlsx', icon: getFileIcon('xlsx', 20) };
      case 'pptx':
        return { label: 'PowerPoint (PPTX)', colorClass: 'badge-pptx', icon: getFileIcon('pptx', 20) };
      case 'odt':
        return { label: 'OpenOffice Text (ODT)', colorClass: 'badge-docx', icon: getFileIcon('odt', 20) };
      case 'ods':
        return { label: 'OpenOffice Spreadsheet (ODS)', colorClass: 'badge-xlsx', icon: getFileIcon('ods', 20) };
      case 'odp':
        return { label: 'OpenOffice Presentation (ODP)', colorClass: 'badge-pptx', icon: getFileIcon('odp', 20) };
      case 'odg':
        return { label: 'OpenOffice Drawing (ODG)', colorClass: 'badge-unknown', icon: getFileIcon('odg', 20) };
      case 'pdf':
        return { label: 'PDF Document', colorClass: 'badge-pdf text-red-500', icon: getFileIcon('pdf', 20) };
      default:
        return { label: 'Document', colorClass: 'badge-unknown', icon: getFileIcon('default', 20) };
    }
  };

  const getGroupedAdvancedTags = (file) => {
    if (!file) return { groups: {}, matchCount: 0 };

    const groups = {
      core: [],
      app: [],
      format: [],
      custom: []
    };

    let matchCount = 0;

    const checkMatch = (name, value, desc) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      return name.toLowerCase().includes(q) ||
             String(value).toLowerCase().includes(q) ||
             String(desc).toLowerCase().includes(q);
    };

    const addTag = (groupKey, name, value, desc) => {
      if (checkMatch(name, value, desc)) {
        groups[groupKey].push({ name, value, description: desc });
        matchCount++;
      }
    };

    const coreFields = [
      { key: 'Title', dbKey: 'title', rawValue: file.core.title },
      { key: 'Creator (Author)', dbKey: 'creator', rawValue: file.core.creator },
      { key: 'Subject', dbKey: 'subject', rawValue: file.core.subject },
      { key: 'Description / Notes', dbKey: 'description', rawValue: file.core.description },
      { key: 'Keywords', dbKey: 'keywords', rawValue: file.core.keywords },
      { key: 'Category', dbKey: 'category', rawValue: file.core.category },
      { key: 'Content Status', dbKey: 'contentStatus', rawValue: file.core.contentStatus },
      { key: 'Revision Count', dbKey: 'revision', rawValue: file.core.revision },
      { key: 'Created Time', dbKey: 'created', rawValue: formatDate(file.core.created) },
      { key: 'Last Modified By', dbKey: 'lastModifiedBy', rawValue: file.core.lastModifiedBy },
      { key: 'Modified Time', dbKey: 'modified', rawValue: formatDate(file.core.modified) },
      { key: 'Last Printed', dbKey: 'lastPrinted', rawValue: formatDate(file.core.lastPrinted) },
    ];
    coreFields.forEach(f => {
      if (f.rawValue !== undefined && f.rawValue !== '') {
        addTag('core', f.key, f.rawValue, FIELD_DESCRIPTIONS[f.dbKey] || 'Document core property');
      }
    });

    const appFields = [
      { key: 'Application Software', dbKey: 'Application', rawValue: file.app.Application },
      { key: 'Application Version', dbKey: 'AppVersion', rawValue: file.app.AppVersion },
      { key: 'PDF Specification Version', dbKey: 'PdfVersion', rawValue: file.app.PdfVersion },
      { key: 'PDF Producer', dbKey: 'Producer', rawValue: file.app.Producer },
      { key: 'Encrypted / Protected', dbKey: 'Encrypted', rawValue: file.app.Encrypted },
      { key: 'Fast Web View (Linearized)', dbKey: 'Linearized', rawValue: file.app.Linearized },
      { key: 'PDF Conformance Standard', dbKey: 'PdfStandard', rawValue: file.app.PdfStandard },
      { key: 'Company', dbKey: 'Company', rawValue: file.app.Company },
      { key: 'Manager', dbKey: 'Manager', rawValue: file.app.Manager },
      { key: 'Template Used', dbKey: 'Template', rawValue: file.app.Template },
      { key: 'Print Trapping State', dbKey: 'Trapped', rawValue: file.app.Trapped },
    ];
    appFields.forEach(f => {
      if (f.rawValue !== undefined && f.rawValue !== '') {
        addTag('app', f.key, f.rawValue, FIELD_DESCRIPTIONS[f.dbKey] || 'Application property');
      }
    });

    const formattedTime = formatMinutes(file.app.TotalTime);
    if (formattedTime) {
      addTag('app', 'Total Editing Time', formattedTime, FIELD_DESCRIPTIONS.TotalTime);
    } else if (file.app.TotalTime !== undefined && file.app.TotalTime !== '') {
      addTag('app', 'Total Editing Time', file.app.TotalTime, FIELD_DESCRIPTIONS.TotalTime);
    }

    if (['docx', 'odt', 'pdf'].includes(file.type)) {
      const docFields = [
        { key: 'Total Pages', dbKey: 'Pages', rawValue: file.app.Pages },
        { key: 'Page Dimensions', dbKey: 'PageDimensions', rawValue: file.app.PageDimensions },
        { key: 'Page Orientation', dbKey: 'PageOrientation', rawValue: file.app.PageOrientation },
        { key: 'Embedded Fonts Count', dbKey: 'FontCount', rawValue: file.app.FontCount },
        { key: 'Embedded Fonts List', dbKey: 'EmbeddedFonts', rawValue: file.app.EmbeddedFonts },
        { key: 'Embedded Images Count', dbKey: 'Images', rawValue: file.app.Images },
        { key: 'Interactive Form (AcroForm)', dbKey: 'InteractiveForm', rawValue: file.app.InteractiveForm },
        { key: 'Tagged PDF (Accessibility)', dbKey: 'TaggedPdf', rawValue: file.app.TaggedPdf },
        { key: 'Document Bookmarks / Outlines', dbKey: 'Bookmarks', rawValue: file.app.Bookmarks },
        { key: 'JavaScript Scripts / Actions', dbKey: 'JavaScriptActions', rawValue: file.app.JavaScriptActions },
        { key: 'Words Count', dbKey: 'Words', rawValue: file.app.Words },
        { key: 'Characters', dbKey: 'Characters', rawValue: file.app.Characters },
        { key: 'Characters (with spaces)', dbKey: 'CharactersWithSpaces', rawValue: file.app.CharactersWithSpaces },
        { key: 'Paragraphs', dbKey: 'Paragraphs', rawValue: file.app.Paragraphs },
        { key: 'Lines', dbKey: 'Lines', rawValue: file.app.Lines },
        { key: 'Tables', dbKey: 'Tables', rawValue: file.app.Tables },
      ];
      docFields.forEach(f => {
        if (f.rawValue !== undefined && f.rawValue !== '') {
          addTag('format', f.key, f.rawValue, FIELD_DESCRIPTIONS[f.dbKey] || 'Document metric');
        }
      });
    } else if (['pptx', 'odp'].includes(file.type)) {
      const pptxFields = [
        { key: 'Slides Count', dbKey: 'Slides', rawValue: file.app.Slides },
        { key: 'Hidden Slides', dbKey: 'HiddenSlides', rawValue: file.app.HiddenSlides },
        { key: 'Notes Pages', dbKey: 'Notes', rawValue: file.app.Notes },
        { key: 'Presentation Format', dbKey: 'PresentationFormat', rawValue: file.app.PresentationFormat },
        { key: 'Multimedia Clips (MMClips)', dbKey: 'MMClips', rawValue: file.app.MMClips },
      ];
      pptxFields.forEach(f => {
        if (f.rawValue !== undefined && f.rawValue !== '') {
          addTag('format', f.key, f.rawValue, FIELD_DESCRIPTIONS[f.dbKey] || 'Presentation metric');
        }
      });
    } else if (['xlsx', 'ods'].includes(file.type)) {
      if (file.sheets && file.sheets.length > 0) {
        addTag('format', 'Sheets Count', String(file.sheets.length), 'Total number of worksheets');
        addTag('format', 'Worksheets List', file.sheets.map(s => `${s.name}${s.state !== 'visible' ? ` (${s.state})` : ''}`).join(', '), FIELD_DESCRIPTIONS.Sheets);
      }
      if (file.app.headingPairs && file.app.headingPairs.length > 0) {
        file.app.headingPairs.forEach(pair => {
          addTag('format', `Heading Pair: ${pair.label}`, pair.count, FIELD_DESCRIPTIONS.HeadingPairs);
        });
      }
    }

    if (file.custom) {
      Object.keys(file.custom).forEach(name => {
        addTag('custom', name, file.custom[name], 'Custom user-defined metadata property');
      });
    }

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    });

    return { groups, matchCount };
  };

  const toggleExpandAll = () => {
    const anyCollapsed = Object.values(collapsedGroups).some(v => v);
    const target = !anyCollapsed;
    setCollapsedGroups({
      core: target,
      app: target,
      format: target,
      custom: target
    });
  };

  const renderCompareView = () => {
    const comparedFiles = files.filter(f => compareSelectedIds.includes(f.id));

    return (
      <div className="bg-card border border-border rounded-xl p-5 mt-4">
        <div className="flex justify-between items-center pb-3 border-b border-border mb-4">
          <h3 className="text-md font-bold text-text-main flex items-center gap-2">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M4 4l5 5"></path>
            </svg>
            {t('tool-docmeta.ui.comparisonTitle')}
          </h3>
          <Button variant="secondary" size="sm" onClick={() => setCompareMode(false)}>
            {t('tool-docmeta.ui.backDetail')}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          {comparedFiles.length > 0 ? (
            <table className="w-full border-collapse text-left text-sm min-w-[600px]">
              <thead>
                <tr className="bg-app border-b border-border">
                  <th className="p-3 px-4 text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-docmeta.ui.fieldParameter')}</th>
                  {comparedFiles.map(f => (
                    <th key={f.id} className={`p-3 px-4 text-xs font-bold text-text-muted uppercase tracking-wider max-w-[200px] truncate ${f.id === selectedFileId ? 'bg-accent-light/10 text-accent font-extrabold' : ''}`}>
                      <div className="flex items-center justify-between gap-2 truncate">
                        <span className="truncate" title={f.name}>{f.name}</span>
                        <button
                          className="text-text-muted hover:text-red-500 font-bold text-base bg-transparent border-none cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCompareSelection(f.id);
                          }}
                          title={t('metadata-common.excludeComparison')}
                        >
                          &times;
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_FIELDS.map((field, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0 hover:bg-hover-bg/30">
                    <td className="p-2.5 px-4 text-xs font-semibold text-text-muted">{t(field.labelKey)}</td>
                    {comparedFiles.map(f => {
                      const val = field.fn(f);
                      return (
                        <td 
                          key={f.id} 
                          className={`p-2.5 px-4 text-xs text-text-main ${f.id === selectedFileId ? 'bg-accent-light/5' : ''} ${!val ? 'text-text-muted italic' : ''}`}
                        >
                          {val || '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-text-muted italic">
              <p>{t('tool-docmeta.ui.noDocumentsCompared')}</p>
              <p className="text-xs text-text-muted/75 mt-1">
                {t('tool-docmeta.ui.selectComparisonHint')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderOverviewTab = () => {
    const fileToUse = displayFile;
    if (!fileToUse) return null;

    const coreItems = [
      { label: 'Title', value: fileToUse.core.title, description: FIELD_DESCRIPTIONS.title },
      { label: 'Creator (Author)', value: fileToUse.core.creator, description: FIELD_DESCRIPTIONS.creator },
      { label: 'Created Time', value: formatDate(fileToUse.core.created), description: FIELD_DESCRIPTIONS.created },
      { label: 'Last Modified By', value: fileToUse.core.lastModifiedBy, description: FIELD_DESCRIPTIONS.lastModifiedBy },
      { label: 'Modified Time', value: formatDate(fileToUse.core.modified), description: FIELD_DESCRIPTIONS.modified }
    ].filter(item => item.value !== undefined && item.value !== '');

    const appItems = [
      { label: 'Application Software', value: fileToUse.app.Application, description: FIELD_DESCRIPTIONS.Application },
      { label: 'Application Version', value: fileToUse.app.AppVersion, description: FIELD_DESCRIPTIONS.AppVersion },
      { label: 'PDF Specification Version', value: fileToUse.app.PdfVersion, description: FIELD_DESCRIPTIONS.PdfVersion },
      { label: 'PDF Producer', value: fileToUse.app.Producer, description: FIELD_DESCRIPTIONS.Producer },
      { label: 'Page Dimensions', value: fileToUse.app.PageDimensions, description: FIELD_DESCRIPTIONS.PageDimensions }
    ].filter(item => item.value !== undefined && item.value !== '');

    if (fileToUse.app.TotalTime !== undefined && fileToUse.app.TotalTime !== '') {
      appItems.push({
        label: 'Total Editing Time',
        value: fileToUse.app.TotalTime,
        description: FIELD_DESCRIPTIONS.TotalTime
      });
    }

    const renderMetaTable = (title, items) => {
      const query = searchQuery.toLowerCase().trim();
      const filtered = items.filter(item => {
        if (!query) return true;
        return (item.description || '').toLowerCase().includes(query) || 
               (item.value || '').toLowerCase().includes(query);
      });
      if (filtered.length === 0 && query) return null;

      return (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">{title}</h3>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-app border-b border-border">
                  <th className="p-2.5 px-4 font-semibold text-text-muted w-[40%]">{t('tool-docmeta.ui.description')}</th>
                  <th className="p-2.5 px-4 font-semibold text-text-muted">{t('tool-docmeta.ui.value')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0 hover:bg-hover-bg/30">
                    <td className="p-2.5 px-4 text-text-muted font-medium">{item.description || item.label}</td>
                    <td className="p-2.5 px-4 text-text-main font-semibold break-all" title={item.value}>
                      {item.value || <span className="text-text-muted font-normal italic">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    const renderFormatSpecific = () => {
      let items = [];
      const badge = getFileBadge(fileToUse.type);
      if (['docx', 'odt', 'pdf'].includes(fileToUse.type)) {
        items = [
          { label: 'Total Pages', value: fileToUse.app.Pages, description: FIELD_DESCRIPTIONS.Pages },
          { label: 'Words Count', value: fileToUse.app.Words, description: FIELD_DESCRIPTIONS.Words }
        ].filter(item => item.value !== undefined && item.value !== '');
      } else if (['pptx', 'odp'].includes(fileToUse.type)) {
        items = [
          { label: 'Slides Count', value: fileToUse.app.Slides, description: FIELD_DESCRIPTIONS.Slides }
        ].filter(item => item.value !== undefined && item.value !== '');
      } else if (['xlsx', 'ods'].includes(fileToUse.type)) {
        const xlsxItems = [];
        if (fileToUse.sheets && fileToUse.sheets.length > 0) {
          xlsxItems.push({
            label: 'Sheets Count',
            value: String(fileToUse.sheets.length),
            description: 'Total number of worksheets'
          });
          xlsxItems.push({
            label: 'Worksheets List',
            value: fileToUse.sheets.map(s => `${s.name}${s.state !== 'visible' ? ` (${s.state})` : ''}`).join(', '),
            description: FIELD_DESCRIPTIONS.Sheets
          });
        }
        return renderMetaTable(`${badge.label} Specific Properties`, xlsxItems);
      }
      return renderMetaTable(`${badge.label} Specific Properties`, items);
    };

    return (
      <div className="flex flex-col gap-4">
        {renderFormatSpecific()}
        {renderMetaTable("Core Properties", coreItems)}
        {renderMetaTable("Application Properties", appItems)}
      </div>
    );
  };

  const renderAllParametersTab = () => {
    if (!displayFile) return null;

    const { groups, matchCount } = getGroupedAdvancedTags(displayFile);

    const advancedGroups = [
      {
        id: 'core',
        label: 'Core Properties',
        icon: (
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        )
      },
      {
        id: 'app',
        label: 'Application Properties',
        icon: (
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        )
      },
      {
        id: 'format',
        label: 'Format-Specific Properties',
        icon: (
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
        )
      },
      {
        id: 'custom',
        label: 'Custom Properties',
        icon: (
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
          </svg>
        )
      }
    ];

    if (matchCount === 0) {
      return (
        <div className="p-4 text-center text-text-muted italic">{t('tool-docmeta.ui.noMatchingParameters')}</div>
      );
    }

    return (
      <div className="flex flex-col gap-3.5">
        <div className="flex justify-between items-center bg-card border border-border rounded-xl p-3 px-4">
          <span className="text-xs font-semibold text-text-muted">{t('tool-docmeta.ui.foundParameters', { count: matchCount })}</span>
          <Button variant="secondary" size="sm" onClick={toggleExpandAll}>
            {Object.values(collapsedGroups).every(v => !v) ? 'Collapse All' : 'Expand All'}
          </Button>
        </div>
        
        <div className="flex flex-col gap-3">
          {advancedGroups.map(g => {
            const list = groups[g.id] || [];
            if (list.length === 0) return null;
            
            const isCollapsed = collapsedGroups[g.id];
            
            return (
              <div key={g.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  className="flex items-center justify-between w-full p-4 bg-transparent border-none cursor-pointer text-left transition-colors hover:bg-hover-bg/30"
                  onClick={() => setCollapsedGroups(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                  id={`docmeta-group-${g.id}`}
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-text-main">
                    <span className="text-accent">{g.icon}</span>
                    <span>{g.label}</span>
                    <span className="text-xs text-text-muted bg-app px-2 py-0.5 rounded-full ml-1">{list.length}</span>
                  </div>
                  <svg
                    className={`text-text-muted shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                
                {!isCollapsed && (
                  <div className="border-t border-border overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-app border-b border-border">
                          <th className="p-2.5 px-4 font-semibold text-text-muted w-[30%]">{t('tool-docmeta.ui.parameterName')}</th>
                          <th className="p-2.5 px-4 font-semibold text-text-muted w-[35%]">{t('tool-docmeta.ui.value')}</th>
                          <th className="p-2.5 px-4 font-semibold text-text-muted">{t('tool-docmeta.ui.description')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map(tag => (
                          <tr key={tag.name} className="border-b border-border last:border-0 hover:bg-hover-bg/30">
                            <td className="p-2.5 px-4 text-text-main font-semibold">{tag.name}</td>
                            <td className="p-2.5 px-4 text-text-main break-all" title={tag.value}>
                              {tag.value || <span className="text-text-muted font-normal italic">—</span>}
                            </td>
                            <td className="p-2.5 px-4 text-text-muted font-medium break-words" title={tag.description}>{tag.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card id="tool-docmeta" variant="tool" size="wide">
      <ToolHeader 
        title={t('tool-docmeta.ui.title')}
      />

      <div 
        className="relative mt-4 flex flex-col gap-4"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="docmeta-file-input"
          accept=".docx,.xlsx,.pptx,.odt,.ods,.odp,.odg,.pdf"
          multiple
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleFileChange}
        />

        {dragOver && files.length > 0 && (
          <div className="absolute inset-0 bg-accent/15 border-2 border-dashed border-accent rounded-xl flex flex-col items-center justify-center gap-3 z-50 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-accent animate-bounce">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <p className="text-lg font-bold text-text-main">{t('tool-docmeta.ui.dropAnalyze')}</p>
          </div>
        )}

        {files.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
            <div className="flex gap-4 overflow-x-auto pb-1 divide-x divide-border scrollbar-thin">
              {files.map(file => {
                const badge = getFileBadge(file.type);
                const isSelected = file.id === selectedFileId;
                return (
                  <div
                    key={file.id}
                    className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all border border-transparent shrink-0 relative group ${isSelected ? 'bg-accent-light/10 border-accent/20' : 'hover:bg-hover-bg/50'}`}
                    onClick={() => {
                      setSelectedFileId(file.id);
                      setCompareMode(false);
                    }}
                  >
                    {files.length > 1 && (
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-accent w-4 h-4 mr-1 cursor-pointer shrink-0"
                        checked={compareSelectedIds.includes(file.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleCompareSelection(file.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        title={t('metadata-common.includeComparison')}
                      />
                    )}
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-app relative border border-border/50">
                      <div className={`w-full h-full flex items-center justify-center ${badge.colorClass}`}>
                        {badge.icon}
                      </div>
                      <button
                        className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold border-none cursor-pointer hover:bg-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(file.id);
                        }}
                        title={t('metadata-common.removeFile')}
                      >
                        &times;
                      </button>
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0 max-w-[120px]">
                      <span className="text-xs font-semibold text-text-main truncate" title={file.name}>{file.name}</span>
                      <span className="text-[10px] text-text-muted">{file.strippedInfo ? file.strippedInfo.formattedSize : file.formattedSize}</span>
                    </div>
                  </div>
                );
              })}
              
              <div 
                className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-dashed border-border hover:border-accent hover:bg-accent-light/5 cursor-pointer shrink-0 text-xs font-bold text-text-muted hover:text-accent transition-all" 
                onClick={handleDropzoneClick}
              >
                <div className="text-lg leading-none">+</div>
                <span>{t('tool-docmeta.ui.addMore')}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center justify-between border-t border-border pt-4">
              {activeFile && (
                <div className="flex flex-wrap gap-2 items-center">
                  {!activeFile.strippedInfo ? (
                    <>
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider mr-2">{t('tool-docmeta.ui.stripTags')}</span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStripMetadata(activeFile, 'private')}
                        title={t('tool-docmeta.ui.privateTitle')}
                      >
                        🔒 {t('metadata-common.private')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStripMetadata(activeFile, 'all')}
                        title={t('tool-docmeta.ui.allTitle')}
                      >
                        🗑️ {t('metadata-common.all')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-500/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 mr-2">
                        ✓ {t('metadata-common.tagsStripped', {
                          mode: activeFile.strippedInfo.mode === 'private'
                            ? t('metadata-common.private')
                            : t('metadata-common.all'),
                        })}
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => downloadStrippedFile(activeFile)}
                        title={t('tool-docmeta.ui.downloadTitle')}
                      >
                        💾 {t('metadata-common.download')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRestoreOriginal(activeFile.id)}
                        title={t('tool-docmeta.ui.restoreTitle')}
                      >
                        🔄 {t('metadata-common.restore')}
                      </Button>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2 ml-auto">
                <Button 
                  variant={compareMode ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setCompareMode(!compareMode)}
                  title={t('metadata-common.toggleComparison')}
                  className="flex items-center gap-1.5"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M4 4l5 5"></path>
                  </svg>
                  <span>{t('tool-docmeta.ui.compare')} {files.length > 1 ? `(${compareSelectedIds.length})` : ''}</span>
                </Button>
                <Button variant="secondary" size="sm" onClick={handleClearAll}>
                  {t('tool-docmeta.ui.clearAll')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {files.length === 0 && (
          <div 
            className="border-2 border-dashed border-border rounded-xl p-8 py-10 cursor-pointer text-center transition-all flex flex-col items-center justify-center gap-3 min-h-[220px] hover:border-accent hover:bg-accent-light/5"
            onClick={handleDropzoneClick}
          >
            <div className="flex flex-col items-center gap-3">
              <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted transition-transform duration-300 hover:scale-110">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <polyline points="9 15 12 12 15 15"></polyline>
              </svg>
              <p className="text-lg font-bold text-text-main">{t('tool-docmeta.ui.dragDrop')}</p>
              <p className="text-sm text-text-muted">{t('tool-docmeta.ui.or')}</p>
              <Button 
                type="button" 
                variant="secondary" 
                onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}
              >
                {t('tool-docmeta.ui.browse')}
              </Button>
              <p className="text-xs text-text-muted mt-2">{t('tool-docmeta.ui.supports')}</p>
            </div>
          </div>
        )}

        {status && (
          <div className="flex items-center gap-3 bg-accent-light/10 border border-accent/20 rounded-xl p-3.5 text-sm text-accent">
            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shrink-0"></span>
            <span className="font-semibold">{status}</span>
          </div>
        )}

        {files.length > 0 && (
          compareMode ? (
            renderCompareView()
          ) : (
            activeFile && (
              <div id="docmeta-results" className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-start">
                <div className="flex flex-col gap-4">
                  <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden border border-border flex items-center justify-center bg-app shrink-0 shadow-inner">
                      {activeFile.thumbnail ? (
                        <img id="docmeta-preview-img" alt={t('metadata-common.documentPreview')} src={activeFile.thumbnail} className="w-full h-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center gap-2.5">
                          {getFileIcon(activeFile.type, 48)}
                          <span className="text-xs font-bold uppercase tracking-wider text-text-main">{getFileBadge(activeFile.type).label}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 min-w-0">
                      <h3 id="docmeta-file-name" className="text-base font-bold text-text-main break-words" title={activeFile.name}>{activeFile.name}</h3>
                      <div className="flex flex-col gap-1 text-xs">
                        <p className="flex justify-between border-b border-border/50 py-1"><span className="text-text-muted font-medium">{t('metadata-common.format')}</span> <span className="font-semibold text-text-main">{activeFile.type.toUpperCase()}</span></p>
                        <p className="flex justify-between py-1"><span className="text-text-muted font-medium">{t('metadata-common.size')}</span> <span className="font-semibold text-text-main">{displayFile.formattedSize}</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      id="docmeta-download-json"
                      variant="primary"
                      className="flex-1 flex items-center justify-center gap-1.5"
                      onClick={handleExportJson}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span>{t('tool-docmeta.ui.exportJson')}</span>
                    </Button>
                    <Button variant="secondary" onClick={() => handleRemoveFile(activeFile.id)}>{t('tool-docmeta.ui.remove')}</Button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 min-w-0">
                  <div className="flex flex-wrap gap-4 items-center justify-between pb-3 border-b border-border">
                    <div className="flex gap-2">
                      <Button 
                        variant={activeTab === 'overview' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setActiveTab('overview')}
                      >
                        {t('tool-docmeta.ui.overview')}
                      </Button>
                      <Button 
                        variant={activeTab === 'all-parameters' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setActiveTab('all-parameters')}
                      >
                        {t('tool-docmeta.ui.allParameters')}
                      </Button>
                    </div>
                    <div className="relative w-full max-w-[240px]">
                      <input
                        type="text"
                        placeholder={t('tool-docmeta.ui.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-card border border-border rounded-lg p-2 px-3 text-xs text-text-main outline-none focus:border-accent placeholder-text-muted/50"
                      />
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex flex-col items-center justify-center p-8 gap-3 bg-card border border-border rounded-xl">
                      <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
                      <p className="text-sm text-text-muted font-medium">{t('tool-docmeta.ui.analyzing')}</p>
                    </div>
                  ) : (
                    activeTab === 'overview' ? renderOverviewTab() : renderAllParametersTab()
                  )}
                </div>
              </div>
            )
          )
        )}
      </div>
    </Card>
  );
}
