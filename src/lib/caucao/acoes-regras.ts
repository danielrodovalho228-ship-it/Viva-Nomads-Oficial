import { PRAZO_CONTESTACAO_DIAS, addDias, prazosDaSaida } from "./prazos.ts";

/* E637 (b) — regras puras das ações (as datas são AAAA-MM-DD, calendário de Brasília). */

/** O dono dá o parecer uma vez, depois do check-out e até o dia 7 (inclusive). Depois disso vale a liberação integral. */
export function podeDarParecer(f: { saida: string; parecerEm: string | null; hoje: string }): { ok: true } | { ok: false; motivo: string } {
  if (f.parecerEm) return { ok: false, motivo: "Você já deu o parecer deste contrato." };
  if (f.hoje < f.saida) return { ok: false, motivo: "O parecer só abre depois do check-out." };
  if (f.hoje > prazosDaSaida(f.saida).parecerAte) return { ok: false, motivo: "O prazo de 7 dias passou: vale a liberação integral da caução." };
  return { ok: true };
}

/** O morador contesta cada item em até 5 dias corridos do parecer. */
export function podeContestar(f: { parecerEm: string | null; hoje: string; item: { status: string } }): { ok: true } | { ok: false; motivo: string } {
  if (!f.parecerEm) return { ok: false, motivo: "O proprietário ainda não deu o parecer." };
  if (f.item.status === "contestado") return { ok: false, motivo: "Este item já foi contestado." };
  if (f.hoje > addDias(f.parecerEm, PRAZO_CONTESTACAO_DIAS)) return { ok: false, motivo: "O prazo de 5 dias para contestar passou." };
  return { ok: true };
}

/** O comprovante do desconto fica na pasta de quem envia (a mesma regra dos outros arquivos do contrato). */
export function caminhoDeComprovanteValido(caminho: string, uid: string): boolean {
  if (!caminho || !uid || caminho.includes("..")) return false;
  return new RegExp(`^${uid}/[0-9a-f-]{36}\\.(pdf|png|jpg|jpeg|webp)$`, "i").test(caminho);
}
