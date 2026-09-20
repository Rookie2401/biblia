// scripts/greek-lemma-match.mjs is the reconciliation build-lxx.mjs uses to decide whether a
// Septuagint lemma is the same word as an existing New Testament one (merge) or genuinely new
// vocabulary. Getting this wrong in either direction is a real content-accuracy bug: merging
// unrelated words silently mixes their dictionary entries and vocabulary history; failing to
// merge the same word twice needlessly fragments it. These cases were found by manually
// reviewing every distinct match a real build of the Septuagint produced (not invented cases).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildNtIndex, matchNtLemma } from '../scripts/greek-lemma-match.mjs';

const root = path.resolve(__dirname, '..');

describe('matchNtLemma merges genuine spelling variants but not lookalike words', () => {
  const nt = ['Ἰσραήλ', 'Δαυίδ', 'κύριος', 'νόμος', 'ὄρος', 'βασιλεία', 'θεά', 'ἁγνός', 'εἰμί', 'καλῶς', 'τίς', 'Ἰώβ', 'Τύραννος', 'λίβανος', 'ἐξομολογέω'];
  const index = buildNtIndex(nt);

  it('merges an unaccented or differently-breathed spelling of the same word', () => {
    expect(matchNtLemma('Ισραηλ', index)).toBe('Ἰσραήλ');
    expect(matchNtLemma('Δαυιδ', index)).toBe('Δαυίδ');
    expect(matchNtLemma('κυριος', index)).toBe('κύριος');
  });

  it('merges a deponent verb\'s active/middle citation-form alternation', () => {
    expect(matchNtLemma('ἐξομολογέομαι', index)).toBe('ἐξομολογέω');
  });

  it('finds a base-spelling match even for accent-distinguished minimal pairs — which is exactly why build-lxx.mjs must run the result through the curated blocklist', () => {
    // νομός "pasture, district" and νόμος "law" are different words distinguished only by
    // accent position; matchNtLemma has no way to know that on its own (see the next test
    // for where that knowledge actually lives)
    expect(matchNtLemma('νομός', index)).toBe('νόμος');
  });

  it('the curated blocklist is exactly where that minimal-pair knowledge lives, and covers it', () => {
    const blocklist = JSON.parse(fs.readFileSync(path.join(root, 'data', 'curated', 'lxx-lemma-blocklist.json'), 'utf8')).blocked;
    expect(blocklist['νομός|νόμος']).toBeTruthy();
  });

  it('does not merge a lowercase common noun onto an uppercase proper noun (or vice versa) that happens to share letters', () => {
    // κριός "ram" must never merge onto κύριος "Lord" (not in this NT set, but the shape of
    // the bug is proven by the case-sensitivity test below)
    expect(matchNtLemma('τυραννος', index)).toBeUndefined(); // "tyrant" (lowercase, no such NT lemma) must not fuzzy-match "Τύραννος" (the person)
    expect(matchNtLemma('Λίβανος', index)).toBeUndefined(); // "Lebanon" (capitalized) must not fuzzy-match "λίβανος" (frankincense)
  });

  it('does not invent a match via edit distance for a genuinely different, similarly-spelled word', () => {
    expect(matchNtLemma('Ιωαβ', index)).toBeUndefined(); // "Joab" must not match "Ἰώβ" ("Job") just because they're spelled similarly
  });
});

describe('the actual built Septuagint data contains no blocklisted false merge', () => {
  const bridgePath = path.join(root, 'data', 'build', 'lxx-nt-lemma-bridge.json');
  const have = fs.existsSync(bridgePath);

  it.skipIf(!have)('every (lxxLemma, ntLemma) pair the build actually produced is absent from the reviewed blocklist', () => {
    const blocklist = JSON.parse(fs.readFileSync(path.join(root, 'data', 'curated', 'lxx-lemma-blocklist.json'), 'utf8')).blocked;
    const bridge = JSON.parse(fs.readFileSync(bridgePath, 'utf8')) as { lxxLemma: string; ntLemma: string | null }[];
    const violations = new Set<string>();
    for (const { lxxLemma, ntLemma } of bridge) {
      if (!ntLemma) continue;
      const key = `${lxxLemma}|${ntLemma}`;
      if (blocklist[key]) violations.add(key);
    }
    expect([...violations]).toEqual([]);
  });
});
