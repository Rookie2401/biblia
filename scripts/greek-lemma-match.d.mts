export function base(s: string): string;
export function lev(a: string, b: string): number;
export function sameWord(a: string, b: string): boolean;
export function candidateForms(lemma: string): string[];
export interface NtLemmaIndex {
  exact: Set<string>;
  byBase: Map<string, string>;
}
export function buildNtIndex(ntLemmas: Iterable<string>): NtLemmaIndex;
export function matchNtLemma(lemma: string, ntIndex: NtLemmaIndex): string | undefined;
