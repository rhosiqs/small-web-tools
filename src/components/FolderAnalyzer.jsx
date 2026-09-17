import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';
import { createGitignoreMatcher, escapeXml } from '../lib/folderAnalyzerUtils';
import { FILE_RESOURCE_POLICIES, validateResourceAddition } from '../lib/resourceLimits';


const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 
  'scss', 'sass', 'less', 'svg', 'xml', 'yaml', 'yml', 'py', 'java', 'c', 
  'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'pl', 'sh', 'bat', 
  'ps1', 'sql', 'ini', 'conf', 'cfg', 'env', 'gitignore', 'gitattributes', 
  'editorconfig', 'toml', 'csv', 'jsonl', 'graphql', 'prisma'
]);

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf', 'zip', 'rar', 'tar', 
  'gz', '7z', 'mp3', 'mp4', 'wav', 'flac', 'avi', 'mov', 'wmv', 'ogg', 
  'm4a', 'webm', 'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'db', 'sqlite', 
  'class', 'jar', 'war', 'eot', 'ttf', 'woff', 'woff2'
]);

const SYSTEM_EXCLUDES = new Set(['node_modules', '.git', 'dist', 'build', '.next']);


export default function FolderAnalyzer() {
  const { t, i18n } = useTranslation('tools');
  const [status, setStatus] = useState('idle'); // idle, scanning, success, error
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const acceptedFilesRef = useRef([]);
  const [scannedProjects, setScannedProjects] = useState([]);
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const [viewMode, setViewMode] = useState('figure'); // figure, text
  const [collapsedPaths, setCollapsedPaths] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const activeProject = scannedProjects[activeProjectIndex] || null;
  const treeData = activeProject ? activeProject.treeData : null;
  const gitignoreText = activeProject ? activeProject.gitignoreText : '';

  // Filters & Sorting States
  const [showSystemExclude, setShowSystemExclude] = useState(false);
  const [showGitignored, setShowGitignored] = useState(true);
  const [sortBy, setSortBy] = useState('name'); // name, type, lines, size
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc

  // Dynamic Metrics Calculation
  const projectStats = React.useMemo(() => {
    let filesCount = 0;
    let totalLines = 0;
    let totalSize = 0;

    function traverse(n, isRoot = false) {
      if (!isRoot && !showSystemExclude && n.isSystemExclude) return;
      if (!isRoot && !showGitignored && n.isIgnored && !n.isSystemExclude) return;

      if (n.type === 'file') {
        filesCount++;
        totalSize += n.size;
        totalLines += n.lineCount;
      } else if (n.children) {
        n.children.forEach(c => traverse(c, false));
      }
    }

    if (treeData) {
      traverse(treeData, true);
    }

    return {
      filesCount,
      totalLines,
      totalSize
    };
  }, [treeData, showSystemExclude, showGitignored]);

  const folderInputRef = useRef(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadWrapperRef = useRef(null);

  // Close download dropdown on clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (downloadWrapperRef.current && !downloadWrapperRef.current.contains(e.target)) {
        setDownloadOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Reset copy success tooltip after a delay
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

  // Recursively check if file is text/code by extension or content analysis
  async function isTextFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) return false;
    if (TEXT_EXTENSIONS.has(ext)) return true;

    // Fallback: analyze file contents (first 1024 bytes)
    try {
      const chunk = await file.slice(0, 1024).arrayBuffer();
      const bytes = new Uint8Array(chunk);
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) return false; // Null byte indicates binary
      }
      return file.size < 5 * 1024 * 1024; // text file limit 5MB
  } catch {
      return false;
    }
  }

  // Count lines in a File object
  function countFileLines(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = String(e.target?.result || '');
        if (!text) {
          resolve(0);
          return;
        }
        const lines = text.split(/\r?\n/).length;
        resolve(lines);
      };
      reader.onerror = () => resolve(0);
      reader.readAsText(file);
    });
  }

  const handleClear = () => {
    acceptedFilesRef.current = [];
    setScannedProjects([]);
    setActiveProjectIndex(0);
    setCollapsedPaths({});
    setStatus('idle');
    setProgress({ current: 0, total: 0, phase: '' });
  };

  // Parse items from directory selection or drag-and-drop
  async function processFiles(fileList, rootFolderNames, shouldAppend = false) {
    if ((!fileList || fileList.length === 0) && (!rootFolderNames || rootFolderNames.length === 0)) return;
    const resourceCheck = validateResourceAddition(
      shouldAppend ? acceptedFilesRef.current : [],
      fileList,
      FILE_RESOURCE_POLICIES.folderAnalysis,
    );
    if (!resourceCheck.valid) {
      setErrorMsg(t(`tool-folder-analyzer.ui.resourceError.${resourceCheck.reason}`));
      setStatus('error');
      return;
    }
    setStatus('scanning');
    setProgress({ current: 0, total: fileList ? fileList.length : 0, phase: t('tool-folder-analyzer.ui.progress.reading') });

    try {
      const existingNames = new Set(scannedProjects.map(p => p.name));
      const newRoots = shouldAppend ? rootFolderNames.filter(name => !existingNames.has(name)) : rootFolderNames;
      
      if (newRoots.length === 0) {
        setStatus('success');
        return;
      }

      const gitignoresByRoot = {};
      const filesByRoot = {};
      for (const name of newRoots) {
        filesByRoot[name] = [];
      }

      if (fileList && fileList.length > 0) {
        const gitignoreFiles = fileList.filter(
          f => f.name === '.gitignore' && (f.customPath || f.webkitRelativePath || '').replace(/\\/g, '/').split('/').length === 2
        );

        for (const gitfile of gitignoreFiles) {
          const text = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result || '');
            reader.onerror = () => resolve('');
            reader.readAsText(gitfile);
          });
          const folderName = (gitfile.customPath || gitfile.webkitRelativePath || '').replace(/\\/g, '/').split('/')[0];
          if (folderName) {
            gitignoresByRoot[folderName] = {
              text,
              matcher: createGitignoreMatcher(text)
            };
          }
        }

        // Group files by their top-level folder
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const fullPath = (file.customPath || file.webkitRelativePath || file.name).replace(/\\/g, '/');
          const firstPart = fullPath.split('/')[0] || 'root';
          if (filesByRoot[firstPart]) {
            filesByRoot[firstPart].push(file);
          } else {
            const rootName = newRoots[0];
            if (rootName && filesByRoot[rootName]) {
              filesByRoot[rootName].push(file);
            }
          }
        }
      }

      const projects = [];
      let totalFilesProcessed = 0;

      for (const rootName of newRoots) {
        const rootFiles = filesByRoot[rootName] || [];
        const gitInfo = gitignoresByRoot[rootName];
        const matcher = gitInfo ? gitInfo.matcher : () => false;
        const processedFiles = [];

        for (const file of rootFiles) {
          const fullPath = (file.customPath || file.webkitRelativePath || file.name).replace(/\\/g, '/');
          totalFilesProcessed++;

          setProgress({
            current: totalFilesProcessed,
            total: fileList ? fileList.length : 0,
            phase: t('tool-folder-analyzer.ui.progress.analyzing', { filename: file.name })
          });

          const isIgnored = matcher(fullPath, false);
          let lineCount = 0;
          const isText = await isTextFile(file);
          if (isText && file.size < 5 * 1024 * 1024 && !isIgnored) {
            lineCount = await countFileLines(file);
          }

          processedFiles.push({
            name: file.name,
            path: fullPath,
            size: file.size,
            lineCount: lineCount,
            isText,
            isIgnored
          });
        }

        const rootNode = buildTree(processedFiles, rootName);
        projects.push({
          name: rootName,
          path: rootName,
          treeData: rootNode,
          gitignoreText: gitInfo ? gitInfo.text : ''
        });
      }

      if (shouldAppend) {
        setScannedProjects(prev => {
          const next = [...prev, ...projects];
          setActiveProjectIndex(prev.length);
          return next;
        });
      } else {
        setScannedProjects(projects);
        setActiveProjectIndex(0);
      }
      setCollapsedPaths({});
      acceptedFilesRef.current = shouldAppend
        ? [...acceptedFilesRef.current, ...Array.from(fileList || [])]
        : Array.from(fileList || []);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setErrorMsg(t('tool-folder-analyzer.ui.error.processFailed', { message: err.message }));
      setStatus('error');
    }
  }

  // Handle standard <input type="file" webkitdirectory /> selection
  const handleFolderSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const filesArray = Array.from(files);
      const firstPath = filesArray[0].webkitRelativePath || '';
      const rootFolderName = firstPath.split('/')[0] || '';
      processFiles(filesArray, [rootFolderName], scannedProjects.length > 0);
    }
  };

  const openFolderInput = () => {
    if (!folderInputRef.current) return;
    folderInputRef.current.value = '';
    folderInputRef.current.click();
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  // Recursively read entries from drag & drop FileSystemEntry
  async function traverseEntry(entry, path = '') {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => {
          file.customPath = path ? `${path}/${entry.name}` : entry.name;
          try {
            file.webkitRelativePath = file.customPath;
          } catch {
            // Some browsers expose webkitRelativePath as read-only.
          }
          resolve([file]);
        }, () => resolve([]));
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await readAllEntries(reader);
      const childFiles = [];
      const currentPath = path ? `${path}/${entry.name}` : entry.name;
      for (const childEntry of entries) {
        const files = await traverseEntry(childEntry, currentPath);
        childFiles.push(...files);
      }
      return childFiles;
    }
    return [];
  }

  function readAllEntries(directoryReader) {
    return new Promise((resolve) => {
      const allEntries = [];
      const read = () => {
        directoryReader.readEntries((entries) => {
          if (entries.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...entries);
            read();
          }
        }, () => resolve(allEntries));
      };
      read();
    });
  }

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    setStatus('scanning');
    setProgress({ current: 0, total: 100, phase: t('tool-folder-analyzer.ui.progress.starting') });

    try {
      const allFiles = [];
      const rootFolders = new Set();
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            if (entry.isDirectory) {
              rootFolders.add(entry.name);
            }
            const files = await traverseEntry(entry);
            allFiles.push(...files);
          }
        }
      }
      
      const uniqueRoots = Array.from(rootFolders);
      if (uniqueRoots.length === 0 && allFiles.length > 0) {
        uniqueRoots.push('files');
      }

      if (uniqueRoots.length > 0 || allFiles.length > 0) {
        processFiles(allFiles, uniqueRoots, scannedProjects.length > 0);
      } else {
        setErrorMsg(t('tool-folder-analyzer.ui.error.nothingDetected'));
        setStatus('error');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(t('tool-folder-analyzer.ui.error.dropFailed', { message: err.message }));
      setStatus('error');
    }
  };

  const handleRemoveProject = (idx) => {
    setScannedProjects(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) {
        setStatus('idle');
        setActiveProjectIndex(0);
      } else {
        if (activeProjectIndex >= next.length) {
          setActiveProjectIndex(next.length - 1);
        } else if (activeProjectIndex === idx && idx > 0) {
          setActiveProjectIndex(idx - 1);
        }
      }
      return next;
    });
    setCollapsedPaths({});
  };

  // Reconstruct tree hierarchy
  function buildTree(files, pathPrefix) {
    // Determine root directory name
    let rootName = 'root';
    if (files.length > 0) {
      const firstPath = files[0].path;
      if (firstPath.startsWith('Batch Analysis||')) {
        rootName = 'Batch Analysis';
      } else {
        const firstPart = firstPath.split('/')[0];
        if (firstPart) {
          rootName = firstPart;
        }
      }
    }

    if (pathPrefix) {
      rootName = pathPrefix.replace(/\\/g, '/').replace(/\/$/, '');
    }

    const rootNode = {
      name: rootName,
      path: rootName,
      type: 'directory',
      children: [],
      lineCount: 0,
      size: 0,
      isIgnored: false,
      isSystemExclude: SYSTEM_EXCLUDES.has(rootName)
    };

    for (const file of files) {
      let parts;
      if (file.path.startsWith('Batch Analysis||')) {
        const batchParts = file.path.split('||'); // ['Batch Analysis', 'D:/path/A', 'src/App.jsx']
        parts = [batchParts[0], batchParts[1], ...batchParts[2].split('/')];
      } else {
        parts = file.path.split('/');
        if (pathPrefix) {
          parts[0] = rootName;
        }
      }

      let currentNode = rootNode;
      let currentPath = parts[0];

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        currentPath += '/' + part;
        const isFile = i === parts.length - 1;

        let childNode = currentNode.children.find(
          c => c.name === part && c.type === (isFile ? 'file' : 'directory')
        );

        if (!childNode) {
          const isSystem = SYSTEM_EXCLUDES.has(part) || currentNode.isSystemExclude;
          childNode = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'directory',
            lineCount: 0,
            size: 0,
            isIgnored: isFile ? file.isIgnored : false,
            isSystemExclude: isSystem,
            children: isFile ? undefined : []
          };
          currentNode.children.push(childNode);
        }

        if (isFile) {
          childNode.lineCount = file.lineCount;
          childNode.size = file.size;
          childNode.isText = file.isText;
          childNode.isIgnored = file.isIgnored;
        }

        currentNode = childNode;
      }
    }

    // Recursively count folder lines & sizes and determine if folder is ignored
    function calculateFolderStats(node) {
      if (node.type === 'file') {
        return { lines: node.lineCount, size: node.size, isIgnored: node.isIgnored };
      }
      let linesSum = 0;
      let sizeSum = 0;
      let allChildrenIgnored = node.children.length > 0;

      for (const child of node.children) {
        const stats = calculateFolderStats(child);
        linesSum += stats.lines;
        sizeSum += stats.size;
        if (!stats.isIgnored) {
          allChildrenIgnored = false;
        }
      }
      node.lineCount = linesSum;
      node.size = sizeSum;
      if (node.children.length > 0) {
        node.isIgnored = allChildrenIgnored;
      }
      return { lines: linesSum, size: sizeSum, isIgnored: node.isIgnored };
    }

    calculateFolderStats(rootNode);
    return rootNode;
  }

  // ASCII plain text tree generator
  function generateAsciiTree(node, prefix = '', isLast = true, isRoot = true) {
    if (!isRoot) {
      if (!showSystemExclude && node.isSystemExclude) return '';
      if (!showGitignored && node.isIgnored && !node.isSystemExclude) return '';
    }

    let result = '';
    const suffix = node.type === 'directory' ? '/' : '';
    const linesInfo = (node.type === 'file' && node.isText) ? ` (${node.lineCount} lines)` : '';

    if (isRoot) {
      result += node.name + suffix + '\n';
    } else {
      result += prefix + (isLast ? '└── ' : '├── ') + node.name + suffix + linesInfo + '\n';
    }

    const visibleChildren = (node.children || []).filter(c => {
      if (!showSystemExclude && c.isSystemExclude) return false;
      if (!showGitignored && c.isIgnored && !c.isSystemExclude) return false;
      return true;
    });

    if (visibleChildren.length > 0) {
      const sortedChildren = [...visibleChildren].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;

        let valA, valB;
        if (sortBy === 'name') {
          valA = a.name;
          valB = b.name;
        } else if (sortBy === 'type') {
          valA = a.type === 'directory' ? 'folder' : (a.name.split('.').pop() || '').toLowerCase();
          valB = b.type === 'directory' ? 'folder' : (b.name.split('.').pop() || '').toLowerCase();
        } else if (sortBy === 'lines') {
          valA = a.lineCount;
          valB = b.lineCount;
        } else if (sortBy === 'size') {
          valA = a.size;
          valB = b.size;
        }

        let compare = 0;
        if (typeof valA === 'string') {
          compare = valA.localeCompare(valB, i18n.language);
        } else {
          compare = valA - valB;
        }

        return sortOrder === 'asc' ? compare : -compare;
      });

      const nextPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
      for (let i = 0; i < sortedChildren.length; i++) {
        result += generateAsciiTree(sortedChildren[i], nextPrefix, i === sortedChildren.length - 1, false);
      }
    }
    return result;
  }

  // Copy Plain Text Tree
  const handleCopy = () => {
    if (!treeData) return;
    const textTree = generateAsciiTree(treeData);
    navigator.clipboard.writeText(textTree).then(() => {
      setCopySuccess(true);
    });
  };

  // Download Plain Text / SVG
  const handleDownload = (format = 'txt') => {
    if (!treeData) return;
    const textTree = generateAsciiTree(treeData);
    
    if (format === 'txt') {
      const blob = new Blob([textTree], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${treeData.name.split('/').pop() || 'project'}-structure.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else if (format === 'svg') {
      // Export a beautiful SVG schema of the tree
      const svgContent = generateTreeSvg(treeData);
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${treeData.name.split('/').pop() || 'project'}-structure.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Generates a clean visual SVG tree model representing the current folder
  function generateTreeSvg(rootNode) {
    const list = [];
    function buildSvgRows(node, depth = 0) {
      list.push({ name: node.name, type: node.type, depth, lineCount: node.lineCount });
      if (node.children && node.children.length > 0) {
        const sorted = [...node.children].sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name, i18n.language);
        });
        for (const child of sorted) {
          buildSvgRows(child, depth + 1);
        }
      }
    }
    buildSvgRows(rootNode);

    const rowHeight = 24;
    const indentWidth = 20;
    const width = 800;
    const height = list.length * rowHeight + 80;

    let svgRows = '';
    list.forEach((item, index) => {
      const y = 70 + index * rowHeight;
      const x = 30 + item.depth * indentWidth;

      let connectors = '';
      if (item.depth > 0) {
        connectors += `<line x1="${x - 12}" y1="${y - 12}" x2="${x - 12}" y2="${y + 12}" stroke="#4b5563" stroke-width="1.5" />`;
      }

      const isDir = item.type === 'directory';
      const iconColor = isDir ? '#f59e0b' : '#3b82f6';
      const iconPath = isDir 
        ? 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
        : 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';

      const lineText = isDir ? '' : ` (${t('tool-folder-analyzer.ui.exportLines', {
        count: item.lineCount,
        formattedCount: item.lineCount.toLocaleString(i18n.language),
      })})`;
      const safeName = escapeXml(item.name);

      svgRows += `
        <g>
          ${connectors}
          <!-- Icon -->
          <svg x="${x}" y="${y - 14}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="${iconPath}" />
          </svg>
          <!-- Name -->
          <text x="${x + 24}" y="${y}" fill="#f3f4f6" font-family="JetBrains Mono, monospace" font-size="12px" font-weight="${isDir ? 'bold' : 'normal'}">${safeName}${isDir ? '/' : ''}<tspan fill="#9ca3af">${escapeXml(lineText)}</tspan></text>
        </g>
      `;
    });

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <rect width="100%" height="100%" fill="#0f172a" rx="12" />
        <!-- Header -->
        <text x="20" y="35" fill="#5EC95A" font-family="system-ui, sans-serif" font-size="16px" font-weight="bold">${escapeXml(t('tool-folder-analyzer.ui.exportTitle', { name: rootNode.name }))}</text>
        <line x1="20" y1="45" x2="${width - 20}" y2="45" stroke="#334155" stroke-width="1" />
        
        <!-- Tree content -->
        ${svgRows}
      </svg>
    `;
  }

  // Toggle open/close state of directory nodes
  const toggleFolder = (path) => {
    setCollapsedPaths(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleCollapseAll = () => {
    if (!treeData) return;
    const paths = {};
    const traverse = (node) => {
      if (node.type === 'directory') {
        if (node.path !== treeData.path) {
          paths[node.path] = true;
        }
        if (node.children) {
          node.children.forEach(traverse);
        }
      }
    };
    traverse(treeData);
    setCollapsedPaths(paths);
  };

  const handleExpandAll = () => {
    setCollapsedPaths({});
  };

  const hasCollapsedSubfolders = Object.keys(collapsedPaths).length > 0;

  const toggleExpandCollapseAll = () => {
    if (hasCollapsedSubfolders) {
      handleExpandAll();
    } else {
      handleCollapseAll();
    }
  };

  // Flatten active visible nodes to a list for table rendering
  function getFlattenedRows(node, depth = 0, isVisible = true, list = [], isRoot = true) {
    if (!isVisible) return list;

    // Filters
    if (!isRoot) {
      if (!showSystemExclude && node.isSystemExclude) return list;
      if (!showGitignored && node.isIgnored && !node.isSystemExclude) return list;
    }

    list.push({ ...node, depth });
    const isCollapsed = collapsedPaths[node.path];
    if (node.children && node.children.length > 0) {
      const sorted = [...node.children].sort((a, b) => {
        // Group directories first
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;

        let valA, valB;
        if (sortBy === 'name') {
          valA = a.name;
          valB = b.name;
        } else if (sortBy === 'type') {
          valA = a.type === 'directory' ? 'folder' : (a.name.split('.').pop() || '').toLowerCase();
          valB = b.type === 'directory' ? 'folder' : (b.name.split('.').pop() || '').toLowerCase();
        } else if (sortBy === 'lines') {
          valA = a.lineCount;
          valB = b.lineCount;
        } else if (sortBy === 'size') {
          valA = a.size;
          valB = b.size;
        }

        let compare = 0;
        if (typeof valA === 'string') {
          compare = valA.localeCompare(valB, i18n.language);
        } else {
          compare = valA - valB;
        }

        return sortOrder === 'asc' ? compare : -compare;
      });
      for (const child of sorted) {
        getFlattenedRows(child, depth + 1, !isCollapsed, list, false);
      }
    }
    return list;
  }

  // Helpers for table columns
  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getFileLabel(name, type) {
    if (type === 'directory') return t('tool-folder-analyzer.ui.fileType.folder');
    const ext = name.split('.').pop().toLowerCase();
    if (ext === name.toLowerCase()) return t('tool-folder-analyzer.ui.fileType.file');
    switch (ext) {
      case 'js': return 'JavaScript';
      case 'jsx': return 'React JS';
      case 'ts': return 'TypeScript';
      case 'tsx': return 'React TS';
      case 'html': return 'HTML';
      case 'css': return 'CSS';
      case 'scss': return 'Sass';
      case 'less': return 'Less';
      case 'json': return 'JSON';
      case 'md': return 'Markdown';
      case 'py': return 'Python';
      case 'java': return 'Java';
      case 'c': return t('tool-folder-analyzer.ui.fileType.code', { language: 'C' });
      case 'cpp': return t('tool-folder-analyzer.ui.fileType.code', { language: 'C++' });
      case 'h': return t('tool-folder-analyzer.ui.fileType.header', { language: 'C' });
      case 'cs': return t('tool-folder-analyzer.ui.fileType.code', { language: 'C#' });
      case 'go': return t('tool-folder-analyzer.ui.fileType.source', { language: 'Go' });
      case 'rs': return t('tool-folder-analyzer.ui.fileType.source', { language: 'Rust' });
      case 'php': return t('tool-folder-analyzer.ui.fileType.code', { language: 'PHP' });
      case 'rb': return t('tool-folder-analyzer.ui.fileType.code', { language: 'Ruby' });
      case 'sh': return t('tool-folder-analyzer.ui.fileType.script', { language: 'Shell' });
      case 'yml':
      case 'yaml': return t('tool-folder-analyzer.ui.fileType.config', { format: 'YAML' });
      case 'xml': return 'XML';
      case 'svg': return t('tool-folder-analyzer.ui.fileType.icon', { format: 'SVG' });
      default: return t('tool-folder-analyzer.ui.fileType.extension', { extension: ext.toUpperCase() });
    }
  }

  // Get Custom SVG Icon based on extension / folder
  function renderSvgIcon(name, type) {
    if (type === 'directory') {
      return (
        <svg className="folder-icon" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      );
    }

    const ext = name.split('.').pop().toLowerCase();
    let color = '#9ca3af'; // default gray

    switch (ext) {
      case 'js':
      case 'jsx':
        color = '#eab308'; // Yellow JS
        break;
      case 'ts':
      case 'tsx':
        color = '#3b82f6'; // Blue TS
        break;
      case 'html':
        color = '#f97316'; // Orange HTML
        break;
      case 'css':
      case 'scss':
      case 'less':
        color = '#06b6d4'; // Cyan CSS
        break;
      case 'json':
      case 'yml':
      case 'yaml':
      case 'toml':
        color = '#10b981'; // Green configs
        break;
      case 'md':
      case 'txt':
        color = '#8b5cf6'; // Purple documents
        break;
      case 'svg':
        color = '#ec4899'; // Pink vectors
        break;
      case 'py':
        color = '#3b82f6'; // python blue
        break;
      default:
        break;
    }

    return (
      <svg className="file-icon" style={{ color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    );
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortBy !== field) return null;
    return (
      <svg className={`sort-arrow-icon ${sortOrder}`} viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none">
        <polyline points={sortOrder === 'asc' ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}></polyline>
      </svg>
    );
  };

  const flattenedRows = treeData ? getFlattenedRows(treeData) : [];

  return (
    <Card 
      id="tool-folder-analyzer" 
      variant="tool" 
      size="wide"
      className={`relative ${dragOver ? 'border-accent bg-accent-light/5' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex justify-between items-start flex-wrap gap-4 w-full mb-3">
        <div className="flex-1 min-w-0">
          <ToolHeader 
            title={t('tool-folder-analyzer.title')}
          />
          {status === 'success' && activeProject && scannedProjects.length === 1 && (
            <div className="flex flex-wrap gap-3 items-center mt-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-muted bg-app border border-border p-1.5 px-3 rounded-lg">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-accent shrink-0">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span className="truncate max-w-[200px]" title={activeProject.path || activeProject.name}>{activeProject.path || activeProject.name}</span>
              </div>
              
              <button
                type="button"
                className="rounded-md border border-accent/40 bg-accent-light px-3 py-1.5 text-xs font-bold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"
                onClick={openFolderInput}
                aria-label={t('tool-folder-analyzer.ui.addFolderAria')}
              >
                {t('tool-folder-analyzer.ui.addFolder')}
              </button>
            </div>
          )}
        </div>
        {status === 'success' && (
          <Button variant="secondary" size="sm" onClick={handleClear} className="flex items-center gap-1.5 self-start">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" className="shrink-0">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            {t('tool-folder-analyzer.ui.clearAll')}
          </Button>
        )}
      </div>

      {/* Batch project tabs */}
      {status === 'success' && scannedProjects.length > 1 && (
        <div className="flex flex-wrap gap-2 items-center border-b border-border pb-3 mb-4 mt-2">
          {scannedProjects.map((proj, idx) => (
            <div key={proj.path + idx} className={`flex items-center gap-1.5 p-1.5 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors max-w-[200px] truncate ${idx === activeProjectIndex ? 'border-accent bg-accent-light/10 text-text-main' : 'border-border bg-card text-text-muted hover:border-accent hover:text-text-main'}`}>
              <button
                className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer truncate text-left text-xs font-medium text-inherit"
                onClick={() => { setActiveProjectIndex(idx); setCollapsedPaths({}); }}
                title={proj.path}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none" className="shrink-0">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span className="truncate">{proj.name}</span>
              </button>
              <button 
                className="text-text-muted hover:text-red-500 font-bold ml-1 text-sm bg-transparent border-none cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveProject(idx);
                }}
                title={t('tool-folder-analyzer.ui.removePath')}
              >
                &times;
              </button>
            </div>
          ))}
          
          <button
            type="button"
            className="rounded-md border border-accent/40 bg-accent-light px-3 py-1.5 text-xs font-bold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"
            onClick={openFolderInput}
            aria-label={t('tool-folder-analyzer.ui.addFolderAria')}
          >
            {t('tool-folder-analyzer.ui.addFolder')}
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={folderInputRef}
        {...{ webkitdirectory: '', directory: '' }}
        multiple
        style={{ display: 'none' }}
        onChange={handleFolderSelect}
      />

      {/* Selection Areas */}
      {status !== 'success' && (
        <div className="flex flex-col gap-4 mt-4">
          <button
            type="button"
            className="w-full border-2 border-dashed border-border bg-transparent rounded-xl p-8 py-10 cursor-pointer text-center transition-all flex flex-col items-center justify-center gap-3 min-h-[200px] hover:border-accent hover:bg-accent-light/5"
            onClick={() => {
              const directoryPicker = window.showDirectoryPicker;
              if (directoryPicker) {
                directoryPicker().then(async (dirHandle) => {
                  const files = [];
                  async function getFiles(handle, path = dirHandle.name) {
                    for await (const entry of handle.values()) {
                      if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        file.customPath = `${path}/${entry.name}`;
                        files.push(file);
                      } else if (entry.kind === 'directory') {
                        if (entry.name !== '.git') {
                          await getFiles(entry, `${path}/${entry.name}`);
                        }
                      }
                    }
                  }
                  await getFiles(dirHandle);
                  processFiles(files, [dirHandle.name], scannedProjects.length > 0);
                }).catch((err) => {
                  if (err.name !== 'AbortError') {
                    openFolderInput();
                  }
                });
              } else {
                openFolderInput();
              }
            }}
            aria-label={t('tool-folder-analyzer.ui.selectAria')}
          >
            <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted transition-transform duration-300 hover:scale-110">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <h2 className="text-lg font-bold text-text-main">{t('tool-folder-analyzer.ui.selectTitle')}</h2>
            <p className="text-sm text-text-muted">{t('tool-folder-analyzer.ui.selectDescription')}</p>
          </button>

          <div className="flex items-center gap-2 p-3 bg-app border border-border rounded-xl text-xs text-text-muted">
            <span>🔒 <strong>{t('tool-folder-analyzer.ui.privacyTitle')}</strong> {t('tool-folder-analyzer.ui.privacyDescription')}</span>
          </div>
        </div>
      )}

      {/* Scanning status */}
      {status === 'scanning' && (
        <div className="flex flex-col items-center justify-center p-8 gap-4 bg-card border border-border rounded-xl mt-4">
          <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
          <h4 className="text-lg font-bold text-text-main">{t('tool-folder-analyzer.ui.scanning')}</h4>
          <p className="text-sm text-text-muted">{progress.phase}</p>
          <div className="w-full max-w-md h-2 bg-border rounded-full overflow-hidden mt-2">
            <div 
              className="h-full bg-accent transition-all duration-300" 
              style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
            ></div>
          </div>
          <span className="text-xs text-text-muted">
            {t('tool-folder-analyzer.ui.progress.completed', { current: progress.current, total: progress.total })}
          </span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="flex flex-col items-center justify-center p-8 gap-4 bg-card border border-border rounded-xl mt-4">
          <svg viewBox="0 0 24 24" width="32" height="32" stroke="#ef4444" strokeWidth="2" fill="none" className="shrink-0">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h4 className="text-lg font-bold text-text-main">{t('tool-folder-analyzer.ui.errorTitle')}</h4>
          <p className="text-sm text-red-500 font-medium">{errorMsg}</p>
          <Button variant="secondary" onClick={() => setStatus('idle')}>{t('tool-folder-analyzer.ui.tryAgain')}</Button>
        </div>
      )}

      {/* Result stage */}
      {status === 'success' && treeData && (
        <div className="flex flex-col gap-5 mt-4">
          
          {/* Metrics summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 items-center justify-center text-center">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('tool-folder-analyzer.ui.totalFiles')}</span>
              <span className="text-2xl font-bold text-text-main">{projectStats.filesCount.toLocaleString(i18n.language)}</span>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 items-center justify-center text-center">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('tool-folder-analyzer.ui.totalLines')}</span>
              <span className="text-2xl font-bold text-accent">{projectStats.totalLines.toLocaleString(i18n.language)}</span>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 items-center justify-center text-center">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('tool-folder-analyzer.ui.projectSize')}</span>
              <span className="text-2xl font-bold text-text-main">{formatSize(projectStats.totalSize)}</span>
            </div>
          </div>

          {/* Result view header actions */}
          <div className="flex flex-wrap gap-4 items-center justify-between bg-card border border-border rounded-xl p-3 px-4">
            <div className="flex gap-2">
              <Button 
                variant={viewMode === 'figure' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setViewMode('figure')}
              >
                {t('tool-folder-analyzer.ui.figure')}
              </Button>
              <Button 
                variant={viewMode === 'text' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setViewMode('text')}
              >
                {t('tool-folder-analyzer.ui.plaintext')}
              </Button>
            </div>

            {/* Tree Collapse/Expand Actions */}
            {viewMode === 'figure' && (
              <Button 
                variant="secondary"
                size="sm"
                onClick={toggleExpandCollapseAll} 
                title={t(hasCollapsedSubfolders ? 'tool-folder-analyzer.ui.expandAllAria' : 'tool-folder-analyzer.ui.collapseAllAria')}
              >
                {t(hasCollapsedSubfolders ? 'tool-folder-analyzer.ui.expandAll' : 'tool-folder-analyzer.ui.collapseAll')}
              </Button>
            )}

            {/* Filters Toggles */}
            <div className="flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2 text-xs font-semibold text-text-main cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  id="toggle-system-exclude"
                  checked={showSystemExclude}
                  onChange={(e) => setShowSystemExclude(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent w-4 h-4"
                />
                <span>{t('tool-folder-analyzer.ui.excludedFolders')}</span>
              </label>
              
              {gitignoreText && (
                <label className="flex items-center gap-2 text-xs font-semibold text-text-main cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    id="toggle-gitignore"
                    checked={showGitignored}
                    onChange={(e) => setShowGitignored(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent w-4 h-4"
                  />
                  <span>{t('tool-folder-analyzer.ui.gitignoredFiles')}</span>
                </label>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="secondary"
                size="sm"
                title={t('tool-folder-analyzer.ui.copyTitle')}
                onClick={handleCopy}
                className="relative"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" className="shrink-0">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                {copySuccess && <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-2 py-0.5 rounded shadow">{t('tool-folder-analyzer.ui.copied')}</span>}
              </Button>

              <div 
                className="relative"
                ref={downloadWrapperRef}
                onMouseEnter={() => setDownloadOpen(true)}
                onMouseLeave={() => setDownloadOpen(false)}
              >
                <Button 
                  variant="secondary"
                  size="sm"
                  title={t('tool-folder-analyzer.ui.downloadTitle')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDownloadOpen(!downloadOpen);
                  }}
                  active={downloadOpen}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" className="shrink-0">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </Button>
                {downloadOpen && (
                  <div className="absolute right-0 mt-1 bg-card border border-border rounded-xl shadow-lg py-1.5 z-50 min-w-[160px] flex flex-col">
                    <button className="px-4 py-2 text-xs font-semibold text-text-main hover:bg-hover-bg text-left bg-transparent border-none cursor-pointer" onClick={() => { handleDownload('txt'); setDownloadOpen(false); }}>{t('tool-folder-analyzer.ui.downloadPlaintext')}</button>
                    <button className="px-4 py-2 text-xs font-semibold text-text-main hover:bg-hover-bg text-left bg-transparent border-none cursor-pointer" onClick={() => { handleDownload('svg'); setDownloadOpen(false); }}>{t('tool-folder-analyzer.ui.downloadSvg')}</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rendering outputs */}
          {viewMode === 'text' ? (
            <div className="bg-app border border-border rounded-xl p-5 overflow-auto max-h-[500px]">
              <pre className="m-0">
                <code className="font-mono text-xs text-text-main">{generateAsciiTree(treeData)}</code>
              </pre>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-x-auto w-full">
              <table className="w-full border-collapse text-left text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-app border-b border-border">
                    <th onClick={() => handleSort('name')} className="p-3 px-5 text-xs font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:bg-hover-bg/50 select-none">
                      <div className="flex items-center gap-1.5">
                        {t('tool-folder-analyzer.ui.name')} {renderSortIcon('name')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('type')} className="p-3 px-5 text-xs font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:bg-hover-bg/50 select-none">
                      <div className="flex items-center gap-1.5">
                        {t('tool-folder-analyzer.ui.type')} {renderSortIcon('type')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('lines')} className="p-3 px-5 text-xs font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:bg-hover-bg/50 select-none">
                      <div className="flex items-center gap-1.5">
                        {t('tool-folder-analyzer.ui.lines')} {renderSortIcon('lines')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('size')} className="p-3 px-5 text-xs font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:bg-hover-bg/50 select-none">
                      <div className="flex items-center gap-1.5">
                        {t('tool-folder-analyzer.ui.size')} {renderSortIcon('size')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flattenedRows.map((row) => {
                    const isDir = row.type === 'directory';
                    const isCollapsed = collapsedPaths[row.path];
                    const isDimmed = row.isIgnored || row.name === '.gitignore';

                    return (
                      <tr key={row.path} className={`border-b border-border last:border-0 transition-colors hover:bg-hover-bg/30 ${isDimmed ? 'opacity-40' : ''}`}>
                        <td className="p-2 px-5">
                          <div 
                            className="flex items-center gap-2" 
                            style={{ paddingLeft: `${row.depth * 20}px` }}
                          >
                            {isDir ? (
                              <button 
                                className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-hover-bg text-text-muted hover:text-text-main bg-transparent border-none cursor-pointer shrink-0 transition-all"
                                onClick={() => toggleFolder(row.path)}
                                aria-label={t(isCollapsed ? 'tool-folder-analyzer.ui.expandFolder' : 'tool-folder-analyzer.ui.collapseFolder')}
                              >
                                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="3" fill="none" className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}>
                                  <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                              </button>
                            ) : (
                              <span className="w-6 shrink-0"></span>
                            )}
                            <span className="flex items-center justify-center shrink-0 w-[18px] h-[18px]">
                              {renderSvgIcon(row.name, row.type)}
                            </span>
                            <span 
                              className={`font-mono text-xs text-text-main user-select-none cursor-pointer ${isDir ? 'font-bold' : ''}`}
                              onClick={() => isDir && toggleFolder(row.path)}
                            >
                              {row.name}{isDir && '/'}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 px-5 text-xs text-text-muted font-medium">{getFileLabel(row.name, row.type)}</td>
                        <td className="p-2 px-5 text-xs font-mono">
                          {isDir ? (
                            <span className="bg-secondary/40 text-text-muted px-2 py-0.5 rounded-full font-sans font-semibold text-[10px]">
                              {t('tool-folder-analyzer.ui.totalCount', { count: row.lineCount.toLocaleString(i18n.language) })}
                            </span>
                          ) : (
                            row.isText ? (
                              <span className="bg-accent-light/10 text-accent px-2 py-0.5 rounded-full font-sans font-semibold text-[10px]">
                                {t('tool-folder-analyzer.ui.lineCount', { count: row.lineCount, formattedCount: row.lineCount.toLocaleString(i18n.language) })}
                              </span>
                            ) : (
                              <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider font-sans bg-secondary px-1.5 py-0.5 rounded">{t('tool-folder-analyzer.ui.binary')}</span>
                            )
                          )}
                        </td>
                        <td className="p-2 px-5 text-xs text-text-main font-mono">{formatSize(row.size)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}
    </Card>
  );
}
