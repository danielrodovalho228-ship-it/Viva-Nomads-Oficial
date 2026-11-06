/*
  E637 — prazos da CAUÇÃO (desenho FECHADO pelo coordenador em 05/11/2026). PURO. ATRÁS DE TRAVA DESLIGADA
  (CAUCAO_PRAZOS_ATIVA) até o parecer da Dra. Beatriz.
   • parecer do dono = 7 dias CORRIDOS após o check-out;
   • silêncio no dia 7 → o sistema registra "liberação integral" e avisa os dois; a devolução integral vence no dia 30;
   • contestação do morador = 5 dias, item a item;
   • desconto só com prova (foto de entrada × saída lado a lado + valor + comprovante); desgaste natural NUNCA desconta;
   • dia 30 sem devolução → pendência no painel do dono + bloqueio de novos anúncios até regularizar;
   • a Viva NUNCA decide a disputa: entrega o dossiê em PDF e oferece acordo, vistoriador parceiro ou Juizado.
  Datas em AAAA-MM-DD (calendário de Brasília); "corridos" = calendário, sem pular fim de semana.
*/

export const PRAZO_PARECER_DIAS = 7;
export const PRAZO_CONTESTACAO_DIAS = 5;
export const PRAZO_DEVOLUCAO_DIAS = 30;

export const TEXTO_VIVA_NAO_DECIDE =
  "A Viva não decide a disputa. Ela entrega o dossiê em PDF (fotos de entrada e saída lado a lado, valores e comprovantes) e oferece as saídas: acordo entre as partes, vistoriador parceiro ou Juizado Especial.";

export const SAIDAS_DA_DISPUTA = [
  { chave: "acordo", rotulo: "Acordo entre as partes" },
  { chave: "vistoriador_parceiro", rotulo: "Vistoriador parceiro" },
  { chave: "juizado", rotulo: "Juizado Especial" },
] as const;

/** Soma `n` dias corridos a uma data AAAA-MM-DD (UTC, sem fuso: a conta é de calendário). */
export function addDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function prazosDaSaida(saida: string): { parecerAte: string; devolucaoAte: string } {
  return { parecerAte: addDias(saida, PRAZO_PARECER_DIAS), devolucaoAte: addDias(saida, PRAZO_DEVOLUCAO_DIAS) };
}

/** O que PODE virar desconto. Desgaste natural não está na lista, de propósito: nunca desconta. */
export const CATEGORIAS_DE_DESCONTO = ["dano", "sujeira_excessiva", "item_faltando"] as const;

export interface ItemDesconto {
  id: string;
  valor: number;
  categoria: string;
  comodo: string;
  fotoEntrada: string | null;
  fotoSaida: string | null;
  comprovante: string | null;
  status: "proposto" | "aceito" | "contestado";
}

/** Desconto só com prova: valor, foto de entrada e de saída (lado a lado) e comprovante. Desgaste natural nunca. */
export function descontoValido(i: Pick<ItemDesconto, "valor" | "categoria" | "comodo" | "fotoEntrada" | "fotoSaida" | "comprovante">): { ok: true } | { ok: false; motivo: string } {
  if (i.categoria === "desgaste_natural") return { ok: false, motivo: "Desgaste natural nunca desconta da caução." };
  if (!(CATEGORIAS_DE_DESCONTO as readonly string[]).includes(i.categoria)) return { ok: false, motivo: "Escolha o tipo do problema: dano, sujeira excessiva ou item faltando." };
  if (!i.comodo?.trim()) return { ok: false, motivo: "Diga em qual cômodo está o problema." };
  if (!(Number(i.valor) > 0)) return { ok: false, motivo: "Informe o valor do desconto." };
  if (!i.fotoEntrada) return { ok: false, motivo: "Falta a foto de entrada, para ver lado a lado." };
  if (!i.fotoSaida) return { ok: false, motivo: "Falta a foto de saída, para ver lado a lado." };
  if (!i.comprovante) return { ok: false, motivo: "Falta o comprovante do valor (orçamento ou nota)." };
  return { ok: true };
}

export interface FatosPrazo {
  /** Dia do check-out (último dia do último bloco). */
  saida: string;
  /** Quando o dono deu o parecer (AAAA-MM-DD), se deu. */
  parecerEm: string | null;
  descontos: readonly ItemDesconto[];
  /** Quando a devolução foi feita e confirmada, se foi. */
  devolvidaEm: string | null;
  hoje: string;
}

export type ChavePrazo = "aguardando_parecer" | "liberacao_integral" | "em_contestacao" | "desconto_valendo" | "em_disputa" | "devolvida";

export interface EstadoPrazos {
  chave: ChavePrazo;
  /** Como a liberação integral nasceu (só em liberacao_integral). */
  motivo: "silencio" | "parecer_sem_desconto" | null;
  /** Até quando o dono precisa dar o parecer / o morador precisa contestar / a devolução precisa sair. */
  parecerAte: string;
  contestarAte: string | null;
  devolverAte: string;
  /** O sistema acabou de entrar em liberação integral: avisa os dois (uma vez). */
  avisarOsDois: boolean;
  /** Passou do dia 30 sem devolução: pendência no painel do dono e bloqueio de novos anúncios. */
  pendenciaDevolucao: boolean;
  /** Sempre falso: a Viva nunca decide a disputa. */
  vivaDecide: false;
}

export function estadoDosPrazos(f: FatosPrazo): EstadoPrazos {
  const { parecerAte, devolucaoAte } = prazosDaSaida(f.saida);
  const comDesconto = f.descontos.length > 0;
  const contestarAte = f.parecerEm && comDesconto ? addDias(f.parecerEm, PRAZO_CONTESTACAO_DIAS) : null;
  const atrasada = f.hoje > devolucaoAte && !f.devolvidaEm;
  const base = { parecerAte, contestarAte, devolverAte: devolucaoAte, vivaDecide: false as const };
  const de = (chave: ChavePrazo, extra: Partial<EstadoPrazos> = {}): EstadoPrazos => ({
    ...base, chave, motivo: null, avisarOsDois: false, pendenciaDevolucao: false, ...extra,
  });

  if (f.devolvidaEm) return de("devolvida");
  // Pendência só em quem deve devolver: liberação integral ou desconto valendo (com disputa a Viva não cobra devolução).
  if (!f.parecerEm) {
    if (f.hoje <= parecerAte) return de("aguardando_parecer");
    return de("liberacao_integral", { motivo: "silencio", avisarOsDois: true, pendenciaDevolucao: atrasada });
  }
  if (!comDesconto) return de("liberacao_integral", { motivo: "parecer_sem_desconto", avisarOsDois: true, pendenciaDevolucao: atrasada });
  if (f.descontos.some((d) => d.status === "contestado")) return de("em_disputa");
  if (contestarAte && f.hoje <= contestarAte) return de("em_contestacao");
  return de("desconto_valendo", { pendenciaDevolucao: atrasada });
}

/** Qualquer contrato do dono em pendência de devolução trava a publicação de anúncio novo, até regularizar. */
export const bloqueiaNovosAnuncios = (estados: readonly Pick<EstadoPrazos, "pendenciaDevolucao">[]): boolean => estados.some((e) => e.pendenciaDevolucao);

export const ROTULO_CAUCAO_PENDENTE = "Regularizar a devolução da caução";
export const DETALHE_CAUCAO_PENDENTE = "a devolução de um contrato passou de 30 dias; devolva e confirme para voltar a publicar";
