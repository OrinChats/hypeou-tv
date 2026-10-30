/**
 * A hierarquia do Voltar, separada do React para poder ser testada.
 *
 * O Voltar do controle nunca deve fechar o aplicativo por engano: ele fecha a
 * camada de cima (modal, menu, lista sobre o player), depois volta uma tela do
 * histórico do próprio app, depois vai para a tela inicial e, só na tela
 * inicial, pede confirmação para sair.
 */

export type AcaoVoltar = 'camada' | 'historico' | 'inicio' | 'confirmar-saida' | 'sair' | 'ignorar';

export interface ContextoVoltar {
  /** Existe modal, menu ou painel aberto por cima da tela. */
  temCamada: boolean;
  /** Posição no histórico do navegador (history.state.idx do React Router). */
  indiceHistorico: number;
  /** Rota atual (pathname). */
  rota: string;
  /** Na TV o Voltar na tela inicial oferece a saída, sem fechar na hora. */
  modoTv: boolean;
  /** O aviso "aperte Voltar de novo para sair" já foi mostrado há pouco. */
  avisouSaida: boolean;
  /** Já houve navegação dentro do app nesta visita (rota diferente da de entrada). */
  navegouNoApp: boolean;
}

export function planejarVoltar(ctx: ContextoVoltar): AcaoVoltar {
  if (ctx.temCamada) return 'camada';

  if (ctx.rota !== '/') {
    if (ctx.indiceHistorico > 0 || ctx.navegouNoApp) return 'historico';
    return 'inicio';
  }

  // Tela inicial. No site com mouse, o Voltar do navegador é do navegador:
  // não interceptamos nada.
  if (!ctx.modoTv) return 'ignorar';
  return ctx.avisouSaida ? 'sair' : 'confirmar-saida';
}
