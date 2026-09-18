# Biblia (V0)

The Masoretic Text and the Greek New Testament in one offline reader, with a Sefer-style
linguistic apparatus under every word: tap a word for its reading, meaning, lemma, root and
parsing; *More* shows how the letters encode the form; *Deeper* opens the complete dictionary
entry (Brown–Driver–Briggs / Abbott-Smith), Strong's, the root family, Septuagint links
across the two testaments, the concordance and your own history with the word.

Built 2026-09-18 from the systems of the Psalter (MAM text pipeline, OSHB alignment),
Sefer (the three-level word card, LingQ-style statuses, visual language) and the Classical
Library (offline PWA, paper-and-Garamond chrome).

## Texts and data (all open)

| | Source | Licence |
|---|---|---|
| Tanakh text | Miqra according to the Masorah (Sefaria API) | CC BY-SA 4.0 |
| Hebrew morphology | Open Scriptures Hebrew Bible (OSHB), aligned to MAM at build time | CC BY 4.0 |
| Hebrew lexicon | BDB (1906) via Sefaria's lexicon API; Open Scriptures BDB skeleton + Lexical Index; Strong's | public domain / CC BY |
| Greek text | SBL Greek New Testament (Holmes, 2010) | CC BY 4.0 |
| Greek morphology | MorphGNT, SBLGNT edition | CC BY-SA 3.0 |
| Greek lexicon | Abbott-Smith (1922, TEI), Dodson, Strong's | public domain |

The text is never edited: MAM's reader markup is resolved (ketiv/qere read as qere, paragraph
marks kept as flags, editorial footnotes kept as notes) and everything else is shown as the
edition prints it. Alignment of OSHB to MAM is by consonantal comparison with a spelling
fallback for single-word gaps: 305,309 of the 305,452 maqaf-split content words carry an
OSHB analysis (99.95%; 143 unmatched). The figure is computed from the shipped files by
`scripts/coverage.mjs` into `src/data/coverage.json`, which Settings displays. The full BDB
text is present for 99.8% of Hebrew word occurrences (9,041 of 9,200 lemma ids); the rest fall
back to the Open Scriptures BDB outline plus Strong's.

Dictionary HTML is sanitized at build time (`scripts/sanitize-html.mjs`: element and attribute
allowlists, dangerous elements removed with their content, nesting rebalanced, every shipped
entry re-asserted) and validated again before rendering (`src/text/safeHtml.ts`).

## Commands

```bash
npm run fetch:sources   # download every source into data/ (idempotent)
node scripts/fetch-bdb.mjs    # full BDB from Sefaria: walk the headword chain into data/bdb-sefaria (resumable)
node scripts/fetch-bdb2.mjs   # full BDB from Sefaria: sweep by Strong's lemma forms (what the lookup indexes; ~40 min)
npm run build:data      # public/data/{he,gr,lex,conc} + src/data/canon.json
npm run dev             # Vite dev server
npm test                # vitest
npm run build           # tsc + vite build → dist/ (≈40 MB with the data)
```

Dev server from the Desktop launch config: `biblia-dev` (port 5182); built preview `biblia-preview` (4182).

## Layout

- `scripts/` — data build (see `docs/ARCHITECTURE.md`)
- `public/data/` — generated: `he/<Book>.json`, `gr/<Book>.json`, `lex/he-*.json`, `lex/gr-*.json`, `conc/*`
- `src/text/` — canon table, Hebrew/Greek text helpers
- `src/morph/` — OSHB and MorphGNT decoders with the learner explanations
- `src/state/` — settings, vocabulary (Dexie), word info
- `src/components/` — WordCard, VerseCard, DictEntry, Morphemes
- `src/screens/` — Home, Reader, Word, Search, Vocab, Settings
