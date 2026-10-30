/**
 * O coração da navegação por controle remoto: dada a caixa do que está em foco
 * e as caixas do que pode receber foco, qual é o próximo na direção da seta.
 *
 * Fica fora do React e sem DOM para poder ser testado com caixas de mentira:
 * é aqui que se decide se, na lista de canais, a seta para baixo vai para a
 * linha seguinte e não para um botão do player três colunas à direita.
 *
 * Regras (as mesmas de Android TV / Google TV):
 * - só entra quem está adiante na direção pedida;
 * - quem cobre a mesma faixa transversal (a mesma coluna, ao subir/descer; a
 *   mesma linha, ao ir para os lados) tem preferência sobre quem está torto;
 * - entre os alinhados, vence o mais perto;
 * - pai e filho (a linha do canal e a estrela dentro dela) são vizinhos
 *   imediatos: para a direita entra na estrela, para a esquerda volta à linha.
 */

export type Direcao = 'up' | 'down' | 'left' | 'right';

export interface Caixa {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Candidato<T> {
  valor: T;
  caixa: Caixa;
  /** Ordem no documento (para desempate: o de cima/antes vem primeiro). */
  ordem: number;
}

export function caixaDe(rect: { left: number; top: number; right: number; bottom: number }): Caixa {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

export function largura(c: Caixa): number {
  return Math.max(0, c.right - c.left);
}

export function altura(c: Caixa): number {
  return Math.max(0, c.bottom - c.top);
}

export function centroX(c: Caixa): number {
  return (c.left + c.right) / 2;
}

export function centroY(c: Caixa): number {
  return (c.top + c.bottom) / 2;
}

function sobreposicao(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

/** Distância entre duas faixas (0 quando elas se cruzam). */
function vao(a1: number, a2: number, b1: number, b2: number): number {
  if (a2 < b1) return b1 - a2;
  if (b2 < a1) return a1 - b2;
  return 0;
}

export function contem(externa: Caixa, interna: Caixa): boolean {
  return externa.left <= interna.left + 1
    && externa.right >= interna.right - 1
    && externa.top <= interna.top + 1
    && externa.bottom >= interna.bottom - 1;
}

/** A própria caixa do elemento em foco (que também vem na lista de candidatos). */
function mesmaCaixa(a: Caixa, b: Caixa): boolean {
  return Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.top - b.top) < 0.5
    && Math.abs(a.right - b.right) < 0.5
    && Math.abs(a.bottom - b.bottom) < 0.5;
}

const TOLERANCIA = 1;

function adiante(atual: Caixa, candidata: Caixa, direcao: Direcao): boolean {
  switch (direcao) {
    case 'up': return candidata.bottom <= atual.top + TOLERANCIA;
    case 'down': return candidata.top >= atual.bottom - TOLERANCIA;
    case 'left': return candidata.right <= atual.left + TOLERANCIA;
    case 'right': return candidata.left >= atual.right - TOLERANCIA;
  }
}

/**
 * O próximo foco. `null` quando não há nada adiante (a tecla é ignorada e o
 * foco fica onde está — nunca some).
 */
export function escolherNaDirecao<T>(
  atual: Caixa,
  candidatos: Candidato<T>[],
  direcao: Direcao,
): T | null {
  const vertical = direcao === 'up' || direcao === 'down';
  let melhor: T | null = null;
  let melhorNota = Infinity;
  let melhorOrdem = Infinity;

  for (const candidato of candidatos) {
    const caixa = candidato.caixa;
    if (largura(caixa) <= 0 || altura(caixa) <= 0) continue;
    // O elemento em foco também está na lista: ele não é o próximo dele mesmo.
    if (mesmaCaixa(atual, caixa)) continue;

    // Pai/filho (a estrela dentro da linha) vale para os lados: é o caminho para
    // entrar e sair de um controle que fica dentro de outro. Na vertical a regra
    // é a mesma de todo mundo — só entra quem está de fato acima/abaixo.
    const relacao = (direcao === 'left' || direcao === 'right')
      && (contem(atual, caixa) || contem(caixa, atual));
    if (!relacao && !adiante(atual, caixa, direcao)) continue;

    // Distância no eixo da seta: da borda do foco até a borda do candidato.
    let gapEixo: number;
    if (vertical) {
      gapEixo = direcao === 'down'
        ? Math.max(0, caixa.top - atual.bottom)
        : Math.max(0, atual.top - caixa.bottom);
    } else {
      gapEixo = direcao === 'right'
        ? Math.max(0, caixa.left - atual.right)
        : Math.max(0, atual.left - caixa.right);
    }

    // Alinhamento: quanto o candidato cobre da faixa transversal do foco.
    const cobertura = vertical
      ? sobreposicao(caixa.left, caixa.right, atual.left, atual.right) / Math.max(1, Math.min(largura(caixa), largura(atual)))
      : sobreposicao(caixa.top, caixa.bottom, atual.top, atual.bottom) / Math.max(1, Math.min(altura(caixa), altura(atual)));

    // Distância transversal (0 quando estão alinhados).
    const gapTransversal = vertical
      ? vao(caixa.left, caixa.right, atual.left, atual.right)
      : vao(caixa.top, caixa.bottom, atual.top, atual.bottom);

    const desalinhamento = vertical
      ? (largura(caixa) < largura(atual) * 0.6
        ? Math.abs(caixa.left - atual.left)
        : Math.abs(centroX(caixa) - centroX(atual)))
      : (altura(caixa) < altura(atual) * 0.6
        ? Math.abs(caixa.top - atual.top)
        : Math.abs(centroY(caixa) - centroY(atual)));

    // A cobertura pesa mais que a distância curta: uma linha logo abaixo ganha
    // de um botão vizinho que só encosta no canto.
    let nota = gapEixo + gapTransversal * 2 + (1 - Math.min(1, cobertura)) * 40 + desalinhamento * 0.05;

    // Pai/filho: caminho curto e previsível para entrar e sair de um controle
    // que fica dentro de outro (a estrela do favorito dentro da linha).
    if (relacao) nota *= 0.2;

    if (nota < melhorNota - 0.001 || (Math.abs(nota - melhorNota) <= 0.001 && candidato.ordem < melhorOrdem)) {
      melhor = candidato.valor;
      melhorNota = nota;
      melhorOrdem = candidato.ordem;
    }
  }

  return melhor;
}

/**
 * A lista é desenhada em blocos (o painel de canais desenha 40 por vez para não
 * travar TV fraca). Quando o foco chega perto do fim do que já está na tela,
 * o próximo bloco precisa entrar antes da tecla seguinte.
 */
export function deveRenderizarMais(indice: number, jaRenderizados: number, total: number, margem = 8): boolean {
  if (jaRenderizados >= total) return false;
  return indice >= jaRenderizados - margem;
}

/**
 * Depois de filtrar (categoria, busca), qual item deve receber o foco: o mesmo
 * de antes, se ainda existir; senão o canal no ar, se estiver na lista nova;
 * senão o primeiro. Nunca devolve um índice inexistente.
 */
export function indiceParaRestaurar(
  ids: Array<string | null>,
  ultimoFocado: string | null,
  noAr: string | null,
): number {
  if (ids.length === 0) return -1;
  const ultimo = ultimoFocado ? ids.indexOf(ultimoFocado) : -1;
  if (ultimo >= 0) return ultimo;
  const ativo = noAr ? ids.indexOf(noAr) : -1;
  if (ativo >= 0) return ativo;
  return 0;
}
