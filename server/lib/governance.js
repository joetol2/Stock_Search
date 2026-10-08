// Reads the usage and rights notes that Q-S keeps in DAM asset descriptions.
//
// DAM descriptions are HTML written by people, so they vary a lot. Three kinds of
// text show up and each is handled here:
//   - a real description ("Woman Paddleboarding Alone on Calm Ocean Water")
//   - usage history ("Associated Jobs:", "Additional Projects Used For:", "Used For:",
//     or bare job codes like "ACME22_101735_MKTG_...")
//   - market freezes wrapped in ** ** ("**INDUSTRY MARKET FREEZE THRU 12.31.2025**")
//
// This is the same logic as the Copilot Studio card formula (v11), ported to JS.

const USAGE_PREFIXES = [
  'Associated Jobs:',
  'Associated Job:',
  'Additional Projects Used For:',
  'Used For:',
];

/** Turns description HTML into plain text, keeping the ** freeze markers. */
export function htmlToText(html) {
  if (!html) return '';
  const text = String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  return collapse(text);
}

function collapse(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function startsWithI(s, prefix) {
  return s.toLowerCase().startsWith(prefix.toLowerCase());
}

// Job codes look like ACME22_101735_... or BRND24_103717_...: 4 letters, 2 digits, underscore.
const JOB_CODE = /^[A-Za-z]{4}\d{2}_/;

/**
 * Reads a freeze date like "THRU 12.31.2025" or "through 3/1/26".
 * Returns an ISO date (YYYY-MM-DD) or null.
 */
export function parseFreezeDate(freezeText) {
  const m = /(?:THRU|THROUGH|UNTIL|TIL)\s+(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/i.exec(freezeText || '');
  if (!m) return null;
  let [, month, day, year] = m;
  if (year.length === 2) year = `20${year}`;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/**
 * Splits a DAM description into a display description, a market freeze and
 * associated jobs.
 *
 * @param {string|null} descriptionHtml
 * @param {Date} [today]
 * @returns {{
 *   description: string,
 *   freeze: null | { text: string, until: string|null, expired: boolean },
 *   associatedJobs: string[],
 * }}
 */
export function readDescription(descriptionHtml, today = new Date()) {
  const plain = htmlToText(descriptionHtml);
  const segments = plain.split('**');
  const freezeText = collapse(segments.find((s) => s.toUpperCase().includes('FREEZE')) || '');
  const body = collapse(segments.filter((s) => !s.toUpperCase().includes('FREEZE')).join(' '));

  const isUsage =
    Boolean(freezeText) ||
    USAGE_PREFIXES.some((p) => startsWithI(body, p)) ||
    startsWithI(body, 'Associated Job') ||
    startsWithI(body, 'Additional Projects') ||
    JOB_CODE.test(body);

  let freeze = null;
  if (freezeText) {
    const until = parseFreezeDate(freezeText);
    const todayIso = today.toISOString().slice(0, 10);
    freeze = { text: freezeText, until, expired: Boolean(until && until < todayIso) };
  }

  if (!isUsage) {
    return { description: plain, freeze, associatedJobs: [] };
  }

  let jobsText = body;
  const prefix = USAGE_PREFIXES.find((p) => startsWithI(body, p));
  if (prefix) jobsText = body.slice(prefix.length);
  jobsText = collapse(jobsText);

  return { description: '', freeze, associatedJobs: splitJobs(jobsText) };
}

/** Splits "ACME24_1 Foo ACME24_2 Bar" into ["ACME24_1 Foo", "ACME24_2 Bar"]. */
export function splitJobs(text) {
  if (!text) return [];
  const starts = [];
  const re = /(?:^|\s)([A-Za-z]{4}\d{2}_)/g;
  let m;
  while ((m = re.exec(text))) starts.push(m.index + m[0].indexOf(m[1]));
  if (starts.length === 0) return [text];
  const jobs = [];
  if (starts[0] > 0) jobs.push(collapse(text.slice(0, starts[0])));
  starts.forEach((start, i) => jobs.push(collapse(text.slice(start, starts[i + 1]))));
  return jobs.filter(Boolean);
}

/** Short warnings a person should see before using an asset. */
export function warningsFor({ approved, freeze }) {
  const warnings = [];
  if (freeze && !freeze.expired) warnings.push(`⚠ ${freeze.text}`);
  if (freeze && freeze.expired) warnings.push(`Freeze ended ${freeze.until} (${freeze.text})`);
  if (approved === false) warnings.push('Not approved for use');
  return warnings;
}
