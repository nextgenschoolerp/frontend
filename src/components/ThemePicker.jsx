import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { THEMES, getTheme, applyTheme } from '../theme.js';

export default function ThemePicker() {
  const [theme, setTheme] = useState(getTheme);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = THEMES.find((t) => t.id === theme);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  function pick(id) {
    applyTheme(id);
    setTheme(id);
  }

  return (
    <div className="themepick" ref={ref}>
      <button className="themebtn" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}
        title={`Theme: ${current.name}`} aria-label={`Change theme (current: ${current.name})`}>
        <i style={{ background: current.swatch }} />
      </button>
      {open && (
        <div className="thememenu" role="menu">
          <h6>Theme</h6>
          {THEMES.map((t) => (
            <button key={t.id} role="menuitemradio" aria-checked={t.id === theme}
              className={'themeopt' + (t.id === theme ? ' on' : '')} onClick={() => pick(t.id)}>
              <i style={{ background: t.swatch }} />
              <span>{t.name}</span>
              {t.id === theme && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
