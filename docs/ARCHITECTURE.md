# Biblia — architecture notes

## Principles (inherited from Sefer and the Psalter)

1. **The text is immutable data.** `public/data/he/<Book>.json` holds every verse exactly as
   MAM prints it (`t`), with the edition's flags (`kq`, `pe`, `s`, `nun`, `note`, `absent`).
   `public/data/gr/<Book>.json` holds MorphGNT's printed tokens. The reader renders from these
   strings token by token; nothing is respelled or normalised for display — display modes
   (niqqud only, consonants) are derived views.
2. **Annotations point at the text by reference.** A word is `book · chapter · verse · index`
   (maqaf-split content-word index for Hebrew, token index for Greek). Morphology travels with
   the verse (`w`); the reader's own data (statuses, lookups, positions) lives in IndexedDB.
3. **Hebrew and Greek stay primary; English is scaffolding.** Glosses and grammar appear in
   the card, never as a running translation.
4. **Progressive disclosure.** Level 1 answers just enough to keep reading; level 2 says what
   the letters encode; level 3 gives the complete entry and the word's place in the corpus.
5. **Every fact has a provenance line** (OSHB · Strong's · BDB / MorphGNT · Strong's ·
   Abbott-Smith). The grammatical explanations are the app's own, marked as such in Settings.

## Data build (`scripts/`)

| Script | Input | Output |
|---|---|---|
| `fetch-sources.mjs` | Sefaria API, GitHub raw | `data/mam-raw`, `data/oshb`, `data/gnt`, `data/lexicon` |
| `fetch-bdb.mjs`, `fetch-bdb2.mjs` | Sefaria lexicon API (`/api/words/<form>`): the headword chain (`prev_hw`/`next_hw`) stops at roots and names because only entries with registered word forms resolve, so the second pass queries every Strong's lemma (consonantal, then pointed) | `data/bdb-sefaria/<rid>.json` |
| `build-tanakh.mjs` | MAM + OSHB | `public/data/he/*.json`, `data/build/conc-he.json` |
| `build-gnt.mjs` | MorphGNT | `public/data/gr/*.json`, `data/build/conc-gr.json` |
| `build-lexicon-gr.mjs` | Abbott-Smith TEI, Dodson, Strong's | `lex/gr-*.json`, `gr-index.json`, `gr-manifest.json`, `conc/gr-*`, `data/build/lxx-by-strong.json` |
| `build-lexicon-he.mjs` | Sefaria BDB (full), Open Scriptures BDB + LexicalIndex, Strong's | `lex/he-*.json`, `he-index.json`, `conc/he-*` |
| `build-canon.mjs` | the built books | `src/data/canon.json` |
| `build-bsb.mjs` | `data/bsb/bsb_tables.xlsx` (Berean interlinear, public domain) | `public/data/ctx/{he,gr}/*.json` — per-verse arrays of the BSB rendering of each word (chapter-level LCS alignment; `''` = rendered with a neighbour, `null` = unaligned) |

**MAM parsing** (`parseVerse`): resolves `mam-kq` (ketiv in parentheses, qere in brackets → the
qere is read, both kept), qere-only and ketiv-only spans, `mam-kq-trivial`, implicit maqaf,
`{פ}`/`{ס}`/inverted nun as flags, footnote markers + `<i class="footnote">` as a note,
`<b>׀</b>`/`<small>׀</small>` as a standalone paseq token, size tags dropped with the text
kept, `<br>` and `&nbsp;`/`&thinsp;` as spaces. Anything else throws, so a new construct can
never be silently dropped. The dash MAM prints for Josh 21:36–37 becomes `absent`.

**Alignment** OSHB → MAM: per verse, exact consonantal match else LCS; when the two editions
divide a chapter differently (Exod 20, Num 25, Deut 5) the whole chapter is aligned at once.
A spelling fallback (`align-fallback.mjs`) then matches a single unmatched word between two
matched neighbours when the skeletons are within an edit distance of a third. Result
(`scripts/coverage.mjs`, computed from the shipped files into `src/data/coverage.json`, which
Settings displays): 305,309 of 305,452 maqaf-split content words carry an analysis = 99.95%;
143 words (0.05%) are shown in the reader as plain text without a card. Before the fallback
the figure was 99.63%.

