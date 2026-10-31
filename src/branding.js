// The school's name, crest and public contact details, kept in this browser after a sign-in so the sign-in page (shown before anyone is
// authenticated) can show the school the browser last used. Only the public name and crest are stored, never account data;
// storage can be blocked, so every access is guarded and the page falls back to the product name.
const KEY = 'oakridge.schoolBrand';

export function loadBranding() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function saveBranding(brand) {
  try { localStorage.setItem(KEY, JSON.stringify(brand)); } catch { /* private window, blocked or full storage */ }
}

/** What the sign-in art panel shows: the last school's name and crest, else "School ERP". */
export function currentBrand() {
  const saved = loadBranding();
  const name = saved?.name || 'School ERP';
  return { name, tag: 'WORKSPACE', foot: `© ${new Date().getFullYear()} ${name}`, crest: saved?.crest || null, email: saved?.email || '', phone: saved?.phone || '' };
}
