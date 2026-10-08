/*
  QUEM OPERA O IMÓVEL — regras PURAS (sem imports @/).

  Pacote "Cadastro confiável", parte B (Daniel, 08/10/2026):
  • "É meu" — o dono anuncia o próprio imóvel.
  • "Opero por sublocação" — exige a AUTORIZAÇÃO ESCRITA do proprietário
    (art. 13 da Lei 8.245/91) anexada para publicar. Antes era só uma caixinha.
  • "Administro para o proprietário" (gestor/procurador) — exige o CONTRATO DE
    ADMINISTRAÇÃO ou a PROCURAÇÃO anexada para publicar.
  O documento vai para o bucket privado (pasta do próprio dono) e aparece para
  o Daniel na conferência do imóvel. Quem aprova é sempre uma pessoa.
*/

export type Operacao = "own" | "subleased" | "managed";

export const OPERACOES: { valor: Operacao; rotulo: string }[] = [
  { valor: "own", rotulo: "É meu (próprio)" },
  { valor: "subleased", rotulo: "Opero por sublocação" },
  { valor: "managed", rotulo: "Administro para o proprietário" },
];

export function operacaoValida(v: unknown): v is Operacao {
  return v === "own" || v === "subleased" || v === "managed";
}

export const exigeAutorizacao = (op: string | null | undefined) => op === "subleased" || op === "managed";

/** O que anexar, por tipo de operação. */
export const DOC_AUTORIZACAO: Record<Exclude<Operacao, "own">, { titulo: string; declaracao: string; aviso: string }> = {
  subleased: {
    titulo: "Autorização escrita do proprietário para sublocar",
    declaracao: "Tenho autorização escrita do proprietário para sublocar este imóvel",
    aviso: "Para sublocar legalmente é preciso autorização escrita do proprietário (art. 13 da Lei 8.245/91). Anexe a autorização: sem ela o anúncio não é publicado.",
  },
  managed: {
    titulo: "Contrato de administração ou procuração",
    declaracao: "Administro este imóvel em nome do proprietário (gestor ou procurador)",
    aviso: "Para anunciar em nome do proprietário, anexe o contrato de administração ou a procuração que dá esse poder a você. Sem ele o anúncio não é publicado.",
  },
};

export const ROTULO_FALTA_AUTORIZACAO: Record<Exclude<Operacao, "own">, string> = {
  subleased: "Autorização de sublocação",
  managed: "Contrato de administração ou procuração",
};

/**
 * O documento da operação está em ordem? Próprio: sempre. Sublocação/administração:
 * declaração marcada + arquivo anexado NA PASTA DO PRÓPRIO DONO (nunca um link
 * externo, um preview local "blob:" ou o arquivo de outra conta).
 */
export function autorizacaoOk(p: {
  ownership_type?: string | null;
  sublease_authorized?: boolean | null;
  sublease_doc_url?: string | null;
  owner_id?: string | null;
}): boolean {
  if (!exigeAutorizacao(p.ownership_type)) return true;
  if (!p.sublease_authorized) return false;
  return caminhoDoDono(p.sublease_doc_url, p.owner_id);
}

/** Caminho no bucket privado dentro da pasta do dono: "<owner_id>/<arquivo>". */
export function caminhoDoDono(caminho: string | null | undefined, ownerId: string | null | undefined): boolean {
  if (!caminho || !ownerId) return false;
  if (/^(blob:|https?:|data:)/i.test(caminho) || caminho.includes("..")) return false;
  return caminho.startsWith(`${ownerId}/`) && caminho.length > ownerId.length + 1;
}
