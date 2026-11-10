/**
 * Início: o título em destaque no alto (que gira entre os mais populares, ou
 * mostra o que estiver sob o ponteiro) e fileiras embaixo: Continue assistindo,
 * Ao vivo agora (cartões largos com o programa no ar), Favoritos e as
 * prateleiras por gênero — Em alta, Ação, Terror, Animes, Doramas e as demais.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Abertura } from '../components/Abertura';
import { BarraTopo } from '../components/BarraTopo';
import { CartaoCapa, CartaoLargo, Fileira, FileiraEsqueleto, SemLista } from '../components/Telas';
import { useCanais } from '../hooks/useCanais';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useListas } from '../services/listas';
import { lista as listaAndamento } from '../services/continuar';
import { getCurrentProgram, onEPGUpdate } from '../services/epgService';
import { filasDaInicio, nomeLimpo, pararDeOuvir, type Prateleira } from '../services/prateleiras';
import type { ItemDestaque } from '../services/vodService';
import { ROTULO_TIPO, useAbrirVod } from './compartilhado';
import { CHAVE_AO_INICIAR } from './Ajustes';
import { aoMudar as aoMudarVodFav, lista as vodFavoritos } from '../services/vodFavoritos';
import type { Channel } from '../types/channel';

/** Quantos cartões "Ao vivo agora" cabem numa fileira. */
const AO_VIVO_MAX = 30;
/** Quantos títulos giram no destaque do alto, e de quanto em quanto tempo. */
const HEROI_QTD = 6;
const HEROI_GIRO_MS = 9000;
/** Depois de quanto tempo sem mexer o destaque volta a girar sozinho. */
const HEROI_RETOMA_MS = 14000;

/** Embaixo da capa: o ano e a nota, quando o TMDB as trouxe. */
function rotuloDe(item: ItemDestaque): string {
  const partes = [item.ano || item.anoTmdb, item.nota ? `★ ${item.nota.toFixed(1)}` : ''].filter(Boolean);
  return partes.length ? partes.join('  ') : ROTULO_TIPO[item.tipo];
}

