/**
 * Resposta única da API do admin para quem não é admin (ordem 12a8086d, item 1): 404 "Não encontrado.",
 * igual às páginas /admin. A rota não revela que existe; sem cache. Response padrão da Web (vale em Route Handler).
 */
export function respostaNaoAdmin(): Response {
  return Response.json({ erro: "Não encontrado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
}
