/**
 * Carrega módulos TypeScript nos testes do Node, sem bundler.
 *
 * O Node 22.13+ sabe tirar os tipos de um arquivo `.ts` (`stripTypeScriptTypes`),
 * mas não resolve `import './vizinho'` sem extensão. Aqui os módulos pedidos são
 * copiados para uma pasta temporária como `.mjs`, com os imports relativos
 * apontando para as cópias — inclusive imports circulares (modo ↔ tv).
 *
 * `import.meta.env` (que só existe dentro do Vite) vira um objeto global, para
 * os módulos que leem configuração de build carregarem sem quebrar.
 */
import { stripTypeScriptTypes } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const pasta = mkdtempSync(join(tmpdir(), 'hypeou-ts-'));
const registros = new Map();

globalThis.__IMPORT_META_ENV__ = { PROD: false, DEV: true, BASE_URL: '/', MODE: 'test', VITE_TV: undefined, VITE_PROXY_BASE: undefined };

const IMPORTACAO_RELATIVA = /(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.[^'"]+)\2/g;

function arquivoDe(spec, deArquivo) {
  const base = resolve(dirname(deArquivo), spec);
  for (const candidato of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      readFileSync(candidato);
      return candidato;
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

function visitar(arquivo) {
  const existente = registros.get(arquivo);
  if (existente) return existente;
  const registro = { nome: `m${registros.size}-${basename(arquivo).replace(/\.tsx?$/, '')}.mjs`, codigo: '' };
  registros.set(arquivo, registro);

  let codigo = stripTypeScriptTypes(readFileSync(arquivo, 'utf8'), { mode: 'strip' });
  codigo = codigo.replace(/import\.meta\.env/g, 'globalThis.__IMPORT_META_ENV__');
  codigo = codigo.replace(IMPORTACAO_RELATIVA, (trecho, prefixo, aspas, spec) => {
    const alvo = arquivoDe(spec, arquivo);
    if (!alvo) return trecho;
    const dependencia = visitar(alvo);
    return `${prefixo}${aspas}./${dependencia.nome}${aspas}`;
  });
  registro.codigo = codigo;
  return registro;
}

/** Importa um módulo do projeto (caminho relativo à raiz) já sem os tipos. */
export async function carregar(caminho) {
  const registro = visitar(resolve(process.cwd(), caminho));
  for (const item of registros.values()) {
    writeFileSync(join(pasta, item.nome), item.codigo);
  }
  return import(pathToFileURL(join(pasta, registro.nome)).href);
}
