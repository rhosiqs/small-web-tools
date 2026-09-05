import React from 'react';
import { useTranslation } from 'react-i18next';
import AutoDetectConverter from './ui/AutoDetectConverter';

function analyzePath(input, t) {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      sourceLabel: t('tool-slash.ui.pathStyle'),
      targetLabel: '',
      output: '',
      outputPlaceholder: t('tool-slash.ui.normalizedPlaceholder'),
      error: null,
    };
  }

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) {
    return {
      sourceLabel: t('tool-slash.ui.webUrl'),
      targetLabel: t('tool-slash.ui.webUrl'),
      output: input,
      outputPlaceholder: '',
      error: null,
    };
  }

  const backslashCount = (input.match(/\\/g) || []).length;
  const forwardSlashCount = (input.match(/\//g) || []).length;

  if (backslashCount > 0 && backslashCount >= forwardSlashCount) {
    return {
      sourceLabel: t('tool-slash.ui.backslashPath'),
      targetLabel: t('tool-slash.ui.forwardSlashPath'),
      output: input.replace(/\\/g, '/'),
      outputPlaceholder: '',
      error: null,
    };
  }

  if (forwardSlashCount > 0) {
    return {
      sourceLabel: t('tool-slash.ui.forwardSlashPath'),
      targetLabel: t('tool-slash.ui.backslashPath'),
      output: input.replace(/\//g, '\\'),
      outputPlaceholder: '',
      error: null,
    };
  }

  return {
    sourceLabel: t('tool-slash.ui.plainText'),
    targetLabel: t('tool-slash.ui.unchangedText'),
    output: input,
    outputPlaceholder: '',
    error: null,
  };
}

export default function SlashesConverter() {
  const { t } = useTranslation('tools');
  return (
    <AutoDetectConverter
      toolId="tool-slash"
      kicker={t('navigation:categories.developer')}
      title={t('tool-slash.title')}
      inputPlaceholder={t('tool-slash.ui.placeholder')}
      emptyTargetLabel={t('tool-slash.ui.convertedPath')}
      analyze={(input) => analyzePath(input, t)}
      showManualModes={false}
    />
  );
}
