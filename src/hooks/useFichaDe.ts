import { useEffect, useState } from 'react';
import { generos as lerGeneros, idDaFicha, type ItemDestaque } from '../services/vodService';
import { ficha as buscarFicha, type Ficha } from '../services/tmdbService';

/**
 * A ficha do título sob o ponteiro, para o destaque do alto da tela. Espera o
 * mouse parar um instante (passar rápido por cima de uma fileira não dispara
 * dezenas de pedidos) e só pergunta ao TMDB quando o gerador já resolveu o id.
 */
export function useFichaDe(item: ItemDestaque | null): Ficha | null {
  const [achada, setAchada] = useState<{ chave: string; ficha: Ficha | null } | null>(null);
  const chave = item ? `${item.tipo}|${item.titulo}|${item.ano}` : null;

  useEffect(() => {
    if (!item || !chave) return;
    let vivo = true;
    const serie = item.tipo !== 'f';
    const espera = window.setTimeout(() => {
      // Item que veio de uma lista do TMDB já traz o id: dispensa o arquivo de fichas.
      (item.tmdbId ? Promise.resolve(item.tmdbId) : lerGeneros().then((g) => idDaFicha(g, item.titulo, serie)))
        .then((id) => (id ? buscarFicha(id, serie) : null))
        .then((f) => { if (vivo) setAchada({ chave, ficha: f }); })
        .catch(() => { if (vivo) setAchada({ chave, ficha: null }); });
    }, 280);
    return () => { vivo = false; window.clearTimeout(espera); };
  }, [item, chave]);

  return achada && achada.chave === chave ? achada.ficha : null;
}
