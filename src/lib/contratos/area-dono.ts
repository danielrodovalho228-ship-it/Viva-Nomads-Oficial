/*
  PROP-5 — área Contratos do dono sem repetição. PURO.
    • A lista de contratos mora só em Contratos. Caução mostra a caução por bloco (valor, forma, status, devolução) e
      Recibos e notas só os recibos; cada linha leva ao contrato ("Ver contrato").
    • A Conferência de entrada é uma etapa dentro do detalhe de cada contrato; /dashboard/contratos#conferencia abre o
      contrato com a conferência pendente.
  O status da caução vem da função única estadoCaucao (a mesma dos Contratos e da tela do morador).
*/
import { estadoCaucao, type ChaveCaucao, type EstadoCaucao } from "../caucao-estado.ts";
import type { EstadoConferenciaLista } from "../conferencia.ts";

export const hrefContratoDono = (id: string) => `/dashboard/contratos/${id}`;
export const ROTULO_VER_CONTRATO = "Ver contrato";

export const ROTULO_FORMA_CAUCAO: Record<string, string> = {
  avista: "À vista",
  preauth_cartao: "Pré-autorização no cartão",
};

/** A devolução só tem estado depois do acerto; antes, ela acontece ao fim da estadia. */
const CHAVES_DEVOLUCAO: readonly ChaveCaucao[] = ["devolucao_aguardando", "devolvida", "devolvida_com_desconto", "desconto_contestado"];
export const DEVOLUCAO_AO_FIM = "Ao fim da estadia";

export interface ContratoParaCaucao {
  id: string;
  propertyTitle: string;
  blocos: readonly { id: string; numeroBloco: number; caucao: number; caucaoForma: string; caucaoStatus: string }[];
  pagamentos: readonly { tipo: string; valor: number; confirmado: boolean }[];
  /** Estado do contrato inteiro (inclui o acerto da devolução). */
  caucao: EstadoCaucao;
}

export interface LinhaCaucaoBloco {
  chave: string;
  contratoId: string;
  imovel: string;
  bloco: number;
  valor: number;
  forma: string;
  status: string;
  chaveStatus: ChaveCaucao;
  pendente: boolean;
  devolucao: string;
  href: string;
}

/** Uma linha por bloco com caução. Contrato sem caução (seguro-fiança ou valor zero) não entra. */
export function linhasCaucaoPorBloco(contratos: readonly ContratoParaCaucao[]): LinhaCaucaoBloco[] {
  const out: LinhaCaucaoBloco[] = [];
  for (const c of contratos) {
    if (c.caucao.chave === "dispensada" || c.caucao.chave === "sem_caucao") continue;
    const devolucao = CHAVES_DEVOLUCAO.includes(c.caucao.chave) ? c.caucao.rotulo : DEVOLUCAO_AO_FIM;
    for (const b of [...c.blocos].sort((x, y) => x.numeroBloco - y.numeroBloco)) {
      if (!(Number(b.caucao) > 0)) continue;
      // Desde a 0182 o recebimento da caução é do contrato (sem bloco): ele vale para os blocos do contrato.
      const e = estadoCaucao({ blocos: [b], pagamentos: c.pagamentos });
      out.push({
        chave: `${c.id}-${b.id}`,
        contratoId: c.id,
        imovel: c.propertyTitle,
        bloco: b.numeroBloco,
        valor: e.valor,
        forma: ROTULO_FORMA_CAUCAO[b.caucaoForma] ?? ROTULO_FORMA_CAUCAO.avista,
        status: e.rotulo,
        chaveStatus: e.chave,
        pendente: e.pendente,
        devolucao,
        href: hrefContratoDono(c.id),
      });
    }
  }
  return out;
}

/** Conferência de entrada ainda por fazer (não aberta, em andamento ou esperando a outra parte). */
const CONFERENCIA_PENDENTE: readonly EstadoConferenciaLista[] = ["nao_aberta", "em_andamento", "aguardando_outra_parte"];

/**
 * O contrato que o atalho "#conferencia" abre: o primeiro em andamento, já assinado pelas duas partes, com a
 * conferência de entrada pendente. Nenhum → null (a lista fica onde está).
 */
export function contratoComConferenciaPendente(
  contratos: readonly { id: string; status: string; etapa: string }[],
  estados: ReadonlyMap<string, EstadoConferenciaLista>
): string | null {
  for (const c of contratos) {
    if (c.status !== "ativo" || c.etapa === "aguardando_assinatura") continue;
    if (CONFERENCIA_PENDENTE.includes(estados.get(c.id) ?? "nao_aberta")) return c.id;
  }
  return null;
}
