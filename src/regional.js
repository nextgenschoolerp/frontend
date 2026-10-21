// Regional preferences (Settings → General → Regional preferences): time zone, currency, date format and language.
// Stored per school by authservice (GET / PUT /api/v1/tenants/{tenantId}/regional-settings); Layout loads them after
// sign-in and this browser keeps a copy (localStorage) as a cache and offline fallback. Every date, time, number and amount
// on the screens is formatted through these helpers, and the page re-renders when the preferences change (Layout keys the
// page on version()).
import { useSyncExternalStore } from 'react';

export const TIME_ZONES = [
  ['Asia/Kolkata', 'India'], ['Asia/Kathmandu', 'Nepal'], ['Asia/Dhaka', 'Bangladesh'], ['Asia/Colombo', 'Sri Lanka'],
  ['Asia/Dubai', 'United Arab Emirates'], ['Asia/Riyadh', 'Saudi Arabia'], ['Asia/Qatar', 'Qatar'], ['Asia/Singapore', 'Singapore'],
  ['Asia/Kuala_Lumpur', 'Malaysia'], ['Asia/Jakarta', 'Indonesia (West)'], ['Asia/Tokyo', 'Japan'], ['Australia/Sydney', 'Australia (Sydney)'],
  ['Pacific/Auckland', 'New Zealand'], ['Africa/Nairobi', 'Kenya'], ['Africa/Lagos', 'Nigeria'], ['Africa/Johannesburg', 'South Africa'],
  ['Europe/London', 'United Kingdom'], ['Europe/Paris', 'France / Central Europe'], ['America/New_York', 'US Eastern'],
  ['America/Chicago', 'US Central'], ['America/Los_Angeles', 'US Pacific'], ['America/Toronto', 'Canada (Toronto)'], ['UTC', 'Coordinated Universal Time'],
];
export const CURRENCIES = [
  ['INR', 'Indian rupee'], ['USD', 'US dollar'], ['GBP', 'British pound'], ['EUR', 'Euro'], ['AED', 'UAE dirham'], ['SAR', 'Saudi riyal'],
  ['QAR', 'Qatari riyal'], ['SGD', 'Singapore dollar'], ['MYR', 'Malaysian ringgit'], ['NPR', 'Nepalese rupee'], ['BDT', 'Bangladeshi taka'],
  ['LKR', 'Sri Lankan rupee'], ['AUD', 'Australian dollar'], ['NZD', 'New Zealand dollar'], ['CAD', 'Canadian dollar'], ['KES', 'Kenyan shilling'],
  ['NGN', 'Nigerian naira'], ['ZAR', 'South African rand'], ['JPY', 'Japanese yen'],
];
/** [pattern, example of 20 Oct 2026] */
export const DATE_FORMATS = [
  ['DD MMM YYYY', '20 Oct 2026'], ['D MMMM YYYY', '20 October 2026'], ['DD/MM/YYYY', '20/10/2026'], ['DD-MM-YYYY', '20-10-2026'],
  ['DD.MM.YYYY', '20.10.2026'], ['MM/DD/YYYY', '10/20/2026'], ['MMM D, YYYY', 'Oct 20, 2026'], ['YYYY-MM-DD', '2026-10-20'],
];
/** Locale of dates and numbers (month names, digit grouping). Screens stay in English. */
export const LANGUAGES = [
  ['en-IN', 'English (India)'], ['en-GB', 'English (United Kingdom)'], ['en-US', 'English (United States)'], ['en-AU', 'English (Australia)'],
  ['hi-IN', 'हिन्दी · Hindi'], ['mr-IN', 'मराठी · Marathi'], ['bn-IN', 'বাংলা · Bengali'], ['ta-IN', 'தமிழ் · Tamil'], ['te-IN', 'తెలుగు · Telugu'],
  ['gu-IN', 'ગુજરાતી · Gujarati'], ['kn-IN', 'ಕನ್ನಡ · Kannada'], ['ar-AE', 'العربية · Arabic'], ['fr-FR', 'Français · French'],
];
export const DEFAULT_REGIONAL = { timeZone: 'Asia/Kolkata', currency: 'INR', dateFormat: 'DD MMM YYYY', language: 'en-IN' };

