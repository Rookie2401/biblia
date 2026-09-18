import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useSettings } from './state/settings.ts';
import Home from './screens/Home.tsx';
import Reader from './screens/Reader.tsx';
import Search from './screens/Search.tsx';
import Settings from './screens/Settings.tsx';
import Vocab from './screens/Vocab.tsx';
import Word from './screens/Word.tsx';

export default function App() {
  const s = useSettings();
  const loc = useLocation();
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--reading-font-size', `${s.fontSize}px`);
    root.style.setProperty('--greek-font-size', `${s.greekFontSize}px`);
    root.style.setProperty('--reading-line-height', String(s.lineHeight));
    root.style.setProperty('--heb', s.hebrewFont === 'david' ? 'var(--heb-david)' : s.hebrewFont === 'system' ? 'var(--heb-system)' : 'var(--heb-frank)');
  }, [s.fontSize, s.greekFontSize, s.lineHeight, s.hebrewFont]);
  useEffect(() => {
    if (!loc.pathname.startsWith('/read')) window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className="shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/read/:book/:ch" element={<Reader />} />
        <Route path="/read/:book" element={<Reader />} />
        <Route path="/word/:lang/:id" element={<Word />} />
        <Route path="/search" element={<Search />} />
        <Route path="/vocab" element={<Vocab />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}
