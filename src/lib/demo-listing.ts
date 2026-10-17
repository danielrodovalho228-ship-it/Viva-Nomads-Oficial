/**
 * Detecção de ANÚNCIO DE EXEMPLO (ilustrativo) — fonte única.
 *
 * Os imóveis de amostra (`ube-001`…`ube-015` em `src/lib/properties.ts`) têm id
 * NÃO-UUID; todo imóvel real do banco tem id UUID. Usamos isso para:
 *   • marcar o anúncio com o selo "Exemplo ilustrativo" (honestidade);
 *   • mantê-lo FORA do Google (noindex + fora do sitemap);
 *   • NUNCA emitir JSON-LD de preço/avaliação para ele.
 *
 * Para sumir com os exemplos em produção (Opção A), basta
 * `NEXT_PUBLIC_SHOW_DEMO_PROPERTIES=false` na Vercel — aí nem aparecem.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isExemplo(idOrProperty: string | { id: string }): boolean {
  const id = typeof idOrProperty === "string" ? idOrProperty : idOrProperty.id;
  return !UUID_RE.test(id);
}

/** Anúncio de TESTE (título começa com "[TESTE]", ordem fa84ea52): fora do Google e do sitemap. */
export function ehAnuncioDeTeste(titulo: string | null | undefined): boolean {
  return /^\s*\[teste\]/i.test(titulo ?? "");
}

/** Mensagem única quando alguém tenta contato/candidatura num anúncio de exemplo. */
export const EXEMPLO_SEM_CONTATO =
  "Este é um anúncio de exemplo — candidaturas e contatos ficam disponíveis nos imóveis reais.";

/** Aviso único nos botões de reserva/mensagem de um anúncio de exemplo (demonstração: nada é gravado). */
export const EXEMPLO_AVISO_DEMO = "Anúncio de exemplo: esta solicitação não é enviada.";
