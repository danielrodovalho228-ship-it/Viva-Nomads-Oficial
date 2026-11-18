/*
  E663 — Jornada de mensagens da estadia (PURO). Quatro momentos além do D-7 das instruções (que já existe em
  emails-chegada/automações e é reaproveitado, não duplicado):
    • confirmação  — logo depois da assinatura das duas partes; pede os documentos PELA PLATAFORMA (E441: nada de dado
                     pessoal, foto ou contato de fora no e-mail);
    • chegada      — no dia da entrada;
    • semana da saída — 7 dias antes da saída;
    • meio da estadia — só estadia longa (60 dias ou mais): "tudo certo? algo quebrou?" e a avaliação parcial.
  As datas saem das datas ATUAIS do contrato (blocos). Remarcar por aditivo (E652) muda as datas e a chave do envio
  (a data entra na variante), então a jornada se recalcula e reenvia nas datas novas sem repetir as antigas.
*/
import { imovelPorExtenso, type EstadiaParaEmail } from "./emails-chegada.ts";

export const MEIO_ESTADIA_MIN_DIAS = 60;
export const SEMANA_SAIDA_ANTES_DIAS = 7;
/** A confirmação sai até este número de dias depois da assinatura (contrato antigo não recebe de repente). */
export const CONFIRMACAO_JANELA_DIAS = 1;

export const D7_ANTES_DIAS = 7;

export type MomentoJornada = "jornada_confirmacao" | "jornada_d7" | "jornada_chegada" | "jornada_semana_saida" | "jornada_meio_estadia";

