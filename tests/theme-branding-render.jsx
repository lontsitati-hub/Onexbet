import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeBrandLogo } from '../src/components/ThemeBrandLogo';
import { THEME_BRANDING } from '../src/constants/themeBranding';

// Banc de contrôle web uniquement, pas un écran de l'application mobile.
const themes = ['blue', 'light_green', 'green', 'royal_blue', 'gold'];
const modes = ['light', 'dark', 'navy', 'midnight'];
const backgrounds = { light: '#ffffff', dark: '#2e3d52', navy: '#2e3d52', midnight: '#1c1c1c' };
function App() {
  const [theme, setTheme] = useState('blue');
  const [mode, setMode] = useState('light');
  return (
    <main style={{ fontFamily: 'Arial, sans-serif', padding: 28, color: '#20334a' }}>
      <h2 style={{ fontSize: 20 }}>Contrôle des logos du composant Populaire</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {themes.map(t => <button key={t} data-theme={t} onClick={() => setTheme(t)}>{THEME_BRANDING[t].name}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {modes.map(m => <button key={m} data-mode={m} onClick={() => setMode(m)}>{m}</button>)}
      </div>
      <div id="live-brand" style={{ background: backgrounds[mode], padding: 24, border: '1px solid #b9c3ce' }}>
        <ThemeBrandLogo theme={theme} backgroundMode={mode} />
      </div>
      <section style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '120px 240px 240px', gap: 12, alignItems: 'center' }}>
        <strong>Marque</strong><strong>Fond clair</strong><strong>Fond sombre</strong>
        {themes.map(t => <React.Fragment key={t}>
          <span>{THEME_BRANDING[t].name}</span>
          <div style={{ background: '#fff', border: '1px solid #c8d1db', padding: '26px 10px' }}>
            <div style={{ transform: 'scale(1.6)', transformOrigin: 'left center' }}><ThemeBrandLogo theme={t} backgroundMode="light" /></div>
          </div>
          <div style={{ background: '#2e3d52', padding: '26px 10px' }}>
            <div style={{ transform: 'scale(1.6)', transformOrigin: 'left center' }}><ThemeBrandLogo theme={t} backgroundMode="dark" /></div>
          </div>
        </React.Fragment>)}
      </section>
    </main>
  );
}
createRoot(document.getElementById('root')).render(<App />);
