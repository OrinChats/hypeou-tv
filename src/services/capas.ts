/**
 * Capas do catálogo, buscadas no TMDB por nome.
 *
 * A origem não traz capa nenhuma, e o arquivo de fichas (que traria o endereço
 * pronto) nem sempre vai junto no pacote publicado. Sem ele, a grade A–Z
 * mostrava a inicial do título no lugar da capa: só o modal, que pergunta ao
 * TMDB na hora, tinha imagem.
 *
 * Este módulo é o que faz a grade ter capa mesmo sem o arquivo de fichas:
 *
 *  - fila com poucos pedidos ao mesmo tempo: uma letra com mil títulos não
 *    dispara mil buscas de uma vez (o TMDB limita e o navegador engasga);
 *  - o último título pedido sai primeiro: quem rola a grade quer a capa do que
 *    está na tela agora, não do que passou;
 *  - o que foi achado fica guardado no aparelho. Na segunda visita as capas
 *    já estão lá, sem pergunta nenhuma.
 *
 * Capa não encontrada só vale na memória da visita: pode ter sido uma falha de
 * rede, e guardar isso para sempre deixaria o título sem capa de vez.
 */

import { melhorMatch, posterUrl, type TmdbTipo } from './tmdbService';

const CHAVE_DISCO = 'hypeou-capas-v2';
/** Quantas capas ficam guardadas no aparelho (as mais antigas saem primeiro). */
const LIMITE_NO_DISCO = 6000;
/** Quantas buscas correm ao mesmo tempo. */
const PARALELO = 6;

interface Tarefa {
  chave: string;
  titulo: string;
  tipo: TmdbTipo;
  entregar: (url: string | null) => void;
}

const emMemoria = new Map<string, Promise<string | null>>();
const pilha: Tarefa[] = [];
let ativas = 0;

let noDisco: Record<string, string> | null = null;
let gravacaoAgendada: number | undefined;

function lerDisco(): Record<string, string> {
  if (noDisco) return noDisco;
  try {
    const bruto = localStorage.getItem(CHAVE_DISCO);
    const lido: unknown = bruto ? JSON.parse(bruto) : {};
    noDisco = lido && typeof lido === 'object' ? (lido as Record<string, string>) : {};
  } catch {
    // Sem localStorage (aba privada) ou conteúdo ilegível: vale só a memória.
    noDisco = {};
  }
  return noDisco;
}

function guardar(chave: string, url: string): void {
  const mapa = lerDisco();
  mapa[chave] = url;
  if (gravacaoAgendada !== undefined) return;
  // Junta várias capas numa gravação só: gravar a cada imagem travaria a rolagem.
  gravacaoAgendada = window.setTimeout(() => {
    gravacaoAgendada = undefined;
    const atual = lerDisco();
    const chaves = Object.keys(atual);
    if (chaves.length > LIMITE_NO_DISCO) {
      for (const k of chaves.slice(0, chaves.length - LIMITE_NO_DISCO + 500)) delete atual[k];
    }
    try {
      localStorage.setItem(CHAVE_DISCO, JSON.stringify(atual));
    } catch { /* cota cheia: segue só com a memória */ }
  }, 1500);
}

function bombear(): void {
  while (ativas < PARALELO && pilha.length) {
    const tarefa = pilha.pop() as Tarefa;
    ativas++;
    melhorMatch(tarefa.titulo, tarefa.tipo)
      .then((achado) => posterUrl(achado?.resultado.poster_path))
      .catch(() => null)
      .then((url) => {
        ativas--;
        if (url) guardar(tarefa.chave, url);
        tarefa.entregar(url);
        bombear();
      });
  }
}

/** A capa de um título do acervo, ou nulo quando o TMDB não o conhece. */
export function capaDoTitulo(titulo: string, serie: boolean): Promise<string | null> {
  const chave = `${serie ? 's' : 'f'}:${titulo}`;

  const guardada = lerDisco()[chave];
  if (guardada) return Promise.resolve(guardada);

  const existente = emMemoria.get(chave);
  if (existente) return existente;

  const promessa = new Promise<string | null>((resolver) => {
    pilha.push({ chave, titulo, tipo: serie ? 'tv' : 'movie', entregar: resolver });
    bombear();
  });
  emMemoria.set(chave, promessa);
  return promessa;
}