const DIA_MS = 86_400_000;
const soData = (iso: string) => String(iso ?? "").slice(0, 10);
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(soData(ate)) - Date.parse(soData(de))) / DIA_MS);
const somaDias = (iso: string, n: number) => new Date(Date.parse(`${soData(iso)}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const dataBR = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const hora = (h: string | null | undefined) => (/^\d{1,2}:\d{2}/.test((h ?? "").trim()) ? (h ?? "").trim().slice(0, 5) : "");

export interface DatasDaEstadia {
  /** AAAA-MM-DD — primeira entrada dos blocos. */
  entrada: string;
  /** AAAA-MM-DD — última saída dos blocos. */
  fim: string;
}

export interface Jornada {
  /** 7 dias antes da entrada: as instruções de chegada estão na página da estadia (E759). */
  d7: string;
  chegada: string;
  semanaSaida: string | null;
  meio: string | null;
}

export function jornadaDaEstadia(d: DatasDaEstadia): Jornada {
  const dias = diasEntre(d.entrada, d.fim);
  const semana = somaDias(d.fim, -SEMANA_SAIDA_ANTES_DIAS);
  return {
    d7: somaDias(d.entrada, -D7_ANTES_DIAS),
    chegada: soData(d.entrada),
    // Estadia tão curta que a semana da saída cairia na chegada ou antes: sem mensagem (a da chegada já cobre).
    semanaSaida: semana > soData(d.entrada) ? semana : null,
    meio: dias >= MEIO_ESTADIA_MIN_DIAS ? somaDias(d.entrada, Math.floor(dias / 2)) : null,
  };
}

/** Fonte única das datas da estadia para toda mensagem: primeira entrada e última saída dos blocos válidos (ou null). */
export { datasDaEstadia } from "../contrato-blocos.ts";

/** Os momentos que caem HOJE (a confirmação é por assinatura/pagamento, não por data). */
export function momentosDeHoje(d: DatasDaEstadia & { hoje: string }): MomentoJornada[] {
  const j = jornadaDaEstadia(d);
  const hoje = soData(d.hoje);
  const m: MomentoJornada[] = [];
  if (j.d7 === hoje) m.push("jornada_d7");
  if (j.chegada === hoje) m.push("jornada_chegada");
  if (j.semanaSaida === hoje) m.push("jornada_semana_saida");
  if (j.meio === hoje) m.push("jornada_meio_estadia");
  return m;
}

/**
 * Variante da chave de envio: a data de que o momento depende. Remarcou → variante nova → envia de novo nas datas novas.
 * A chegada depende só da entrada; a semana da saída só da saída; o meio, das duas.
 */
export function chaveDaJornada(momento: MomentoJornada, d: DatasDaEstadia): string {
  switch (momento) {
    case "jornada_confirmacao":
      return "";
    case "jornada_d7":
    case "jornada_chegada":
      return soData(d.entrada);
    case "jornada_semana_saida":
      return soData(d.fim);
    case "jornada_meio_estadia":
      return `${soData(d.entrada)}_${soData(d.fim)}`;
  }
}

/**
 * A confirmação sai (uma vez só, a chave é fixa) em um de dois casos:
 *  • logo depois da assinatura das duas partes (hoje ou ontem, dia de Brasília); ou
 *  • quando a estadia está CONFIRMADA — assinada pelas duas partes E com o 1º pagamento confirmado — e ainda não começou
 *    (E759: antes, só a janela de 1 dia depois da assinatura valia, então uma estadia confirmada depois nunca recebia).
 */
export function confirmacaoDevida(i: { assinadoEm: string | null | undefined; hoje: string; pago?: boolean; entrada?: string | null }): boolean {
  if (!i.assinadoEm) return false;
  const t = Date.parse(i.assinadoEm);
  if (!Number.isFinite(t)) return false;
  if (i.pago && i.entrada && soData(i.entrada) >= soData(i.hoje)) return true;
  const diaBrasilia = new Date(t - 3 * 3600_000).toISOString().slice(0, 10);
  const atraso = diasEntre(diaBrasilia, i.hoje);
  return atraso >= 0 && atraso <= CONFIRMACAO_JANELA_DIAS;
}

export interface CorpoJornada {
  /** Frase única que entra como detalhe do e-mail/aviso. */
  texto: string;
}

export function corpoDaJornada(
  momento: MomentoJornada,
  c: DatasDaEstadia & { imovel: EstadiaParaEmail["imovel"]; horario?: string | null; horarioSaida?: string | null }
): CorpoJornada {
  const imovel = imovelPorExtenso(c.imovel);
  const lugar = imovel ? `Imóvel: ${imovel}. ` : "";
  const he = hora(c.horario);
  const hs = hora(c.horarioSaida);
  switch (momento) {
    case "jornada_confirmacao":
      return {
        texto: `${lugar}Seu contrato está assinado. Entrada em ${dataBR(c.entrada)}, saída em ${dataBR(c.fim)}. Para tudo correr bem, envie seus documentos pela plataforma, na página da estadia: eles ficam guardados com segurança e só as partes do contrato os veem. Não envie documentos por e-mail nem por mensagens de fora.`,
      };
    case "jornada_d7":
      return {
        texto: `${lugar}Falta uma semana para a entrada (${dataBR(c.entrada)}${he ? `, a partir das ${he}` : ""}). As instruções de chegada estão na página da estadia. Confira os documentos e tire dúvidas pela plataforma.`,
      };
    case "jornada_chegada":
      return {
        texto: `${lugar}Hoje é o dia da entrada (${dataBR(c.entrada)}${he ? `, a partir das ${he}` : ""}). As instruções estão na página da estadia. Se algo impedir a entrada, fale pela conversa da plataforma: a Viva acompanha.`,
      };
    case "jornada_semana_saida":
      return {
        texto: `${lugar}A saída é em ${dataBR(c.fim)}${hs ? `, até as ${hs}` : ""}: falta uma semana. Combine a conferência de saída pela plataforma e, se quiserem seguir por mais tempo, é só pedir a prorrogação lá.`,
      };
    case "jornada_meio_estadia":
      return {
        texto: `${lugar}Vocês estão na metade da estadia (${dataBR(c.entrada)} a ${dataBR(c.fim)}). Está tudo certo? Se algo quebrou ou precisa de conserto, avise pela plataforma e o pedido já fica registrado. Aproveite para deixar sua avaliação parcial: leva 2 minutos.`,
      };
  }
}
