// After LCS alignment, a MAM word left unmatched whose neighbours map to the OSHB words on
// either side of exactly one unused OSHB word is matched to that word when the consonantal
// skeletons are close (a spelling difference between the Aleppo-based MAM and the
// Leningrad-based WLC: הטהרה / הטהורה, אהלה / אהלו). Nothing else is guessed.
function lev(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

export function fillGaps(map, mc, oc) {
  const used = new Set(map.filter((j) => j >= 0));
  let filled = 0;
  for (let i = 0; i < map.length; i++) {
    if (map[i] >= 0) continue;
    const prev = i > 0 ? map[i - 1] : -1;
    const next = i + 1 < map.length ? map[i + 1] : oc.length;
    let cand = -1;
    if (prev >= 0 && next >= 0 && next - prev === 2) cand = prev + 1;
    else if (prev < 0 && i === 0 && next >= 1 && next - 1 >= 0) cand = next - 1;
    else if (next === oc.length && prev >= 0 && prev + 1 < oc.length && i === map.length - 1) cand = prev + 1;
    if (cand < 0 || used.has(cand)) continue;
    const a = mc[i];
    const b = oc[cand];
    if (!a || !b) continue;
    const limit = Math.max(1, Math.floor(Math.max(a.length, b.length) / 3));
    if (lev(a, b) <= limit) {
      map[i] = cand;
      used.add(cand);
      filled++;
    }
  }
  return filled;
}
