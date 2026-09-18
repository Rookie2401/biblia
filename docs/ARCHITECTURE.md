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

**MAM parsing** (`parseVerse`): resolves `mam-kq` (ketiv in parentheses, qere in brackets → the
qere is read, both kept), qere-only and ketiv-only spans, `mam-kq-trivial`, implicit maqaf,
`{פ}`/`{ס}`/inverted nun as flags, footnote markers + `<i class="footnote">` as a note,
`<b>׀</b>`/`<small>׀</small>` as a standalone paseq token, size tags dropped with the text
kept, `<br>` and `&nbsp;`/`&thinsp;` as spaces. Anything else throws, so a new construct can
never be silently dropped. The dash MAM prints for Josh 21:36–37 becomes `absent`.

**Alignment** OSHB → MAM: per verse, exact consonantal match else LCS; when the two editions
divide a chapter differently (Exod 20, Num 25, Deut 5) the whole chapter is aligned at once.
Result 2026-09-18: 305,452 words, 0.37% unmatched (shown in the reader as words without a card).

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

## IndexedDB

| Table | Key | Notes |
|---|---|---|
| lexemes | key `he:<id>` / `gr:<lemma>` | status, lookups, encounters, forms, chapters, firstLookup |
| lookups | ++id | one row per tap |
| positions | book | last chapter/verse seen (IntersectionObserver over verses) |
| progress | `Book:ch` | visits, done |
| notes | key | reserved for user notes |
