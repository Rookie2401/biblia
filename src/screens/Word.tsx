/**
 * Word page: one lexeme (Hebrew lemma id or Greek lemma) outside any reading context —
 * the complete entry, root family, Septuagint links, concordance and history.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { WordCard } from '../components/WordCard.tsx';
import { BackLink, Topbar } from '../components/ui.tsx';
import { lexemeKey, type Lang } from '../model/types.ts';
import { ensureGlossIndex, indexLemma, type WordInfo } from '../state/wordinfo.ts';

export default function Word() {
  const { lang: langS = 'he', id: idS = '' } = useParams();
  const lang = (langS === 'gr' ? 'gr' : 'he') as Lang;
  const id = decodeURIComponent(idS);
  const nav = useNavigate();
  const [lemma, setLemma] = useState('');
  useEffect(() => {
    ensureGlossIndex(lang).then(() => setLemma(indexLemma(lang, id) || id));
  }, [lang, id]);
  const info: WordInfo = { ref: { book: '', ch: 0, v: 0, i: 0 }, lang, printed: lemma || id, form: lemma || id, lexId: id, key: lexemeKey(lang, id) };
  return (
    <div>
      <Topbar title={lang === 'he' ? 'Hebrew word' : 'Greek word'} left={<BackLink to="/search" label="Search" />} />
      <div className="page page--narrow route-fade">
        <WordCard key={`${lang}:${id}`} info={info} standalone onOpenVerse={() => undefined} onClose={() => nav(-1)} onOpenLexeme={(l, i) => nav(`/word/${l}/${encodeURIComponent(i)}`)} onGoTo={(r) => nav(`/read/${r.book}/${r.ch}?v=${r.v}&i=${r.i}`)} />
      </div>
    </div>
  );
}
