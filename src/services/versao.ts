/**
 * Downloads are intentionally disabled while the Hypeou TV installers are prepared.
 * Keep the small public interface so a future release system can be added without
 * bringing back links to installers from the previous brand by accident.
 */
export type Plataforma = 'tvbox' | 'celular' | 'windows';

export interface ArquivoApp {
  nome: string;
  url: string;
  bytes: number;
}

export interface Versao {
  versao: string;
  arquivos: Partial<Record<Plataforma, ArquivoApp>>;
}

/** No installer is published yet, so no external download URL is returned. */
export async function buscarVersao(): Promise<Versao | null> {
  return null;
}
