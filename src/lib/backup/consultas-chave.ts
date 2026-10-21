/*
  Resiliência 2 — as 5 consultas-chave do teste de restauração (puro). Cada uma devolve só true/false ("achou ao menos
  um registro com as ligações"), nunca uma linha. A cópia noturna roda as mesmas em produção e guarda o resultado no
  manifesto; o teste de restauração exige que, no banco restaurado, cada uma responda (sem erro) e ache o que a
  produção achava. Assim um vínculo quebrado (fotos sem imóvel, assinatura sem contrato) fica vermelho.
*/

export const CONSULTAS_CHAVE = {
  contrato:
    "select exists (select 1 from public.contratos c where exists (select 1 from public.contrato_assinaturas a where a.contrato_id = c.id) and exists (select 1 from public.pagamentos_bloco p where p.contrato_id = c.id))",
  conferencia:
    "select exists (select 1 from public.conferencias c join public.conferencia_respostas r on r.conferencia_id = c.id)",
  imovel: "select exists (select 1 from public.properties p join public.property_photos f on f.property_id = p.id)",
  perfil: "select exists (select 1 from public.profiles p join auth.users u on u.id = p.id)",
  proposta:
    "select exists (select 1 from public.propostas x join public.leads l on l.id = x.lead_id join public.properties p on p.id = x.property_id)",
} as const;

export type NomeConsultaChave = keyof typeof CONSULTAS_CHAVE;

export const ROTULO_CONSULTA: Record<NomeConsultaChave, string> = {
  contrato: "um contrato com assinaturas e pagamentos",
  conferencia: "uma conferência com respostas",
  imovel: "um imóvel com fotos",
  perfil: "um perfil",
  proposta: "uma proposta",
};

/** Uma linha de psql com as 5 respostas, na ordem das chaves: "t|f|t|t|f". */
export function sqlTodasConsultas(): string {
  return `select ${Object.values(CONSULTAS_CHAVE)
    .map((q) => `(${q})`)
    .join(", ")}`;
}

/** Lê a saída de `psql -At -F'|'` de sqlTodasConsultas(). */
export function lerRespostas(saida: string): Record<NomeConsultaChave, boolean> {
  const partes = saida.trim().split("|");
  const nomes = Object.keys(CONSULTAS_CHAVE) as NomeConsultaChave[];
  if (partes.length !== nomes.length || partes.some((p) => p !== "t" && p !== "f")) throw new Error("consultas-chave: resposta fora do formato");
  return Object.fromEntries(nomes.map((n, i) => [n, partes[i] === "t"])) as Record<NomeConsultaChave, boolean>;
}
