/*
  QUEM OPERA O IMÓVEL — regras PURAS (sem imports @/).

  Pacote "Cadastro confiável", parte B (Daniel, 08/10/2026):
  • "É meu" — o dono anuncia o próprio imóvel.
  • "Opero por sublocação" — exige a AUTORIZAÇÃO ESCRITA do proprietário
    anexada para publicar. Antes era só uma caixinha.
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

/**
 * Valor de sublease_authorized a gravar. Imóvel próprio não tem sublocação
 * (o banco recusa own + true — migração 0200); tipo desconhecido vira "own".
 */
export function subleaseParaGravar(op: unknown, declarado: boolean | undefined): boolean {
  return operacaoValida(op) && op !== "own" ? declarado ?? false : false;
}

/**
 * As duas colunas da operação, pela regra de subleaseParaGravar. O updateProperty e o autosave do rascunho (59-C1)
 * gravam as duas juntas: uma linha antiga própria com sublocação marcada (a restrição da 0200 recusa QUALQUER
 * update dela) volta ao permitido na primeira gravação, em vez de o autosave falhar sempre.
 */
export function colunasDeOperacao(op: unknown, declarado: unknown): { ownership_type: Operacao; sublease_authorized: boolean } {
  return { ownership_type: operacaoValida(op) ? op : "own", sublease_authorized: subleaseParaGravar(op, declarado === true) };
}

/** O que anexar, por tipo de operação. */
export const DOC_AUTORIZACAO: Record<Exclude<Operacao, "own">, { titulo: string; declaracao: string; aviso: string }> = {
  subleased: {
    titulo: "Autorização escrita do proprietário para sublocar",
    declaracao: "Tenho autorização escrita do proprietário para sublocar este imóvel",
    aviso: "Para sublocar legalmente é preciso autorização escrita do proprietário. Anexe a autorização: sem ela o anúncio não é publicado.",
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

/** Tipo do documento anexado (coluna sublease_doc_tipo, 0234). Administrado exige contrato de gestão ou procuração. */
export type TipoDocOperacao = "autorizacao" | "contrato_gestao" | "procuracao";

export const TIPOS_DOC_GESTAO: { valor: Exclude<TipoDocOperacao, "autorizacao">; rotulo: string }[] = [
  { valor: "contrato_gestao", rotulo: "Contrato de administração" },
  { valor: "procuracao", rotulo: "Procuração" },
];

const tipoDeGestao = (t: unknown): t is Exclude<TipoDocOperacao, "autorizacao"> => t === "contrato_gestao" || t === "procuracao";

/** O tipo combina com a operação? Próprio e sublocação não pedem tipo; administrado só aceita os de gestão. */
export function tipoDocValido(op: string | null | undefined, tipo: unknown): boolean {
  return op === "managed" ? tipoDeGestao(tipo) : true;
}

/** Valor de sublease_doc_tipo a gravar: sublocação é sempre "autorizacao"; administrado, o tipo de gestão escolhido (ou nulo); próprio, nulo. */
export function tipoDocParaGravar(op: unknown, tipo: unknown): TipoDocOperacao | null {
  if (op === "subleased") return "autorizacao";
  if (op === "managed") return tipoDeGestao(tipo) ? tipo : null;
  return null;
}

/**
 * O documento da operação está em ordem? Próprio: sempre. Sublocação/administração:
 * declaração marcada + arquivo anexado NA PASTA DO PRÓPRIO DONO (nunca um link
 * externo, um preview local "blob:" ou o arquivo de outra conta).
 */
export function autorizacaoOk(p: {
  ownership_type?: string | null;
  sublease_authorized?: boolean | null;
  sublease_doc_url?: string | null;
  sublease_doc_tipo?: string | null;
  owner_id?: string | null;
}): boolean {
  if (!exigeAutorizacao(p.ownership_type)) return true;
  if (!p.sublease_authorized) return false;
  if (!tipoDocValido(p.ownership_type, p.sublease_doc_tipo)) return false;
  return caminhoDoDono(p.sublease_doc_url, p.owner_id);
}

/** Caminho no bucket privado dentro da pasta do dono: "<owner_id>/<arquivo>". */
export function caminhoDoDono(caminho: string | null | undefined, ownerId: string | null | undefined): boolean {
  if (!caminho || !ownerId) return false;
  if (/^(blob:|https?:|data:)/i.test(caminho) || caminho.includes("..")) return false;
  return caminho.startsWith(`${ownerId}/`) && caminho.length > ownerId.length + 1;
}
