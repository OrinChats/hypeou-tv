/**
 * Texto de uma lista, venha ele como vier.
 *
 * O catálogo publicado no Worker pode chegar como texto puro ou embrulhado numa
 * página HTML (o texto dentro de `<pre>`, com `&` escrito `&amp;`). Esta função
 * devolve sempre o texto do catálogo, pronto para o parser: sem etiquetas, sem
 * entidades HTML e sem cercas de código Markdown.
 */

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function decodificar(texto: string): string {
  if (!texto.includes('&')) return texto;
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteira, ref: string) => {
    if (ref[0] === '#') {
      const codigo = ref[1].toLowerCase() === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      try { return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : inteira; } catch { return inteira; }
    }
    return ENTIDADES[ref.toLowerCase()] ?? inteira;
  });
}

const PARECE_HTML = /^\s*(?:<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<pre[\s>])/i;

export function textoDaLista(bruto: string): string {
  let texto = bruto.replace(/^\uFEFF/, '');

  if (PARECE_HTML.test(texto)) {
    // O catálogo mora dentro de <pre>; sem <pre>, vale o <body> inteiro.
    const pre = texto.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    const corpo = pre ? pre[1] : (texto.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? texto);
    texto = decodificar(
      corpo
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ''),
    );
  }

  return texto
    .split(/\r?\n/)
    .filter((linha) => !/^\s*```/.test(linha))
    .join('\n');
}
