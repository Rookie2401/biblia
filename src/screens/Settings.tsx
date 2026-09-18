import { useState } from 'react';
import { BackLink, Topbar } from '../components/ui.tsx';
import { allDataUrls } from '../data/lexicon.ts';
import { db } from '../db/db.ts';
import { CANON, langOf } from '../text/canon.ts';
import { DEFAULTS, setSettings, useSettings } from '../state/settings.ts';

export default function Settings() {
  const s = useSettings();
  const [dl, setDl] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function downloadAll() {
    const urls = await allDataUrls(CANON.map((b) => b.id), langOf);
    const st = { done: 0, total: urls.length, failed: 0 };
    setDl({ ...st });
    const queue = [...urls];
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (queue.length) {
          const u = queue.shift()!;
          try {
            const r = await fetch(u);
            if (!r.ok) st.failed++;
          } catch {
            st.failed++;
          }
          st.done++;
          setDl({ ...st });
        }
      }),
    );
  }

  async function exportVocab() {
    const lexemes = await db.lexemes.toArray();
    const lookups = await db.lookups.toArray();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), lexemes, lookups }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `biblia-vocabulary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  return (
    <div>
      <Topbar title="Settings" left={<BackLink />} />
      <div className="page page--narrow route-fade">
        <h2 className="label" style={{ marginBottom: '0.8rem' }}>Reading</h2>
        <div className="field field--row"><label>Theme</label>
          <div className="segmented">
            {(['auto', 'light', 'dark'] as const).map((t) => <button key={t} aria-pressed={s.theme === t} onClick={() => setSettings({ theme: t })}>{t}</button>)}
          </div>
        </div>
        <div className="field field--row"><label>Hebrew size · {s.fontSize}px</label><input type="range" min={18} max={44} value={s.fontSize} onChange={(e) => setSettings({ fontSize: Number(e.target.value) })} /></div>
        <div className="field field--row"><label>Greek size · {s.greekFontSize}px</label><input type="range" min={16} max={36} value={s.greekFontSize} onChange={(e) => setSettings({ greekFontSize: Number(e.target.value) })} /></div>
        <div className="field field--row"><label>Line spacing · {s.lineHeight.toFixed(2)}</label><input type="range" min={1.4} max={2.6} step={0.05} value={s.lineHeight} onChange={(e) => setSettings({ lineHeight: Number(e.target.value) })} /></div>
        <div className="field field--row"><label>Hebrew text</label>
          <div className="segmented">
            <button aria-pressed={s.hebrewDisplay === 'full'} onClick={() => setSettings({ hebrewDisplay: 'full' })}>with accents</button>
            <button aria-pressed={s.hebrewDisplay === 'niqqud'} onClick={() => setSettings({ hebrewDisplay: 'niqqud' })}>niqqud</button>
            <button aria-pressed={s.hebrewDisplay === 'consonants'} onClick={() => setSettings({ hebrewDisplay: 'consonants' })}>consonants</button>
          </div>
        </div>
        <div className="field field--row"><label>Verse numbers</label><input type="checkbox" checked={s.showVerseNumbers} onChange={(e) => setSettings({ showVerseNumbers: e.target.checked })} /></div>
        <div className="field field--row"><label>Underline words not yet known</label><input type="checkbox" checked={s.showStatusMarks} onChange={(e) => setSettings({ showStatusMarks: e.target.checked })} /></div>
        <div className="field field--row"><label>Gloss line under the tapped verse</label><input type="checkbox" checked={s.showGlossLine} onChange={(e) => setSettings({ showGlossLine: e.target.checked })} /></div>

        <h2 className="label" style={{ margin: '1.5rem 0 0.8rem' }}>Vocabulary</h2>
        <div className="field field--row"><label>Tapping a word marks it <i>recognized</i></label><input type="checkbox" checked={s.lookupMarksRecognized} onChange={(e) => setSettings({ lookupMarksRecognized: e.target.checked })} /></div>
        <div className="field field--row"><label>Untapped words become <i>automatic</i> after this many chapters read past (0 = never)</label><input type="number" min={0} max={20} value={s.autoKnownAfter} style={{ width: '4rem' }} onChange={(e) => setSettings({ autoKnownAfter: Math.max(0, Number(e.target.value) || 0) })} /></div>
        <div className="card__actions">
          <button className="btn btn--small" onClick={exportVocab}>Export vocabulary (JSON)</button>
          <button className="btn btn--small btn--quiet" onClick={() => { setSettings({ ...DEFAULTS, lastBook: s.lastBook }); setMsg('Settings reset.'); }}>Reset settings</button>
        </div>

        <h2 className="label" style={{ margin: '1.5rem 0 0.8rem' }}>Offline</h2>
        <p className="prose" style={{ fontSize: '0.95rem' }}>Every chapter and dictionary shard you open is kept on this device by the app. To have the whole Bible and both lexica available without a connection, fetch everything once (about 40 MB).</p>
        <div className="card__actions">
          <button className="btn btn--small" disabled={!!dl && dl.done < dl.total} onClick={downloadAll}>{dl && dl.done < dl.total ? 'Downloading…' : 'Download everything'}</button>
        </div>
        {dl && (
          <>
            <div className="progressbar"><span style={{ width: `${(100 * dl.done) / dl.total}%` }} /></div>
            <div className="faint" style={{ fontSize: '0.85rem' }}>{dl.done} / {dl.total} files{dl.failed ? ` · ${dl.failed} failed` : ''}{dl.done === dl.total ? ' · done' : ''}</div>
          </>
        )}
        {msg && <div className="note">{msg}</div>}

        <h2 className="label" style={{ margin: '1.5rem 0 0.8rem' }}>Sources & licences</h2>
        <div className="prose" style={{ fontSize: '0.92rem' }}>
          <p><b>Tanakh text</b> — <i>Miqra according to the Masorah</i> (MAM), a digital edition based on the Aleppo Codex and related manuscripts, via the Sefaria API. CC BY-SA 4.0. The text is shown exactly as the edition prints it: nothing is corrected, normalised or respelled; ketiv/qere are shown with the qere read.</p>
          <p><b>Hebrew morphology</b> — Open Scriptures Hebrew Bible (OSHB), CC BY 4.0, aligned word by word to MAM at build time (99.6% of words).</p>
          <p><b>Hebrew lexicon</b> — Brown, Driver & Briggs (1906, public domain; XML by Open Scriptures, CC BY 4.0), the Open Scriptures Lexical Index (CC BY 4.0) and Strong's Hebrew Dictionary (public domain; JSON CC BY-SA).</p>
          <p><b>Greek text</b> — <i>The Greek New Testament: SBL Edition</i>, ed. Michael W. Holmes (SBL / Logos, 2010), CC BY 4.0.</p>
          <p><b>Greek morphology</b> — MorphGNT, SBLGNT edition, CC BY-SA 3.0.</p>
          <p><b>Greek lexicon</b> — G. Abbott-Smith, <i>A Manual Greek Lexicon of the New Testament</i> (1922, public domain; TEI transcription by translatable-exegetical-tools, CC BY-SA 4.0), the Dodson Greek Lexicon (public domain) and Strong's Greek Dictionary (public domain).</p>
          <p><b>Type</b> — Frank Ruhl Libre and EB Garamond (SIL Open Font License).</p>
          <p>The grammatical explanations under <i>More</i> are the app's own summaries of standard grammar (Gesenius–Kautzsch, Joüon–Muraoka; Smyth, Wallace) and are not part of any source.</p>
        </div>
      </div>
    </div>
  );
}
