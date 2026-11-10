import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import FieldInput from './ui/FieldInput';
import ToolHeader from './ui/ToolHeader';
import ToggleSwitch from './ui/ToggleSwitch';
import { calculateTimeDifference, calendarDaysBetween } from './DateCounter/lib/timeDomain';

export default function DateCounter() {
  const { t, i18n } = useTranslation('tools');
  const [mode, setMode] = useState('date');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [endNextDay, setEndNextDay] = useState(false);

  const calculateDateDiff = () => {
    const diffDays = calendarDaysBetween(startDate, endDate);

    if (diffDays === null) return t('tool-date.ui.selectDates');

    return t('tool-date.ui.dateDifference', {
      count: diffDays,
      formattedCount: diffDays.toLocaleString(i18n.language),
    });
  };

  const calculateTimeDiff = () => {
    const difference = calculateTimeDifference(startTime, endTime, endNextDay);
    if (difference === null) return t('tool-date.ui.selectTimes');
    const sign = difference < 0 ? '-' : '';
    let remaining = Math.abs(difference);
    const hours = Math.floor(remaining / 3600);
    remaining %= 3600;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return t('tool-date.ui.timeDifference', {
      sign, hours, minutes, seconds,
      nextDay: endNextDay ? t('tool-date.ui.nextDay') : '',
    });
  };

  return (
    <Card id="tool-date" variant="tool" size="compact">
      <ToolHeader title={t('tool-date.title')} />

      <div className="flex w-full rounded-md border border-border bg-app p-1" role="tablist" aria-label={t('tool-date.ui.modeAria')}>
        {[
          { id: 'date', label: t('tool-date.ui.dateCounter') },
          { id: 'time', label: t('tool-date.ui.timeCounter') },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={mode === option.id}
            onClick={() => setMode(option.id)}
            className={`flex-1 rounded px-3 py-2 text-sm font-semibold transition-colors ${
              mode === option.id
                ? 'bg-card text-accent shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === 'date' ? (
        <div role="tabpanel" className="flex w-full flex-col gap-4 sm:flex-row">
          <FieldInput
            id="date-start"
            label={t('tool-date.ui.startDate')}
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="flex-1"
          />
          <FieldInput
            id="date-end"
            label={t('tool-date.ui.endDate')}
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="flex-1"
          />
        </div>
      ) : (
        <div role="tabpanel" className="flex w-full flex-col gap-4">
          <div className="flex w-full flex-col gap-4 sm:flex-row">
            <FieldInput
              id="time-start"
              label={t('tool-date.ui.startTime')}
              type="time"
              step="1"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="flex-1"
            />
            <FieldInput
              id="time-end"
              label={t('tool-date.ui.endTime')}
              type="time"
              step="1"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="flex-1"
            />
          </div>
          <ToggleSwitch
            id="time-end-next-day"
            checked={endNextDay}
            onChange={(event) => setEndNextDay(event.target.checked)}
            label={t('tool-date.ui.endNextDay')}
          />
        </div>
      )}

      <div
        id={mode === 'date' ? 'date-output' : 'time-output'}
        role="status"
        aria-live="polite"
        className="flex min-h-[52px] items-center gap-2 rounded-[4px_12px_12px_4px] border-l-4 border-accent bg-accent-light px-5 py-4 text-[1.05rem] font-semibold text-text-main transition-all duration-300"
      >
        {mode === 'date' ? calculateDateDiff() : calculateTimeDiff()}
      </div>
    </Card>
  );
}
