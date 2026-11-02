import { useNavigate } from 'react-router-dom';
import type { Destaque } from '../components/Telas';
import { useFichaDe } from '../hooks/useFichaDe';
import { nomeLimpo } from '../services/prateleiras';
import type { ItemDestaque } from '../services/vodService';

export const ROTULO_TIPO: Record<string, string> = { f: 'Filme', s: 'Série', a: 'Anime', d: 'Dorama' };

export function useAbrirVod() {
  const navigate = useNavigate();
  return (item: ItemDestaque) => navigate('/movies', { state: { abrir: item } });
}

/** O destaque do alto para um título do catálogo: a ficha do TMDB quando chega. */
export function useHeroiVod(item: ItemDestaque | null): Destaque | null {
  const ficha = useFichaDe(item);
  if (!item) return null;
  const selos = [ROTULO_TIPO[item.tipo] ?? 'Título'];
  const ano = item.ano || item.anoTmdb || ficha?.ano;
  if (ano) selos.push(ano);
  const nota = ficha?.nota || item.nota;
  if (nota) selos.push(`★ ${nota.toFixed(1)}`);
  if (ficha?.temporadas) selos.push(`${ficha.temporadas} temporada${ficha.temporadas > 1 ? 's' : ''}`);
  selos.push(...(ficha?.generos ?? item.generos ?? []).slice(0, 3));
  return {
    titulo: nomeLimpo(item.titulo),
    selos,
    // O que a lista já trouxe aparece de imediato; a ficha completa troca por cima quando chega.
    sinopse: ficha?.sinopse || item.sinopse,
    fundo: ficha?.fundo || item.fundo,
    capa: item.capa || ficha?.capa,
  };
}
