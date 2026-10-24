const KEY = 'oakridge.theme';

// Named after the iPhone 17 / 17 Pro finishes. `swatch` is the finish itself;
// the page accent is a deeper shade of it so white text stays readable.
export const THEMES = [
  { id: 'lavender', name: 'Lavender', swatch: '#cdbfe3' },
  { id: 'mist-blue', name: 'Mist Blue', swatch: '#a9bfd6' },
  { id: 'sage', name: 'Sage', swatch: '#b3c2a2' },
  { id: 'black', name: 'Black', swatch: '#1c1c1e' },
  { id: 'cosmic-orange', name: 'Cosmic Orange', swatch: '#f0782d' },
  { id: 'deep-blue', name: 'Deep Blue', swatch: '#2d3d5c' },
  { id: 'silver', name: 'Silver', swatch: '#d6d8dc' },
];

export function getTheme() {
  try {
    const id = localStorage.getItem(KEY);
    if (THEMES.some((t) => t.id === id)) return id;
  } catch { /* storage unavailable */ }
  return THEMES[0].id;
}

export function applyTheme(id) {
  document.documentElement.dataset.theme = id;
  try { localStorage.setItem(KEY, id); } catch { /* storage unavailable */ }
}

const DENSITY_KEY = 'oakridge.density';
export const DENSITIES = [
  { id: 'comfortable', name: 'Comfortable' },
  { id: 'compact', name: 'Compact' },
];

export function getDensity() {
  try {
    const id = localStorage.getItem(DENSITY_KEY);
    if (DENSITIES.some((d) => d.id === id)) return id;
  } catch { /* storage unavailable */ }
  return DENSITIES[0].id;
}

export function applyDensity(id) {
  document.documentElement.dataset.density = id;
  try { localStorage.setItem(DENSITY_KEY, id); } catch { /* storage unavailable */ }
}