export function Inicio() {
  const navigate = useNavigate();
  const abrirVod = useAbrirVod();
  const canais = useCanais();
  const links = useListas();
  const [filas, setFilas] = useState<Prateleira[]>([]);
  const [carregandoFilas, setCarregandoFilas] = useState(true);
  const [giro, setGiro] = useState(0);
  const [favoritos] = useLocalStorage<string[]>('tv-favorites', []);
  const [tic, tique] = useState(0);
  const [sob, setSob] = useState<ItemDestaque | null>(null);
  const [vodFav, setVodFav] = useState(vodFavoritos);
  const [andamento] = useState(listaAndamento);

  useEffect(() => {
    let vivo = true;
    const ouvir = (f: Prateleira[]) => { if (vivo) setFilas(f); };
    void filasDaInicio(ouvir).then((f) => {
      if (!vivo) return;
      setFilas(f);
      setCarregandoFilas(false);
    });
    return () => { vivo = false; pararDeOuvir(ouvir); };
  }, []);

  // Ajustes > Ao iniciar > último canal: só na entrada da visita, para o botão
  // Início continuar levando ao Início.
  useEffect(() => {
    if (sessionStorage.getItem('saimo-entrada')) return;
    sessionStorage.setItem('saimo-entrada', '1');
    try {
      const ao = JSON.parse(localStorage.getItem(CHAVE_AO_INICIAR) || '"inicio"');
      if (ao === 'ultimo' && localStorage.getItem('tv-last-channel')) navigate('/tv', { replace: true });
    } catch { /* valor ilegível: fica no Início */ }
  }, [navigate]);
  useEffect(() => aoMudarVodFav(() => setVodFav(vodFavoritos())), []);
  // O programa no ar muda sozinho: redesenha quando o guia chega e a cada minuto.
  useEffect(() => {
    const parar = onEPGUpdate(() => tique((n) => n + 1));
    const id = window.setInterval(() => tique((n) => n + 1), 60_000);
    return () => { parar(); window.clearInterval(id); };
  }, []);

  const noAr = useMemo(() => {
    void tic; // o relógio do minuto: refaz a lista quando o programa no ar muda
    const lista: { canal: Channel; titulo: string; progresso: number }[] = [];
    for (const canal of canais) {
      if (lista.length >= AO_VIVO_MAX) break;
      const p = getCurrentProgram(canal.id);
      if (p?.current) lista.push({ canal, titulo: p.current.title, progresso: p.progress });
    }
    return lista;
  }, [canais, tic]);

  const favCanais = useMemo(
    () => favoritos.map((id) => canais.find((c) => c.id === id)).filter((c): c is Channel => !!c),
    [favoritos, canais]);

  // O destaque gira entre os primeiros da fileira Em alta (os que têm imagem larga).
  const candidatosHeroi = useMemo(() => {
    const base = filas[0]?.itens ?? [];
    const comFundo = base.filter((i) => i.fundo).slice(0, HEROI_QTD);
    return comFundo.length ? comFundo : base.slice(0, 1);
  }, [filas]);

  useEffect(() => {
    if (candidatosHeroi.length < 2 || sob) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setGiro((n) => n + 1);
    }, HEROI_GIRO_MS);
    return () => window.clearInterval(id);
  }, [candidatosHeroi.length, sob]);

  // Passar o mouse numa capa troca o destaque; parado um tempo, ele volta a girar.
  useEffect(() => {
    if (!sob) return;
    const id = window.setTimeout(() => setSob(null), HEROI_RETOMA_MS);
    return () => window.clearTimeout(id);
  }, [sob]);

  const indiceHeroi = candidatosHeroi.length ? giro % candidatosHeroi.length : 0;
  void sob;

  const destaquesTv = candidatosHeroi.length > 0
    ? [candidatosHeroi[indiceHeroi], candidatosHeroi[(indiceHeroi + 1) % candidatosHeroi.length]].filter(Boolean)
    : [];

  const irParaFileira = (id: string) => {
    document.getElementById(`prat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const abrirCanal = (c: Channel) => navigate(`/tv/${c.id}`);

  const abrirCatalogoDaFileira = (fila: Prateleira) => {
    const series = fila.id.startsWith('series-');
    const secao = fila.id === 'animes' ? 'animes' : fila.id === 'doramas' ? 'doramas' : series ? 'series' : 'filmes';
    const busca = new URLSearchParams({ secao, letra: 'A' });
    navigate(`/movies?${busca.toString()}`);
  };

  return (
    <div className="tela tela-com-barra">
      <Abertura />
      <BarraTopo />

      <section className="tv-destaques" aria-label="Destaques">
        {destaquesTv.map((item, indice) => {
          const imagem = item.fundo || item.capa;
          return (
            <button
              type="button"
              className={`tv-destaque tv-destaque-${indice + 1}`}
              key={`${item.tipo}-${item.titulo}-${indice}`}
              onClick={() => abrirVod(item)}
              onFocus={() => setSob(item)}
              onMouseEnter={() => setSob(item)}
              data-focusable="true"
            >
              {imagem && <img src={imagem} alt="" referrerPolicy="no-referrer" />}
              <span className="tv-destaque-sombra" />
              <span className="tv-destaque-conteudo">
                <small>{ROTULO_TIPO[item.tipo]}</small>
                <strong>{nomeLimpo(item.titulo)}</strong>
                <em><span>▶</span> Assistir</em>
              </span>
            </button>
          );
        })}
        {destaquesTv.length === 0 && <div className="tv-destaque tv-destaque-vazio" />}
      </section>

      {filas.length > 1 && (
        <nav className="generos-atalhos" aria-label="Ir para um gênero">
          {filas.map((f) => (
            <button key={f.id} type="button" onClick={() => irParaFileira(f.id)}>{f.titulo}</button>
          ))}
        </nav>
      )}

      {!links.canais && <SemLista tipo="canais" />}
      {!links.filmes && <SemLista tipo="filmes" />}

      {andamento.length > 0 && (
        <Fileira titulo="Continue assistindo">
          {andamento.map((a) => (
            <CartaoCapa
              key={a.origem.titulo}
              titulo={a.origem.titulo}
              capa={a.origem.capa}
              rotulo={a.rotulo}
              progresso={a.fracao}
              aoAbrir={() => abrirVod(a.origem)}
              aoPassar={() => setSob(a.origem)}
            />
          ))}
        </Fileira>
      )}

      {noAr.length > 0 && (
        <Fileira titulo="Sports · Ao vivo" aoVerTodos={() => navigate('/tv')} rotuloVerTodos="Abrir Ao vivo">
          {noAr.map(({ canal, titulo, progresso }) => (
            <CartaoLargo
              key={canal.id}
              titulo={canal.name}
              linha={titulo}
              logo={canal.logo}
              selo="AO VIVO"
              progresso={progresso}
              aoAbrir={() => abrirCanal(canal)}
            />
          ))}
        </Fileira>
      )}

      {favCanais.length > 0 && (
        <Fileira titulo="Canais favoritos" aoVerTodos={() => navigate('/favoritos')}>
          {favCanais.map((c) => (
            <CartaoLargo key={c.id} titulo={c.name} logo={c.logo}
              linha={getCurrentProgram(c.id)?.current?.title ?? c.category}
              aoAbrir={() => abrirCanal(c)} />
          ))}
        </Fileira>
      )}

      {vodFav.length > 0 && (
        <Fileira titulo="Filmes e séries favoritos" aoVerTodos={() => navigate('/favoritos')}>
          {vodFav.slice(0, 20).map((i) => (
            <CartaoCapa key={`${i.tipo}${i.titulo}${i.ano}`} titulo={i.titulo} capa={i.capa}
              rotulo={ROTULO_TIPO[i.tipo]} aoAbrir={() => abrirVod(i)} aoPassar={() => setSob(i)} />
          ))}
        </Fileira>
      )}

      {filas.map((fila) => (
        <Fileira
          key={fila.id}
          id={`prat-${fila.id}`}
          titulo={fila.titulo}
          aoVerTodos={() => abrirCatalogoDaFileira(fila)}
          rotuloVerTodos="Ver catálogo"
        >
          {fila.itens.map((i) => (
            <CartaoCapa key={`${i.tipo}${i.titulo}${i.ano}`} titulo={nomeLimpo(i.titulo)} capa={i.capa}
              rotulo={rotuloDe(i)} tipo={i.tipo} aoAbrir={() => abrirVod(i)} aoPassar={() => setSob(i)} />
          ))}
        </Fileira>
      ))}

      {carregandoFilas && filas.length === 0 && links.filmes && (
        <>
          <FileiraEsqueleto />
          <FileiraEsqueleto />
          <FileiraEsqueleto />
        </>
      )}

      {!carregandoFilas && filas.length === 0 && links.filmes && (
        <div className="tela-vazio" role="status">
          <h2>Não foi possível montar o catálogo</h2>
          <p>Confira a conexão e recarregue a página. Os filmes e séries continuam no catálogo.</p>
        </div>
      )}
    </div>
  );
}
