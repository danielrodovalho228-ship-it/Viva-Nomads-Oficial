/*
  AVALIAÇÕES QUE EU RECEBI (PERFIL-B; mockup perfil-02-avaliacoes) — regras PURAS.
  A tela da conta lista as avaliações PUBLICADAS que a pessoa recebeu de proprietários e de moradores, com as abas
  Todas / Recentes / Positivas e a busca. Os dados vêm de src/lib/data/avaliacoes-recebidas.ts (avaliacoes.alvo_id).
*/

export interface AvaliacaoRecebida {
  id: string;
  /** "Carlos M." — nunca o nome inteiro. */
  autorNome: string;
  autorFotoUrl: string | null;
  /** Quem escreveu: o proprietário (sobre o morador) ou o morador (sobre o proprietário). */
  papelAutor: "proprietario" | "inquilino";
  nota: number;
  comentario: string;
  /** ISO da publicação. */
  publicadaEm: string | null;
  imovelTitulo: string | null;
  cidade: string | null;
  /** A resposta pública já dada (avaliacao_respostas); null = ainda dá para responder. */
  resposta: string | null;
}

export const ABAS_AVALIACOES = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "recentes", rotulo: "Recentes" },
  { valor: "positivas", rotulo: "Positivas" },
] as const;
export type AbaAvaliacoes = (typeof ABAS_AVALIACOES)[number]["valor"];

/** "Recentes" = publicadas nos últimos 90 dias. */
export const DIAS_RECENTES = 90;
/** "Positivas" = nota 4 ou 5. */
export const NOTA_POSITIVA = 4;

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Aba + busca (no comentário, no nome de quem avaliou, no imóvel e na cidade), sempre da mais nova para a mais antiga. */
export function filtrarAvaliacoes(
  lista: AvaliacaoRecebida[],
  { aba, busca, agora = Date.now() }: { aba: AbaAvaliacoes; busca?: string; agora?: number }
): AvaliacaoRecebida[] {
  const limite = agora - DIAS_RECENTES * 86_400_000;
  const termo = semAcento((busca ?? "").trim());
  return lista
    .filter((a) => (aba === "positivas" ? a.nota >= NOTA_POSITIVA : true))
    .filter((a) => (aba === "recentes" ? !!a.publicadaEm && Date.parse(a.publicadaEm) >= limite : true))
    .filter((a) => !termo || semAcento([a.comentario, a.autorNome, a.imovelTitulo ?? "", a.cidade ?? ""].join(" ")).includes(termo))
    .sort((x, y) => (Date.parse(y.publicadaEm ?? "") || 0) - (Date.parse(x.publicadaEm ?? "") || 0));
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Linha de baixo do cartão: "Recebida em 12 out 2024 · Casa no Santa Mônica · Uberlândia". Sem dado, a parte some. */
export function linhaContextoAvaliacao(a: Pick<AvaliacaoRecebida, "publicadaEm" | "imovelTitulo" | "cidade">): string {
  const partes: string[] = [];
  const d = a.publicadaEm ? new Date(a.publicadaEm) : null;
  if (d && !Number.isNaN(d.getTime())) partes.push(`Recebida em ${String(d.getUTCDate()).padStart(2, "0")} ${MESES_CURTOS[d.getUTCMonth()]} ${d.getUTCFullYear()}`);
  if (a.imovelTitulo) partes.push(a.imovelTitulo);
  if (a.cidade) partes.push(a.cidade);
  return partes.join(" · ");
}

/** Média e quantidade, para o topo da tela (mesma conta da reputação pública). */
export function resumoAvaliacoes(lista: AvaliacaoRecebida[]): { media: number; n: number; semResposta: number } {
  const n = lista.length;
  const media = n ? Math.round((lista.reduce((s, a) => s + a.nota, 0) / n) * 10) / 10 : 0;
  return { media, n, semResposta: lista.filter((a) => !a.resposta).length };
}
