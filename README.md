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
| Contextual renderings | Berean Standard Bible interlinear tables (per-word English in its verse), aligned at build time | public domain |

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

### Reproducing the data build

`public/data` (the app's shipped output) and the raw inputs under `data/mam-raw`, `data/oshb`,
`data/gnt`, `data/lexicon` and `data/bsb` are git-ignored: they are large, and four of the five
are re-downloadable with `node scripts/fetch-sources.mjs` (Sefaria's API and the public
GitHub repos above). The fifth, `data/bsb/bsb_tables.xlsx` (55 MB, the Berean interlinear
tables), is a manual download from
[berean.bible/downloads.htm](https://berean.bible/downloads.htm) — Settings links to the same
page. Only `data/bdb-sefaria` and `data/bdb-texts` (the crawled Sefaria BDB text, `fetch-bdb*.mjs`)
are committed, since re-crawling them takes tens of minutes against a public API.

Because the four re-downloadable sources track their upstream repos' `master` branch, a rebuild
months later could pull a newer revision than the one an audit checked. `node
scripts/checksum-sources.mjs` records a SHA-256 of every file under those five directories to
`data/build/SOURCE-CHECKSUMS.json` (committed); running it again after `fetch-sources.mjs` and
diffing against the committed manifest shows whether anything upstream has moved since the
inputs this repository's data was built from.

## English layers

Two kinds of English appear, always labelled:

- **Contextual rendering (BSB)** — what the Berean Standard Bible makes of *this word in this verse*; the only layer that translates the verse. Built by `scripts/build-bsb.mjs` from the public-domain interlinear tables. Where the Masoretic or SBLGNT verse numbering differs from the English tradition (Joel 3–4, Malachi 3:19–24, 1 Kings 5, Zechariah 2, Psalm titles, the Decalogue …) an explicit, reviewable map in `scripts/versification.mjs` says which English verse(s) each base verse is aligned against; nothing is aligned across a boundary the map does not name. 99.3% of Hebrew and 99.6% of Greek words carry a rendering (87.8% / 83.7% their own English, 11.5% / 15.9% rendered together with a neighbour, marked ‒); 0.7% / 0.4% have none (marked ·: the shorter ending of Mark, Romans 16:24 and single words the BSB does not render). Per-book figures are in `public/data/ctx/COVERAGE.json`, per-chapter diagnostics in `data/build/ctx-diagnostics.json`; the build fails if a chapter aligns nothing or drops below 60%.
- **Lemma gloss** — the dictionary meaning of the lemma, with its source named on the card (`gs`): a curated modern gloss (`data/curated/*.json`, mostly function words, names and lemmas the lexica miss), the BDB outline's definitions, the Open Scriptures index, the first clause of Strong's, or a short KJV rendering as a last resort. KJV renderings are otherwise shown only as *historical renderings*. Part of speech comes from the corpus morphology, not from the index, and is normalised to a fixed human vocabulary (noun, verb, pronoun, relative pronoun …). Every fallback gloss must pass a quality check (no cut-off braces, no "See"/"Compare" cross references, no margin notes, no dangling punctuation); nothing is ever truncated at a character count, and the build fails rather than ship an empty or malformed gloss. Greek lemmas take the Strong's entry whose headword *is* the lemma; Abbott-Smith's number is used only when it names the same word, homographs and spelling variants are settled in `data/curated/gr-overrides.json` (each with a reason), and every disagreement is written to `data/build/gr-strong-conflicts.json`. `test/lexicon-quality.test.ts` and `test/bsb-context.test.ts` guard the shipped files against archaic phrasing, missing or malformed glosses, the audited mis-mappings, inherited metadata on augmented ids, and mis-aligned boundary passages.

## Commands

```bash
npm run fetch:sources   # download every source into data/ (idempotent)
node scripts/fetch-bdb.mjs    # full BDB from Sefaria: walk the headword chain into data/bdb-sefaria (resumable)
node scripts/fetch-bdb2.mjs   # full BDB from Sefaria: sweep by Strong's lemma forms (what the lookup indexes; ~40 min)
npm run build:data      # public/data/{he,gr,lex,conc,ctx} + src/data/{canon,coverage}.json (needs data/bsb/bsb_tables.xlsx)
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
