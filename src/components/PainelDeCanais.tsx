import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import type { Channel } from '../types/channel';
import { categoryOrder } from '../data/categorias';
import { ChannelIcon } from './ChannelIcon';
import { getCurrentProgram, onEPGUpdate } from '../services/epgService';
import { useDpad } from '../contexts/dpadContexto';
import { deveRenderizarMais, indiceParaRestaurar } from '../navegacao/nucleo';
import './PainelDeCanais.css';

interface PainelDeCanaisProps {
  channels: Channel[];
  activeChannelId: string | null;
  favorites: string[];
  isOpen: boolean;
  onClose: () => void;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  onSelectVariant?: (channel: Channel, variantIndex: number) => void;
  onOpenOtherScreen?: (channel: Channel) => void;
  isMultiScreen?: boolean;
  isMobileInline?: boolean;
  activeSide?: 'primary' | 'secondary';
  onSelectSide?: (side: 'primary' | 'secondary') => void;
  hasSecondChannel?: boolean;
}

interface LinhaDeCanalProps {
  channel: Channel;
  numero: number;
  noAr: boolean;
  isFav: boolean;
  onSelect: () => void;
  onFocar: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, channel: Channel) => void;
}

const LinhaDeCanal = memo(function LinhaDeCanal({
  channel,
  numero,
  noAr,
  isFav,
  onSelect,
  onFocar,
  onToggleFav,
  onContextMenu,
}: LinhaDeCanalProps) {
  const [prog, setProg] = useState(() => getCurrentProgram(channel.id));

  useEffect(() => {
    const atualizar = () => setProg(getCurrentProgram(channel.id));
    const unsub = onEPGUpdate(atualizar);
    return () => unsub();
  }, [channel.id]);

  const current = prog?.current;
  const progress = prog?.progress ?? 0;

  return (
    <div
      className={`painel-linha-canal ${noAr ? 'no-ar' : ''}`}
      onClick={onSelect}
      onFocus={onFocar}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }
      }}
      onContextMenu={(e) => onContextMenu(e, channel)}
      role="button"
      tabIndex={0}
      data-channel-id={channel.id}
      data-focusable="true"
      aria-current={noAr ? 'true' : undefined}
    >
      <span className={`painel-canal-numero ${noAr ? 'no-ar' : ''}`}>
        {numero}
      </span>

      <ChannelIcon channel={channel} size={46} />

      <div className="painel-canal-info">
        <span className="painel-canal-nome" title={channel.name}>
          {channel.name}
        </span>
        {current && (
          <>
            <span className="painel-canal-programa" title={current.title}>
              {current.title}
            </span>
            <div className="painel-canal-progresso-trilho">
              <div
                className="painel-canal-progresso-barra"
                style={{ width: `${Math.min(100, Math.max(0, Math.round(progress)))}%` }}
              />
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        className={`painel-btn-estrela ${isFav ? 'favorito' : ''}`}
        onClick={onToggleFav}
        title={isFav ? 'Remover dos favoritos' : 'Favoritar'}
        aria-label={isFav ? `Remover ${channel.name} dos favoritos` : `Favoritar ${channel.name}`}
        data-focusable="true"
        tabIndex={0}
      >
        <svg viewBox="0 0 24 24" fill={isFav ? '#facc15' : 'none'} stroke={isFav ? '#facc15' : 'currentColor'} strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
    </div>
  );
});

