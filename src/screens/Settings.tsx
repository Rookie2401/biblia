import { useState } from 'react';
import { BackLink, Topbar } from '../components/ui.tsx';
import { allDataUrls } from '../data/lexicon.ts';
import coverage from '../data/coverage.json';
import vulgateCoverage from '../data/vulgate-coverage.json';
import { db } from '../db/db.ts';
import { CANON, langOf } from '../text/canon.ts';
import { DEFAULTS, setSettings, useSettings } from '../state/settings.ts';

const GR_CURATED = 94;

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

  const dlDone = dl && dl.done === dl.total;
  return (
    <div>
      <Topbar title="Settings" left={<BackLink />} />
      <div className="page page--narrow route-fade">
        <h2 className="label" style={{ marginBottom: '0.8rem' }}>Reading</h2>
        <fieldset className="field">
          <legend>Theme</legend>
          <div className="segmented">
            {(['auto', 'light', 'dark'] as const).map((t) => <button type="button" key={t} aria-pressed={s.theme === t} onClick={() => setSettings({ theme: t })}>{t}</button>)}
          </div>
        </fieldset>
        <div className="field field--row"><label htmlFor="st-he-size">Hebrew size · {s.fontSize}px</label><input id="st-he-size" type="range" min={18} max={44} value={s.fontSize} aria-valuetext={`${s.fontSize} pixels`} onChange={(e) => setSettings({ fontSize: Number(e.target.value) })} /></div>
        <div className="field field--row"><label htmlFor="st-gr-size">Greek size · {s.greekFontSize}px</label><input id="st-gr-size" type="range" min={16} max={36} value={s.greekFontSize} aria-valuetext={`${s.greekFontSize} pixels`} onChange={(e) => setSettings({ greekFontSize: Number(e.target.value) })} /></div>
        <div className="field field--row"><label htmlFor="st-spacing">Line spacing · {s.lineHeight.toFixed(2)}</label><input id="st-spacing" type="range" min={1.4} max={2.6} step={0.05} value={s.lineHeight} aria-valuetext={`line height ${s.lineHeight.toFixed(2)}`} onChange={(e) => setSettings({ lineHeight: Number(e.target.value) })} /></div>
        <fieldset className="field">
          <legend>Hebrew text</legend>
          <div className="segmented">
            <button type="button" aria-pressed={s.hebrewDisplay === 'full'} onClick={() => setSettings({ hebrewDisplay: 'full' })}>with accents</button>
            <button type="button" aria-pressed={s.hebrewDisplay === 'niqqud'} onClick={() => setSettings({ hebrewDisplay: 'niqqud' })}>niqqud</button>
            <button type="button" aria-pressed={s.hebrewDisplay === 'consonants'} onClick={() => setSettings({ hebrewDisplay: 'consonants' })}>consonants</button>
          </div>
        </fieldset>
        <div className="field field--row"><label htmlFor="st-verses">Verse numbers</label><input id="st-verses" type="checkbox" checked={s.showVerseNumbers} onChange={(e) => setSettings({ showVerseNumbers: e.target.checked })} /></div>
        <div className="field field--row"><label htmlFor="st-marks">Underline words not yet known</label><input id="st-marks" type="checkbox" checked={s.showStatusMarks} onChange={(e) => setSettings({ showStatusMarks: e.target.checked })} /></div>
        <div className="field field--row"><label htmlFor="st-gloss">Gloss line under the tapped verse</label><input id="st-gloss" type="checkbox" checked={s.showGlossLine} onChange={(e) => setSettings({ showGlossLine: e.target.checked })} /></div>

        <h2 className="label" style={{ margin: '1.5rem 0 0.8rem' }}>Vocabulary</h2>
        <div className="field field--row"><label htmlFor="st-lookup">Tapping a word marks it <i>recognized</i></label><input id="st-lookup" type="checkbox" checked={s.lookupMarksRecognized} onChange={(e) => setSettings({ lookupMarksRecognized: e.target.checked })} /></div>
        <div className="field field--row"><label htmlFor="st-auto">Untapped words become <i>automatic</i> after this many chapters read past (0 = never)</label><input id="st-auto" type="number" min={0} max={20} value={s.autoKnownAfter} style={{ width: '4rem' }} onChange={(e) => setSettings({ autoKnownAfter: Math.max(0, Number(e.target.value) || 0) })} /></div>
        <div className="card__actions">
          <button type="button" className="btn btn--small" onClick={exportVocab}>Export vocabulary (JSON)</button>
          <button type="button" className="btn btn--small btn--quiet" onClick={() => { setSettings({ ...DEFAULTS, lastBook: s.lastBook }); setMsg('Settings reset.'); }}>Reset settings</button>
        </div>

        <h2 className="label" style={{ margin: '1.5rem 0 0.8rem' }}>Offline</h2>
        <p className="prose" style={{ fontSize: '0.95rem' }}>Every chapter and dictionary shard you open is kept on this device by the app. To have the whole Bible and both lexica available without a connection, fetch everything once (about 50 MB).</p>
        <div className="card__actions">
          <button type="button" className="btn btn--small" disabled={!!dl && !dlDone} onClick={downloadAll}>{dl && !dlDone ? 'Downloading…' : 'Download everything'}</button>
        </div>
        {dl && (
          <>
            <div className="progressbar" role="progressbar" aria-label="Download progress" aria-valuemin={0} aria-valuemax={dl.total} aria-valuenow={dl.done} aria-valuetext={`${dl.done} of ${dl.total} files`}><span style={{ width: `${(100 * dl.done) / dl.total}%` }} /></div>
            <div className="faint" style={{ fontSize: '0.85rem' }} aria-live="polite">{dlDone ? `Download finished: ${dl.total} files${dl.failed ? `, ${dl.failed} failed` : ''}.` : `${dl.done} / ${dl.total} files${dl.failed ? ` · ${dl.failed} failed` : ''}`}</div>
          </>
        )}
        {msg && <div className="note" role="status">{msg}</div>}

        <h2 className="label" style={{ margin: '1.5rem 0 0.8rem' }}>Sources & licences</h2>
        <div className="prose" style={{ fontSize: '0.92rem' }}>
          <p><b>Tanakh text</b> — <i>Miqra according to the Masorah</i> (MAM), a digital edition based on the Aleppo Codex and related manuscripts, via the Sefaria API. CC BY-SA 4.0. The text is shown exactly as the edition prints it: nothing is corrected, normalised or respelled; ketiv/qere are shown with the qere read.</p>
          <p><b>Hebrew morphology</b> — Open Scriptures Hebrew Bible (OSHB), CC BY 4.0, aligned word by word to MAM at build time: {coverage.hebrewCoveragePercent}% of the {coverage.hebrewWords.toLocaleString()} words carry an analysis ({coverage.hebrewUnmatched} unmatched, shown without a card).</p>
          <p><b>Contextual renderings</b> — the <i>Berean Standard Bible</i> interlinear tables (Bible Hub / Berean Bible Translation Committee, dedicated to the public domain 30 April 2023; <a href="https://berean.bible/downloads.htm" target="_blank" rel="noreferrer">berean.bible/downloads.htm</a>), one English rendering per word in its verse, aligned to the MAM and SBLGNT texts at build time. This is the only English layer that translates the verse; every other gloss is a lemma meaning. The BSB translates the WLC and the NA/SBL Greek, so a few words in our base texts carry no rendering.</p>
          <p><b>Hebrew lexicon</b> — Brown, Driver & Briggs (1906, public domain), the complete text via Sefaria; the Open Scriptures Lexical Index and BDB outline (CC BY 4.0) and Strong's Hebrew Dictionary (public domain; JSON CC BY-SA). The short lemma gloss on each card names its source: <i>Biblia</i> (a curated modern gloss, mostly for function words and names), <i>BDB</i> (the outline's definitions), <i>Open Scriptures index</i>, <i>Strong's</i> (first clause) or, last of all, a <i>KJV rendering</i>. KJV renderings are shown separately as historical renderings, never as the meaning.</p>
          <p><b>Greek text</b> — <i>The Greek New Testament: SBL Edition</i>, ed. Michael W. Holmes (SBL / Logos, 2010), CC BY 4.0.</p>
          <p><b>Greek morphology</b> — MorphGNT, SBLGNT edition, CC BY-SA 3.0.</p>
          <p><b>Greek lexicon</b> — G. Abbott-Smith, <i>A Manual Greek Lexicon of the New Testament</i> (1922, public domain; TEI transcription by translatable-exegetical-tools, CC BY-SA 4.0), the Dodson Greek Lexicon (public domain) and Strong's Greek Dictionary (public domain). Short glosses come from Dodson, else Abbott-Smith, else Strong's; the {GR_CURATED} MorphGNT lemmas none of them cover (spelling variants, contracted forms, names) carry a curated gloss marked <i>Biblia</i> and are linked to the nearest lexicon entry.</p>
          <p><b>Septuagint text &amp; morphology</b> — <a href="https://github.com/OpenScriptorium/lxx-morph" target="_blank" rel="noreferrer">lxx-morph</a> (Rahlfs, 1935 edition; morphological analysis via the Perseus Morpheus analyser with reviewed disambiguation), CC BY 4.0. Septuagint words are matched to the New Testament's own Greek lexicon at build time wherever they are the same lemma, so their vocabulary status and lookup count are shared; a lemma found only in the Septuagint is glossed from STEPBible's TFLSJ (the Translators Formatted LSJ), CC BY 4.0.</p>
          <p><b>Vulgate text</b> — the Clementine Vulgate (1592), via the Perseus Digital Library / <i>seven1m/open-bibles</i>, public domain.</p>
          <p><b>Vulgate morphology</b> — the <a href="https://syntacticus.org" target="_blank" rel="noreferrer">PROIEL / Syntacticus</a> treebank of the Vulgate New Testament, CC BY-NC-SA 4.0. Its own tokens carry no punctuation, so each of its words is matched by position to the Clementine text above; a word that cannot be confidently matched is shown but not tappable. Coverage is uneven and worth stating plainly: {vulgateCoverage.coveragePercent}% of the text overall, close to complete in the Gospels, Acts, Romans, 1–2 Corinthians, Philippians, 1–2 Thessalonians and Revelation, and only fragmentary in Colossians, the Pastoral Epistles, Hebrews, James, 1–2 Peter, 1–3 John and Jude — that treebank is itself still a work in progress, not something this app has trimmed down.</p>
          <p><b>Latin lexicon</b> — Lewis &amp; Short, <i>A Latin Dictionary</i> (1879, public domain; TEI transcription by the Perseus Digital Library), CC BY-SA 4.0.</p>
          <p><b>Type</b> — Frank Ruhl Libre and EB Garamond (SIL Open Font License).</p>
          <p>The grammatical explanations under <i>More</i> are the app's own summaries of standard grammar (Gesenius–Kautzsch, Joüon–Muraoka; Smyth, Wallace) and are not part of any source.</p>
        </div>
      </div>
    </div>
  );
}
