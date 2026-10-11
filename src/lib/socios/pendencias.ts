/*
  Seção "Pendências" do /socios (ordem bd296d53, item 5): a MESMA lista que o Daniel aprova
  (public.aprovacoes, status pendente). Puro: sem banco. Sem dado pessoal — só tipo, referência,
  resumo curto (CPF, e-mail e telefone mascarados) e risco.
*/

export interface LinhaPendencia {
  tipo: string;
  referencia: string;
  resumo: string;
  risco: string;
  status: string;
  expira_em: string;
}

export interface Pendencia {
  tipo: string;
  referencia: string;
  resumo: string;
  risco: "baixo" | "medio" | "alto";
}

const TIPOS: Record<string, string> = {
  merge_pr: "Mesclar PR",
  migracao: "Migração",
  decisao: "Decisão",
  documento: "Documento",
};

const MAX_RESUMO = 160;

function limpar(texto: string): string {
  const s = texto
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ]")
    .replace(/\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, "[telefone]")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > MAX_RESUMO ? `${s.slice(0, MAX_RESUMO - 1)}…` : s;
}

export function pendenciasParaSocios(linhas: LinhaPendencia[] | null, agora: Date): Pendencia[] {
  return (linhas ?? [])
    .filter((l) => l.status === "pendente" && new Date(l.expira_em).getTime() > agora.getTime())
    .map((l) => ({
      tipo: TIPOS[l.tipo] ?? "Aprovação",
      referencia: limpar(l.referencia).slice(0, 60),
      resumo: limpar(l.resumo),
      risco: l.risco === "alto" || l.risco === "baixo" ? l.risco : "medio",
    }));
}
