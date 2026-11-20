/*
  E690 — ativação AUTOMÁTICA do avaliador credenciado (regra validada pelo coordenador, 08/11/2026). PURO (node --test).
    1) "solicitado" → "em_teste" sozinho, quando TODOS os critérios batem: identidade verificada, CPF da pessoa verificada
       é titular ou sócio do CNPJ, experiência comprovada, código de conduta aceito e cidade informada;
    2) "em_teste" → "ativo" sozinho, quando a avaliação-teste foi concluída (laudo emitido num pedido de teste) E passou na
       conferência (resultado "aprovado", nada pendente na fila do admin) E a identidade segue verificada.
  Cada passo grava "decidido pelo sistema" com os critérios do momento. NÃO existe atalho que dispense a identidade
  (UDI-001 segue a mesma regra). Quando um critério não pode ser verificado (null), nada avança: fica para o admin.
*/
import { CODIGO_CONDUTA } from "./regras.ts";

export const DECIDIDO_PELO_SISTEMA = "Decidido pelo sistema";

export interface CriteriosEmTeste {
  identidadeVerificada: boolean;
  /** true/false = conferido; null = não dá para conferir (sem fornecedor do quadro societário em conta real). */
  cpfTitularOuSocio: boolean | null;
  experiencia: boolean;
  condutaAceita: boolean;
  cidade: boolean;
}

export interface CriteriosAtivar {
  testeConcluido: boolean;
  /** Laudo do teste com resultado "aprovado" e nada aberto na fila do admin para este avaliador. */
  conferenciaPassou: boolean;
  identidadeVerificada: boolean;
}

const ROTULOS_EM_TESTE: Record<keyof CriteriosEmTeste, string> = {
  identidadeVerificada: "identidade verificada",
  cpfTitularOuSocio: "CPF verificado é titular ou sócio do CNPJ",
  experiencia: "experiência comprovada",
  condutaAceita: "código de conduta aceito",
  cidade: "cidade informada",
};
const ROTULOS_ATIVAR: Record<keyof CriteriosAtivar, string> = {
  testeConcluido: "avaliação de teste concluída",
  conferenciaPassou: "aprovada na conferência",
  identidadeVerificada: "identidade verificada",
};

export type Decisao = { ok: true } | { ok: false; falta: string[] };

export function decidirEmTeste(c: CriteriosEmTeste): Decisao {
  const falta = (Object.keys(ROTULOS_EM_TESTE) as (keyof CriteriosEmTeste)[]).filter((k) => c[k] !== true).map((k) => ROTULOS_EM_TESTE[k]);
  return falta.length ? { ok: false, falta } : { ok: true };
}

export function decidirAtivo(c: CriteriosAtivar): Decisao {
  const falta = (Object.keys(ROTULOS_ATIVAR) as (keyof CriteriosAtivar)[]).filter((k) => c[k] !== true).map((k) => ROTULOS_ATIVAR[k]);
  return falta.length ? { ok: false, falta } : { ok: true };
}

/** O registro que fica no credenciamento: quem decidiu, o motivo legível (≤ 500) e os critérios do momento. */
export function registroDoSistema(etapa: "em_teste" | "ativo", criterios: CriteriosEmTeste | CriteriosAtivar, fontes: { identidade: "real" | "simulada"; cpf?: "real" | "simulada" }, agora: Date) {
  const rotulos: Record<string, string> = etapa === "em_teste" ? ROTULOS_EM_TESTE : ROTULOS_ATIVAR;
  const itens = Object.keys(rotulos).map((k) => `${rotulos[k]}${k === "identidadeVerificada" && fontes.identidade === "simulada" ? " (simulada, conta de teste)" : ""}${k === "cpfTitularOuSocio" && fontes.cpf === "simulada" ? " (simulado, conta de teste)" : ""}`);
  const quando = agora.toISOString().slice(0, 10);
  const motivo = `${DECIDIDO_PELO_SISTEMA} em ${quando} (${etapa === "em_teste" ? "aprovação automática para teste" : "ativação automática"}). Critérios: ${itens.join("; ")}.`.slice(0, 500);
  return { motivo, decididoPeloSistema: true as const, criterios: { etapa, em: agora.toISOString(), conduta: etapa === "em_teste" ? CODIGO_CONDUTA.versao : undefined, fontes, ...criterios } };
}
