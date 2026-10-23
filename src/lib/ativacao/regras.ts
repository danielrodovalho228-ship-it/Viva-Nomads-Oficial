/*
  Prompt 50 — ATIVAÇÃO por papel. PURO.
  A ativação é UM fato por papel, gravado uma vez (tabela ativacoes) e nunca desfeito:
    • Morador: o 1º pedido enviado (candidatura ou pedido de moradia);
    • Proprietário: o 1º anúncio publicado;
    • Parceiro: o 1º pedido aceito (31b).
  O checklist de cada papel é o do Prompt 43 (src/lib/onboarding/ativacao.ts); o estado de ativação decide quando ele
  some (no momento da ativação, mesmo com outro item em aberto) e se o servidor precisa gravar a data.
  Roda: node --test src/lib/ativacao/regras.test.ts
*/
import { checklistMorador, checklistParceiro, checklistProprietario, fatoDeAtivacao, type ChecklistAtivacao, type FatosConta, type Papel } from "../onboarding/ativacao.ts";

export { fatoDeAtivacao };

export const PAPEIS: readonly Papel[] = ["morador", "proprietario", "parceiro"];

/** O item do checklist que É a ativação (o último do papel). */
export const ITEM_DE_ATIVACAO: Record<Papel, string> = { morador: "pedido", proprietario: "publicar", parceiro: "pedido" };

export interface EstadoAtivacao {
  papel: Papel;
  itens: { chave: string; feito: boolean; acao: { rotulo: string; href: string } | null }[];
  ativado: boolean;
  ativadoEm: string | null;
  /** Ativou agora e ainda não está gravado: o servidor grava (1× por papel). */
  gravar: boolean;
}

const CHECKLIST: Record<Papel, (f: FatosConta) => ChecklistAtivacao> = {
  morador: checklistMorador,
  proprietario: checklistProprietario,
  parceiro: checklistParceiro,
};

/**
 * estadoAtivacao(papel, dados): itens do checklist + ativado. Uma vez gravada, a ativação vale para sempre (despublicar
 * o anúncio não "desativa" o proprietário). `agora` só data a ativação que ainda não foi gravada.
 */
export function estadoAtivacao(papel: Papel, dados: { fatos: FatosConta; ativadoEm: string | null }, agora: Date): EstadoAtivacao {
  const c = CHECKLIST[papel](dados.fatos);
  const fato = fatoDeAtivacao(papel, dados.fatos);
  const ativadoEm = dados.ativadoEm ?? (fato ? agora.toISOString() : null);
  return {
    papel,
    itens: c.itens.map((i) => ({ chave: i.id, feito: i.feito || (i.id === ITEM_DE_ATIVACAO[papel] && !!dados.ativadoEm), acao: i.acao })),
    ativado: !!ativadoEm,
    ativadoEm,
    gravar: !dados.ativadoEm && fato,
  };
}

/** Papéis cuja ativação aconteceu e ainda não está gravada. */
export function ativacoesParaGravar(f: FatosConta, gravadas: Partial<Record<Papel, string>>, agora: Date): Papel[] {
  return PAPEIS.filter((p) => estadoAtivacao(p, { fatos: f, ativadoEm: gravadas[p] ?? null }, agora).gravar);
}
