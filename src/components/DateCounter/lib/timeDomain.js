const SECONDS_PER_DAY = 24 * 60 * 60;
const MS_PER_DAY = SECONDS_PER_DAY * 1000;

/** Parses YYYY-MM-DD to a UTC timestamp; setUTCFullYear keeps years 0-99 literal. */
export function parseDateToUTC(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime();
}

export function calendarDaysBetween(startDate, endDate) {
  const startMs = parseDateToUTC(startDate);
  const endMs = parseDateToUTC(endDate);
  if (startMs === null || endMs === null) return null;
  return Math.round((endMs - startMs) / MS_PER_DAY);
}

export function parseTimeToSeconds(value) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  return hours * 3600 + minutes * 60 + seconds;
}

export function calculateTimeDifference(startTime, endTime, endNextDay = false) {
  const startSeconds = parseTimeToSeconds(startTime);
  const endSeconds = parseTimeToSeconds(endTime);
  if (startSeconds === null || endSeconds === null) return null;

  return endSeconds - startSeconds + (endNextDay ? SECONDS_PER_DAY : 0);
}

export function formatTimeDifference(totalSeconds, endNextDay = false) {
  const sign = totalSeconds < 0 ? '-' : '';
  let remaining = Math.abs(totalSeconds);
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const nextDayLabel = endNextDay ? ', next day' : '';

  return `${sign}${hours}h ${minutes}m ${seconds}s (end - start${nextDayLabel})`;
}
