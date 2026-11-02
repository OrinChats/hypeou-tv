/**
 * Ajustes > Listas: importar, substituir ou remover, separadamente, a lista de
 * canais e a lista de filmes e séries. Não há endereço para digitar: sem
 * importação vale a lista publicada. Cada lista tem sua própria chave de
 * armazenamento (ver `services/listas.ts`), então mexer numa nunca toca a outra.
 */
import { useRef } from 'react';
import {
  importarLista, listaImportada, removerListaImportada, useListas, type Lista,
} from '../services/listas';
import { parseCatalog } from '../utils/catalogoParser';

const BLOCOS: { lista: Lista; rotulo: string; publicada: string }[] = [
  { lista: 'canais', rotulo: 'Canais', publicada: 'Usando a lista publicada.' },
  { lista: 'filmes', rotulo: 'Filmes e séries', publicada: 'Usando a lista publicada.' },
];

interface Props {
  aviso: (mensagem: string) => void;
}

export function ImportarListas({ aviso }: Props) {
  // Re-renderiza quando alguma lista muda; o estado vem de `listaImportada`.
  useListas();
  const entradas = useRef<Record<Lista, HTMLInputElement | null>>({ canais: null, filmes: null });

  const aoEscolher = (lista: Lista, e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onerror = () => aviso('Não consegui ler o arquivo.');
    leitor.onload = () => {
      const texto = leitor.result;
      if (typeof texto !== 'string') return;
      // Só entra o que o leitor do catálogo entende: arquivo vazio ou de outro
      // formato não pode substituir a lista que já funciona.
      if (parseCatalog(texto).length === 0) {
        aviso('Nenhum item válido encontrado no arquivo. A lista atual foi mantida.');
        return;
      }
      aviso(importarLista(lista, texto, arquivo.name)
        ? `Lista de ${lista === 'canais' ? 'canais' : 'filmes e séries'} importada.`
        : 'O arquivo não coube no armazenamento do navegador. A lista atual foi mantida.');
    };
    leitor.readAsText(arquivo);
  };

  const remover = (lista: Lista) => {
    removerListaImportada(lista);
    aviso(`Lista de ${lista === 'canais' ? 'canais' : 'filmes e séries'} importada removida. Voltou a lista publicada.`);
  };

  return (
    <div className="ajustes-botoes" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 18 }}>
      {BLOCOS.map(({ lista, rotulo, publicada }) => {
        const importada = listaImportada(lista);
        return (
          <div key={lista}>
            <strong>{rotulo}</strong>
            <p style={{ margin: '4px 0 8px', fontSize: '0.85rem', opacity: 0.8 }}>
              {importada ? `Usando a lista importada: ${importada.nome || 'arquivo'}.` : publicada}
            </p>
            <div className="ajustes-botoes">
              <button type="button" className="ajustes-botao destaque" onClick={() => entradas.current[lista]?.click()}>
                {importada ? 'Substituir lista (.txt / .m3u)' : 'Importar lista (.txt / .m3u)'}
              </button>
              <input
                ref={(el) => { entradas.current[lista] = el; }}
                type="file"
                accept=".m3u,.m3u8,.txt"
                style={{ display: 'none' }}
                onChange={(e) => aoEscolher(lista, e)}
              />
              {importada && (
                <button type="button" className="ajustes-botao perigo" onClick={() => remover(lista)}>
                  Remover lista importada
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