const KEY = 'oakridge.regional';
const SESSION_KEY = 'oakridge.session';
const tenantKey = () => {
  try { const s = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)); return s?.tenantId ? `${KEY}.${s.tenantId}` : KEY; } catch { return KEY; }
};
const read = () => {
  try { return { ...DEFAULT_REGIONAL, ...(JSON.parse(localStorage.getItem(tenantKey())) || {}) }; } catch { return { ...DEFAULT_REGIONAL }; }
};
let current = read();
let currentKey = tenantKey();
const listeners = new Set();
/** The preferences in force (re-read when another school signs in on this browser). */
export function getRegional() {
  const k = tenantKey();
  if (k !== currentKey) { currentKey = k; current = read(); }
  return current;
}
export function setRegional(next) {
  current = { ...DEFAULT_REGIONAL, ...next };
  try { localStorage.setItem(tenantKey(), JSON.stringify(current)); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
}
/** Applies the preferences the server returned (unknown values fall back to the defaults) and caches them on this browser. */
export function applyServerRegional(data) {
  if (!data) return;
  const ok = (list, v) => list.some(([k]) => k === v);
  setRegional({
    timeZone: ok(TIME_ZONES, data.timeZone) ? data.timeZone : DEFAULT_REGIONAL.timeZone,
    currency: ok(CURRENCIES, data.currency) ? data.currency : DEFAULT_REGIONAL.currency,
    dateFormat: ok(DATE_FORMATS, data.dateFormat) ? data.dateFormat : DEFAULT_REGIONAL.dateFormat,
    language: ok(LANGUAGES, data.language) ? data.language : DEFAULT_REGIONAL.language,
  });
}
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
/** Re-renders on change. */
export const useRegional = () => useSyncExternalStore(subscribe, getRegional);
/** Changes whenever a preference does (used as a React key to re-render the page). */
export const version = (r = getRegional()) => `${r.timeZone}|${r.currency}|${r.dateFormat}|${r.language}`;

// ---------------------------------------------------------------------------------------------------- dates
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** Parts of a value in the school's time zone; a plain yyyy-mm-dd is a calendar date and is not shifted. */
function parts(value, extra = {}) {
  const r = getRegional();
  const s = typeof value === 'string' ? value : null;
  const dateOnly = s && DATE_ONLY.test(s);
  const d = dateOnly ? new Date(`${s}T12:00:00Z`) : value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat(r.language, {
    timeZone: dateOnly ? 'UTC' : r.timeZone, day: '2-digit', month: '2-digit', year: 'numeric', ...extra,
  });
  const out = {};
  for (const p of f.formatToParts(d)) if (p.type !== 'literal') out[p.type] = p.value;
  const named = (month) => new Intl.DateTimeFormat(r.language, { timeZone: dateOnly ? 'UTC' : r.timeZone, month }).format(d);
  return { ...out, MMM: named('short').replace('.', ''), MMMM: named('long'), d, dateOnly };
}

/**
 * A date in the school's format. opts: { year: false } leaves the year out, { weekday: 'short' | 'long' } puts the day
 * name in front. Accepts yyyy-mm-dd, ISO instants, epoch ms or Date; '—' for empty values.
 */
export function formatDate(value, opts = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const p = parts(value);
  if (!p) return String(value);
  const { year = true, weekday } = opts;
  const r = getRegional();
  const D = String(Number(p.day)), DD = p.day, MM = p.month, Y = p.year;
  const pick = {
    'DD MMM YYYY': [`${DD} ${p.MMM}`, ` ${Y}`], 'D MMMM YYYY': [`${D} ${p.MMMM}`, ` ${Y}`], 'DD/MM/YYYY': [`${DD}/${MM}`, `/${Y}`],
    'DD-MM-YYYY': [`${DD}-${MM}`, `-${Y}`], 'DD.MM.YYYY': [`${DD}.${MM}`, `.${Y}`], 'MM/DD/YYYY': [`${MM}/${DD}`, `/${Y}`],
    'MMM D, YYYY': [`${p.MMM} ${D}`, `, ${Y}`], 'YYYY-MM-DD': year ? [`${Y}-${MM}-${DD}`, ''] : [`${MM}-${DD}`, ''],
  }[r.dateFormat] || [`${DD} ${p.MMM}`, ` ${Y}`];
  const text = pick[0] + (year && r.dateFormat !== 'YYYY-MM-DD' ? pick[1] : '');
  if (!weekday) return text;
  const wd = new Intl.DateTimeFormat(r.language, { timeZone: p.dateOnly ? 'UTC' : r.timeZone, weekday }).format(p.d);
  return `${wd}, ${text}`;
}
/** 14:05 in the school's time zone (24-hour unless the language uses 12-hour, e.g. en-US). */
export function formatTime(value) {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const r = getRegional();
  return new Intl.DateTimeFormat(r.language, { timeZone: r.timeZone, hour: '2-digit', minute: '2-digit' }).format(d);
}
export const formatDateTime = (value, opts) => (value ? `${formatDate(value, opts)}, ${formatTime(value)}` : '—');
/** Today's date (yyyy-mm-dd) in the school's time zone. */
export function todayIso() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: getRegional().timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date());
}
/** A zone's name; the abbreviation is taken from the first English locale that has one (IST, BST, GST…), else GMT+5:30. */
export function zoneName(zone, style) {
  const names = ['en-GB', 'en-IN', 'en-US', 'en-AU', 'en-SG', 'en-AE'].map((loc) => {
    try { return new Intl.DateTimeFormat(loc, { timeZone: zone, timeZoneName: style }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value; } catch { return null; }
  }).filter(Boolean);
  return names.find((n) => !/^(GMT|UTC)[+-]/.test(n)) || names[0] || zone;
}
/** "India Standard Time" and "IST" (or "GMT+5:30" where no abbreviation exists) for the school's time zone today. */
export function timeZoneNames() {
  const r = getRegional();
  return { long: zoneName(r.timeZone, 'long'), short: zoneName(r.timeZone, 'short') };
}

// ---------------------------------------------------------------------------------------------------- numbers and money
export const formatNumber = (n, digits) => Number(n || 0).toLocaleString(getRegional().language, digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** ₹18,000 (whole amounts) or ₹18,000.50 in the school's currency (no conversion: amounts are shown as stored). */
export function formatMoney(n, { decimals } = {}) {
  if (n === null || n === undefined || n === '') return '—';
  const r = getRegional();
  const v = Number(n);
  const dp = decimals ?? (v % 1 ? 2 : 0);
  return new Intl.NumberFormat(r.language, { style: 'currency', currency: r.currency, minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v);
}
/** Headline amounts: ₹19.98 L / ₹3.10 Cr in rupees (Indian grouping), else compact (£1.2M, $846K). */
export function formatMoneyShort(n) {
  const r = getRegional();
  const v = Number(n || 0);
  if (['INR', 'NPR'].includes(r.currency)) {
    const sym = formatMoney(0).replace(/[\d.,\s]/g, '');
    if (v >= 1e7) return `${sym}${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `${sym}${(v / 1e5).toFixed(2)} L`;
    return formatMoney(v);
  }
  if (v < 1e6) return formatMoney(v);
  return new Intl.NumberFormat(r.language, { style: 'currency', currency: r.currency, notation: 'compact', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
