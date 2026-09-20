// Shared "is this actually the same Greek word" reconciliation used both when matching
// Abbott-Smith's/Strong's lemma spelling to MorphGNT's (build-lexicon-gr.mjs) and when merging
// a Septuagint lemma onto an existing New Testament lemma (build-lxx.mjs) — same class of
// problem (two independently-encoded corpora citing the same word slightly differently:
// accentuation, movable nu, a deponent's active vs. middle citation form).

/**
 * Accent/breathing/diaeresis-free, sigma-normalized form, for a tolerant comparison.
 * Deliberately NOT lowercased: Greek reuses the same spelling for unrelated common and
 * proper nouns (Λίβανος "Lebanon" / λίβανος "frankincense", τύραννος "tyrant" / Τύραννος
 * "Tyrannus" the person in Acts 19, δίδυμος "twin" / Δίδυμος "Didymus"), so folding case
 * away merged real but different words purely because one happened to be capitalized.
 * Comparing with case intact still matches the common case (an indeclinable name spelled
 * with its accents in one corpus and without them in the other keeps the same capitalization
 * either way) while refusing to bridge a lowercase common noun onto an uppercase name or
 * vice versa.
 */
export function base(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ᷀-᷿]/g, '')
    .replace(/ς/g, 'σ');
}

export function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** True when two lemmas are the same word: identical once accent-free, or a small edit distance
 * from the same initial letter (tight for short words, looser for long ones). */
export function sameWord(a, b) {
  const x = base(a);
  const y = base(b);
  if (x === y) return true;
  return x[0] === y[0] && lev(x, y) <= (Math.min(x.length, y.length) <= 5 ? 1 : 3);
}

/** Candidate alternate citation forms for a lemma (deponent/active alternation, movable letters,
 * contract-verb spelling), the same transformations build-lexicon-gr.mjs applies when matching
 * against Abbott-Smith/Strong's spellings. */
export function candidateForms(lemma) {
  return [
    lemma,
    lemma.replace(/\(([^)]*)\)/g, '$1'),
    lemma.replace(/\([^)]*\)/g, ''),
    lemma.replace(/ομαι$/, 'ω'),
    lemma.replace(/αμαι$/, 'ημι'),
    lemma.replace(/υί/g, 'υεί'),
    lemma.replace(/άω$/, 'έω'),
    lemma.replace(/οῦς$/, 'εος'),
    lemma.replace(/οῦν$/, 'εον'),
  ].filter(Boolean);
}

/** Builds the lookup structures `matchNtLemma` needs from the set of NT lemma spellings:
 * an exact-spelling Set and a base-normalized (accent/breathing-insensitive) Map. */
export function buildNtIndex(ntLemmas) {
  const exact = new Set(ntLemmas);
  const byBase = new Map();
  for (const l of ntLemmas) {
    const b = base(l);
    if (!byBase.has(b)) byBase.set(b, l);
  }
  return { exact, byBase };
}

/**
 * Finds the New Testament lemma that a Septuagint (or any other Greek corpus's) lemma
 * actually is, if any: an exact match, or a match once both spellings are reduced to their
 * accent/breathing/diaeresis-free base form (catches Ισραηλ/Ἰσραήλ, Δαυιδ/Δαυίδ, Μωυσῆς/
 * Μωϋσῆς and the like — genuinely the same word, differently marked), tried against every
 * deponent/movable-letter/contract-verb candidate spelling too. Returns the NT lemma's own
 * spelling (so the caller can rewrite its token onto it) or undefined for genuinely new
 * vocabulary.
 *
 * Deliberately does NOT fall back to a bare edit-distance search across the whole NT
 * vocabulary: tried during development, it merged real but unrelated words purely because
 * they happened to be spelled similarly — proper nouns most severely (Ιωαβ "Joab" onto Ἰώβ
 * "Job", Σαλωμων "Solomon" onto Σαλμών "Salmon", Ιωναθαν "Jonathan" onto Ἰωσαφάτ
 * "Jehoshaphat"), but ordinary vocabulary too (κριός "ram" onto κύριος "Lord", ἐκλέγω
 * "choose" onto ἐγώ "I", πεδίον "plain" onto πρίν "before"). A genuinely new LXX lemma is
 * the correct, honest outcome far more often than a coincidental near-miss is the right one.
 */
export function matchNtLemma(lemma, ntIndex) {
  const { exact, byBase } = ntIndex;
  if (exact.has(lemma)) return lemma;
  for (const c of candidateForms(lemma)) {
    if (exact.has(c)) return c;
    const hit = byBase.get(base(c));
    if (hit) return hit;
  }
  return undefined;
}