export const PainelDeCanais = memo(function PainelDeCanais({
  channels,
  activeChannelId,
  favorites,
  isOpen,
  onClose,
  onSelectChannel,
  onToggleFavorite,
  onSelectVariant,
  onOpenOtherScreen,
  isMultiScreen = false,
  isMobileInline = false,
  activeSide = 'primary',
  onSelectSide,
  hasSecondChannel = true,
}: PainelDeCanaisProps) {
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('Todos');
  const [menuContexto, setMenuContexto] = useState<{ x: number; y: number; channel: Channel } | null>(null);

  const listaRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const ultimoFocoRef = useRef<string | null>(null);
  const { setFocus, registerBackHandler, isEnabled: modoTv } = useDpad();

  // Mapeamento de números 1-indexed dos canais
  const numeros = useMemo(() => {
    const mapa = new Map<string, number>();
    channels.forEach((c, idx) => {
      mapa.set(c.id, idx + 1);
    });
    return mapa;
  }, [channels]);

  const activeChannelIndex = useMemo(() => {
    if (!activeChannelId) return null;
    return numeros.get(activeChannelId) ?? null;
  }, [activeChannelId, numeros]);

  // Fecha no Esc (site/computador; na TV quem fecha é o Voltar do D-pad).
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isMobileInline && !modoTv) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isMobileInline, onClose]);

  // Voltar (controle remoto) fecha a lista e devolve o foco ao player.
  useEffect(() => {
    if (!isOpen || isMobileInline) return;
    return registerBackHandler(() => {
      onClose();
      return true;
    });
  }, [isOpen, isMobileInline, onClose, registerBackHandler]);

  // Scroll até o canal ativo ao abrir (no toque, onde não existe foco do controle).
  useEffect(() => {
    if ((isOpen || isMobileInline) && activeChannelId && listaRef.current && !modoTv) {
      setTimeout(() => {
        const el = listaRef.current?.querySelector(`[data-channel-id="${activeChannelId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isMobileInline, activeChannelId]);

  // Fecha menu de contexto ao clicar fora
  useEffect(() => {
    const handleOutsideClick = () => setMenuContexto(null);
    if (menuContexto) {
      window.addEventListener('click', handleOutsideClick);
      return () => window.removeEventListener('click', handleOutsideClick);
    }
  }, [menuContexto]);

  const handleContextMenu = useCallback((e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuContexto({
      x: Math.min(e.clientX, window.innerWidth - 240),
      y: Math.min(e.clientY, window.innerHeight - 200),
      channel,
    });
  }, []);

  // Tecla Menu/Info do controle: abre as ações do canal em foco (fontes e favoritos).
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    const aoPedirOpcoes = (evento: Event) => {
      const alvo = evento.target as HTMLElement | null;
      const linha = alvo?.closest<HTMLElement>('[data-channel-id]');
      const id = linha?.getAttribute('data-channel-id');
      const canal = id ? channels.find((c) => c.id === id) : null;
      if (!linha || !canal) return;
      const r = linha.getBoundingClientRect();
      setMenuContexto({
        x: Math.min(r.left + 24, window.innerWidth - 260),
        y: Math.min(r.top + 12, window.innerHeight - 220),
        channel: canal,
      });
    };
    aside.addEventListener('dpad-opcoes', aoPedirOpcoes);
    return () => aside.removeEventListener('dpad-opcoes', aoPedirOpcoes);
  }, [channels]);

  // Categorias disponíveis
  const categorias = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    const ordenadas = categoryOrder.filter((cat) => set.has(cat));
    const extras = [...set].filter((cat) => !categoryOrder.includes(cat)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['Todos', 'Favoritos', ...ordenadas, ...extras];
  }, [channels]);

  // Canais filtrados e agrupados
  const canaisFiltrados = useMemo(() => {
    let result = channels;

    if (categoriaAtiva === 'Favoritos') {
      result = result.filter((ch) => favorites.includes(ch.id));
    } else if (categoriaAtiva !== 'Todos') {
      result = result.filter((ch) => ch.category === categoriaAtiva);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase();
      result = result.filter(
        (ch) => ch.name.toLowerCase().includes(q) || ch.category?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [channels, categoriaAtiva, busca, favorites]);

  const indiceFiltrado = useMemo(() => {
    const mapa = new Map<string, number>();
    canaisFiltrados.forEach((c, i) => mapa.set(c.id, i));
    return mapa;
  }, [canaisFiltrados]);

  const CHUNK_SIZE = 40;

  // Lazy Loading / Renderização progressiva para não travar Smart TVs fracas
  const [renderLimit, setRenderLimit] = useState<number>(() => {
    if (activeChannelId) {
      const idx = channels.findIndex((c) => c.id === activeChannelId);
      if (idx >= 0) return Math.min(channels.length, Math.max(CHUNK_SIZE, idx + 15));
    }
    return CHUNK_SIZE;
  });

  // Reseta ou ajusta limite ao mudar categoria ou busca
  useEffect(() => {
    if (activeChannelId && categoriaAtiva === 'Todos' && !busca.trim()) {
      const idx = channels.findIndex((c) => c.id === activeChannelId);
      if (idx >= 0) {
        setRenderLimit(Math.min(channels.length, Math.max(CHUNK_SIZE, idx + 15)));
        return;
      }
    }
    setRenderLimit((atual) => Math.min(canaisFiltrados.length, Math.max(CHUNK_SIZE, atual)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaAtiva, busca, activeChannelId, channels]);

  const carregarMais = useCallback(() => {
    setRenderLimit((prev) => {
      if (prev >= canaisFiltrados.length) return prev;
      return Math.min(canaisFiltrados.length, prev + CHUNK_SIZE);
    });
  }, [canaisFiltrados.length]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollHeight - (el.scrollTop + el.clientHeight) < 450) {
        carregarMais();
      }
    },
    [carregarMais]
  );

  const sentinelaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinela = sentinelaRef.current;
    if (!sentinela || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          carregarMais();
        }
      },
      { root: listaRef.current, rootMargin: '350px' }
    );

    observer.observe(sentinela);
    return () => observer.disconnect();
  }, [carregarMais, canaisFiltrados.length, renderLimit]);

  // Canais realmente desenhados no DOM nesta rodada
  const canaisVisiveis = useMemo(() => {
    if (canaisFiltrados.length <= renderLimit) return canaisFiltrados;
    return canaisFiltrados.slice(0, renderLimit);
  }, [canaisFiltrados, renderLimit]);

  const grupos = useMemo(() => {
    if (categoriaAtiva !== 'Todos' && categoriaAtiva !== 'Favoritos') {
      return [{ categoria: categoriaAtiva, canais: canaisVisiveis }];
    }
    const mapa = new Map<string, Channel[]>();
    canaisVisiveis.forEach((c) => {
      const cat = c.category || 'Outros';
      const arr = mapa.get(cat) || [];
      arr.push(c);
      mapa.set(cat, arr);
    });

    const out: { categoria: string; canais: Channel[] }[] = [];
    categoryOrder.forEach((cat) => {
      const list = mapa.get(cat);
      if (list && list.length > 0) {
        out.push({ categoria: cat, canais: list });
        mapa.delete(cat);
      }
    });

    const restantes = [...mapa.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    restantes.forEach((cat) => {
      const list = mapa.get(cat);
      if (list && list.length > 0) out.push({ categoria: cat, canais: list });
    });

    return out;
  }, [canaisVisiveis, categoriaAtiva]);

  const handleCategoryClick = (cat: string) => {
    setCategoriaAtiva(cat);
    if (cat === 'Todos' || cat === 'Favoritos') {
      listaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setTimeout(() => {
        const header = listaRef.current?.querySelector(`[data-cat-header="${cat}"]`);
        if (header) {
          header.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  /** Perto do fim do que está desenhado, o próximo bloco de canais já entra. */
  const aoFocarCanal = useCallback((id: string) => {
    ultimoFocoRef.current = id;
    const indice = indiceFiltrado.get(id) ?? 0;
    if (deveRenderizarMais(indice, Math.min(renderLimit, canaisFiltrados.length), canaisFiltrados.length)) {
      carregarMais();
    }
  }, [carregarMais, canaisFiltrados.length, indiceFiltrado, renderLimit]);

  /**
   * O foco da lista, na TV: ao abrir, volta ao canal onde estava (ou o canal no
   * ar); ao trocar filtro ou buscar, fica num item que ainda existe. Nunca fica
   * sem foco nem foca um canal que sumiu da lista.
   */
  const aberto = isOpen || isMobileInline;
  useEffect(() => {
    if (!aberto || !modoTv) return;
    const atual = document.activeElement as HTMLElement | null;
    const idAtual = atual?.getAttribute('data-channel-id') ?? null;
    const focoNaLista = !!atual?.classList.contains('painel-linha-canal') && atual.isConnected;
    // O foco da lista continua num canal que existe: nada a fazer.
    if (focoNaLista && idAtual && indiceFiltrado.has(idAtual)) return;
    // O foco está num campo/pílula do painel (digitando a busca, trocando filtro):
    // não roubar o foco de quem está usando.
    if (!focoNaLista && atual && asideRef.current?.contains(atual)) return;

    const ids = canaisFiltrados.map((c) => c.id);
    if (!ids.length) return;
    const indice = indiceParaRestaurar(ids, ultimoFocoRef.current, activeChannelId);
    if (indice < 0) return;
    if (indice >= renderLimit) {
      setRenderLimit(Math.min(canaisFiltrados.length, indice + 15));
      return;
    }
    const alvo = listaRef.current?.querySelector<HTMLElement>(`[data-channel-id="${ids[indice]}"]`);
    if (alvo) setFocus(alvo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, categoriaAtiva, busca, canaisFiltrados, renderLimit, modoTv]);

  const fraseRodape = modoTv
    ? 'OK assiste · Menu/Info: fontes e favoritos · Voltar fecha a lista'
    : 'Clique assiste · botão direito: fontes e favoritos · ⌘↑ ⌘↓ trocam de canal';

  if (!isOpen && !isMobileInline) return null;

  return (
    <aside
      ref={asideRef}
      className={`painel-de-canais-container ${isMobileInline ? 'mobile-inline' : ''}`}
      aria-label="Painel de Canais"
      data-dpad-camada={isMobileInline ? undefined : 'canais'}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Topo do painel */}
      <div className="painel-topo">
        <h2 className="painel-titulo">Canais</h2>
        <div className="painel-topo-direita">
          {activeChannelIndex !== null && (
            <span className="painel-numero-ativo">{activeChannelIndex}</span>
          )}
          <span className="painel-contagem-total">{channels.length}</span>
          {!isMobileInline && (
            <button
              type="button"
              className="painel-btn-fechar"
              onClick={onClose}
              title="Fechar a lista (Esc)"
              aria-label="Fechar"
              data-fechar="true"
              data-focusable="true"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Seletor de Tela quando em Multi-Tela */}
      {isMultiScreen && onSelectSide && (
        <div className="painel-seletor-tela" role="tablist" aria-label="Escolher tela para o canal">
          <button
            type="button"
            className={`painel-btn-tela ${activeSide === 'primary' ? 'ativo' : ''}`}
            onClick={() => onSelectSide('primary')}
            title="Escolher canal para a Tela 1"
            data-focusable="true"
          >
            <span className="painel-tela-ponto" />
            <span>Tela 1</span>
          </button>
          <button
            type="button"
            className={`painel-btn-tela ${activeSide === 'secondary' ? 'ativo' : ''}`}
            onClick={() => onSelectSide('secondary')}
            title="Escolher canal para a Tela 2"
            data-focusable="true"
          >
            <span className="painel-tela-ponto" />
            <span>Tela 2</span>
            {!hasSecondChannel && <span className="painel-tela-aviso">escolha</span>}
          </button>
        </div>
      )}

      {/* Caixa de Busca */}
      <div className="painel-busca-box">
        <svg className="painel-busca-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={buscaRef}
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar canal"
          className="painel-busca-input"
          aria-label="Buscar canal"
        />
        {busca && (
          <button
            type="button"
            className="painel-busca-limpar"
            onClick={() => { setBusca(''); buscaRef.current?.focus(); }}
            title="Limpar busca"
            aria-label="Limpar busca"
            data-focusable="true"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" opacity="0.3" />
              <path d="m15 9-6 6M9 9l6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Pílulas de Categoria horizontais */}
      <div className="painel-pilulas-scroll">
        {categorias.map((cat) => {
          const ativa = categoriaAtiva === cat;
          return (
            <button
              key={cat}
              type="button"
              className={`painel-pilula ${ativa ? 'ativa' : ''}`}
              onClick={() => handleCategoryClick(cat)}
              data-focusable="true"
              aria-pressed={ativa}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Lista de Canais com grupos */}
      <div className="painel-lista-rolagem" ref={listaRef} onScroll={handleScroll}>
        {grupos.length === 0 ? (
          <div className="painel-vazio">Nenhum canal encontrado</div>
        ) : (
          grupos.map((grupo) => (
            <div key={grupo.categoria} className="painel-grupo-secao">
              <div className="painel-grupo-titulo" data-cat-header={grupo.categoria}>
                {grupo.categoria.toUpperCase()}
              </div>
              <div className="painel-grupo-linhas">
                {grupo.canais.map((c) => (
                  <LinhaDeCanal
                    key={c.id}
                    channel={c}
                    numero={numeros.get(c.id) || 0}
                    noAr={c.id === activeChannelId}
                    isFav={favorites.includes(c.id)}
                    onSelect={() => onSelectChannel(c)}
                    onFocar={() => aoFocarCanal(c.id)}
                    onToggleFav={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(c.id);
                    }}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            </div>
          ))
        )}
        {canaisVisiveis.length < canaisFiltrados.length && (
          <div ref={sentinelaRef} className="painel-carregando-mais">
            <span>Carregando mais canais…</span>
          </div>
        )}
      </div>

      {/* Rodapé explicativo */}
      <div className="painel-rodape">{fraseRodape}</div>

      {/* Menu de Contexto (botão direito / tecla Menu) */}
      {menuContexto && (
        <div
          className="painel-menu-contexto"
          style={{ top: menuContexto.y, left: menuContexto.x }}
          onClick={(e) => e.stopPropagation()}
          data-dpad-camada="menu-canal"
          role="menu"
          aria-label={`Ações de ${menuContexto.channel.name}`}
        >
          {menuContexto.channel.sources && menuContexto.channel.sources.length > 1 && (
            <div className="painel-menu-item-com-submenu">
              <div className="painel-menu-item">
                <span>Escolher Fonte</span>
                <span className="painel-menu-seta">›</span>
              </div>
              <div className="painel-submenu">
                {menuContexto.channel.sources.map((src, sIdx) => {
                  // Sem o servidor: só o nome/número e a qualidade.
                  const rotulo = [
                    src.name || `Fonte ${sIdx + 1}`,
                    src.quality && src.quality !== 'Qualidade não informada' ? src.quality : null,
                  ].filter(Boolean).join(' · ');

                  return (
                    <button
                      key={src.url + sIdx}
                      className="painel-submenu-item"
                      data-focusable="true"
                      onClick={() => {
                        onSelectVariant?.(menuContexto.channel, sIdx);
                        setMenuContexto(null);
                      }}
                    >
                      {rotulo}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            className="painel-menu-item"
            data-focusable="true"
            onClick={() => {
              onToggleFavorite(menuContexto.channel.id);
              setMenuContexto(null);
            }}
          >
            {favorites.includes(menuContexto.channel.id) ? 'Remover dos favoritos' : 'Favoritar'}
          </button>

          {isMultiScreen && onOpenOtherScreen && (
            <button
              className="painel-menu-item"
              data-focusable="true"
              onClick={() => {
                onOpenOtherScreen(menuContexto.channel);
                setMenuContexto(null);
              }}
            >
              {activeSide === 'secondary' ? 'Abrir na Tela 1' : 'Abrir na Tela 2'}
            </button>
          )}

          <button
            className="painel-menu-item"
            data-focusable="true"
            data-fechar="true"
            onClick={() => setMenuContexto(null)}
          >
            Fechar menu
          </button>
        </div>
      )}
    </aside>
  );
});