**Glosses (content audit, 2026-09-18).** `build-lexicon-he.mjs`: the LexicalIndex is a multimap (multi-word names share their component's Strong's number; `pickIndex` chooses the exact augmented id, then the headword matching Strong's); part of speech is the dominant OSHB code from `data/build/pos-he.json`; the short gloss comes, in order, from `data/curated/he-glosses.json`, the BDB outline's `<def>`s, the index definition (only when it is a real definition), the first clause of Strong's, or a ≤3-word KJV rendering, each filtered for archaic phrasing and cross references; the source is recorded as `gs`. `build-lexicon-gr.mjs`: `data/curated/gr-glosses.json` supplies glosses and `_alias` links for the lemmas the lexica do not cover; more spelling-variant candidates (deponents, contracted adjectives, ἕνεκεν/ἕνεκα …); lemmas without a Strong's transliteration are transliterated (`translit`); Dodson's "descendent" is corrected. The UI shows the BSB rendering first (`WordCard`, `VerseCard`, the reader gloss line), then the lemma gloss with its source and the note "not a contextual translation"; KJV renderings are labelled historical.

**Lexicon keys.** Hebrew: OSHB lemma id = Strong's number + Open Scriptures' augment letter
("1254 a" shape/create vs "1254 b" be fat); prefixes (`c/b/…`) and the `+` of multi-word names
are stripped. Greek: MorphGNT lemma; Abbott-Smith matched by lemma, then accent-free form, then
the deponent's active form, then Strong's number (98.6% matched).

**Shards.** Hebrew by `floor(number / 300)`; Greek by first letter, split by second letter for
α ε κ π σ (`gr-manifest.json`). Concordance shards mirror the lexicon shards and hold flat
`[bookIndex, ch, v, i, …]` arrays.

## Runtime

- `data/books.ts` — lazy per-book fetch, six books in memory; the service worker keeps every
  `data/*.json` it has seen (CacheFirst). Settings → "Download everything" fetches all files.
- `state/wordinfo.ts` — `wordAt(book, ref)` → `WordInfo` (token, decoded morph, segments,
  encoding lines, lexeme key); `loadEntry` fetches the shard; the lexicon index gives short
  glosses for whole verses without touching shards.
- `morph/hebrew.ts` — OSHB code decoder; `segments()` cuts the printed word at OSHB's
  boundaries by counting base letters (`splitByLetters`), so chips are always the edition's
  own spelling; `encodingLines()` produces Prefixes / Stem / Ending with the binyan, tense and
  state explanations. `Rd` (preposition with the article swallowed) is explained as such.
- `morph/greek.ts` — MorphGNT pos + 8-column parse decoder; chips for the parse; category
  notes (tense/voice/mood/case).
- `state/vocab.ts` — Sefer's LingQ-style flow: tapping marks *recognized*; `recordEncounters`
  runs once per chapter visit when the chapter end scrolls into view and promotes untapped
  *new* words to *automatic* after `autoKnownAfter` chapters; "Mark the rest of this chapter
  as known" at the chapter end.
- Deep links: `#/read/<Book>/<ch>?v=<verse>&i=<word>` (used by the concordance and dictionary
  references, BDB `data-ref="Gen.1.1"`, Abbott-Smith `osisRef`).

## Accessibility and safety (audit corrections, 2026-09-18)

- **Reader controls.** Words with a card and verse numbers are native `<button>`s with reset
  styling (`button.w`, `button.vn`), `aria-pressed` for the selection and an accessible label
  on verse numbers ("Open Genesis 1:1 verse view"). The prose container handles click and
  Enter/Space centrally (`activate()` in `Reader.tsx`), so native activation and browsers
  that deliver only a keydown behave alike without double-firing. Words with no aligned
  morphology stay plain spans.
- **Modal sheets.** `components/dialog.ts` (`useModalDialog`) moves focus into the dialog,
  cycles Tab inside it, closes on Escape, marks the page inert and returns focus to the
  activating control. The word/verse panel is a modal dialog only below 980px
  (`useMediaQuery`); on wide screens it stays a non-modal `complementary` side panel.
- **Routes.** `Reader` validates book/chapter (`validRef`) before rendering or recording
  anything and shows a not-found page otherwise; `?v=`/`?i=` are validated against the
  loaded chapter (a notice, never an empty panel). `adjacentChapter` returns null for an
  invalid chapter. `Word` validates `:lang` and the lexicon id.
- **Search.** `state/search.ts` is a pure function over explicit `SearchRow` objects; the
  URL `?q=` is the source of truth. BDB cross references resolve through
  `lex/he-bdb-index.json` (BDB entry id → lemma ids) inside `DictEntry`.
- **Vocabulary writes** run in Dexie read-write transactions (see `state/vocab.ts`); `done`
  is monotonic and listeners are notified after commit.
- **Dictionary HTML** is sanitized at build time (`scripts/sanitize-html.mjs`), asserted
  before shards are written, and checked again by `text/safeHtml.ts` before injection.
- **Contrast / targets / layout.** `--ink-faint` is 5.1:1 (light) and 5.6:1 (dark) on paper;
  phone-width controls are 44px; the home list is a two-row grid below 420px.

## IndexedDB

| Table | Key | Notes |
|---|---|---|
| lexemes | key `he:<id>` / `gr:<lemma>` | status, lookups, encounters, forms, chapters, firstLookup |
| lookups | ++id | one row per tap |
| positions | book | last chapter/verse seen (IntersectionObserver over verses) |
| progress | `Book:ch` | visits, done |
| notes | key | reserved for user notes |
