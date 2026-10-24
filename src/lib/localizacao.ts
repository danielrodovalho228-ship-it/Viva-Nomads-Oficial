/**
 * E101: a linha de localização PÚBLICA de um imóvel — "Santa Mônica, Uberlândia - MG". Junta só o que existe, sem
 * separador sobrando: sem UF sai "Santa Mônica, Uberlândia" (nunca "Uberlândia -"); sem bairro, "Uberlândia - MG".
 * Fonte única para a página do imóvel, os cartões, os parecidos, o mapa, o JSON-LD e os e-mails.
 */
export function linhaLocalizacao(bairro?: string | null, cidade?: string | null, uf?: string | null): string {
  const lugar = [bairro, cidade].map((t) => (t ?? "").trim()).filter(Boolean).join(", ");
  const estado = (uf ?? "").trim().toUpperCase();
  return [lugar, estado].filter(Boolean).join(" - ");
}
