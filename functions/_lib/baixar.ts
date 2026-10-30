/**
 * Os atalhos antigos de download ficam temporariamente desativados.
 * Não redirecionar para releases antigas ou APKs da marca anterior.
 * Quando os novos instaladores estiverem prontos, os links serão configurados aqui.
 */
export function atalho(_plataforma: string) {
  return async ({ request }: { request: Request }): Promise<Response> => {
    return Response.redirect(new URL('/app', request.url).toString(), 302);
  };
}
