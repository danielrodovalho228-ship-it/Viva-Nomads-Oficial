/*
  E209 — e-mails de chegada (D-7 "instruções liberadas" e lembretes D-2/D-1). PURO.
    • O corpo diz o imóvel (título · bairro, cidade) e as datas da estadia (entrada e saída, com os horários do anúncio).
    • As instruções de chegada vão NO CORPO do e-mail do morador (não só atrás do link): os campos preenchidos, na
      ordem do formulário do dono.
    • Os lembretes D-2/D-1 só saem com o contrato assinado pelas duas partes E o 1º pagamento confirmado — a mesma
      condição que libera as instruções no D-7.
  Roda: node --test src/lib/estadia/emails-chegada.test.ts
*/
import { CAMPOS_INSTRUCOES, type Instrucoes } from "./instrucoes.ts";
import { blocoDados } from "../notifications/modelo-email.ts";
import { escaparHtml } from "../escapar-html.ts";

export interface EstadiaParaEmail {
  imovel: { titulo?: string | null; bairro?: string | null; cidade?: string | null };
  /** AAAA-MM-DD */
  entrada: string;
  /** AAAA-MM-DD */
  saida?: string | null;
  /** "14:00" (properties.checkin_after) ou o horário combinado no contrato. */
  horarioEntrada?: string | null;
  /** "11:00" (properties.checkout_before). */
  horarioSaida?: string | null;
}

const limpo = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const dataBR = (iso: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const hora = (h: string | null | undefined) => (/^\d{1,2}:\d{2}/.test(limpo(h)) ? limpo(h).slice(0, 5) : "");

export function imovelPorExtenso(im: EstadiaParaEmail["imovel"]): string {
  const lugar = [limpo(im.bairro), limpo(im.cidade)].filter(Boolean).join(", ");
  return [limpo(im.titulo), lugar].filter(Boolean).join(" · ");
}

/** Imóvel, Entrada e Saída (com os horários quando o anúncio tem). */
export function linhasDaEstadia(e: EstadiaParaEmail): { rotulo: string; valor: string }[] {
  const l: { rotulo: string; valor: string }[] = [];
  const im = imovelPorExtenso(e.imovel);
  if (im) l.push({ rotulo: "Imóvel", valor: im });
  const he = hora(e.horarioEntrada);
  if (dataBR(e.entrada)) l.push({ rotulo: "Entrada", valor: `${dataBR(e.entrada)}${he ? `, a partir das ${he}` : ""}` });
  const hs = hora(e.horarioSaida);
  if (dataBR(e.saida)) l.push({ rotulo: "Saída", valor: `${dataBR(e.saida)}${hs ? `, até as ${hs}` : ""}` });
  return l;
}

/** Os campos preenchidos das instruções, na ordem do formulário. Vazio quando o dono ainda não preencheu. */
export function instrucoesNoEmail(i: Instrucoes | null | undefined): { rotulo: string; valor: string }[] {
  if (!i) return [];
  return CAMPOS_INSTRUCOES.map((c) => ({ rotulo: c.rotulo, valor: (i[c.chave] ?? "").trim() })).filter((x) => x.valor.length > 0);
}

/** Lembrete D-2/D-1: só com o contrato assinado pelas duas partes e o 1º pagamento confirmado. */
export function lembreteDeChegadaPermitido(c: { assinadoPelasDuas: boolean; primeiroPagamento: boolean }): boolean {
  return c.assinadoPelasDuas && c.primeiroPagamento;
}

export const SEM_INSTRUCOES = "O proprietário ainda não preencheu as instruções de chegada. Assim que preencher, elas aparecem na página da estadia.";

/**
 * O corpo (HTML e texto) dos e-mails de chegada: a frase do aviso (a mesma do texto puro: "Imóvel: … Entrada em
 * DD/MM/AAAA."), o quadro da estadia e, para o morador, as instruções. Tudo escapado; quebras de linha das
 * instruções viram <br>.
 */
export function corpoDaChegada(e: EstadiaParaEmail, instrucoes: Instrucoes | null | undefined, paraMorador: boolean, frase?: string): { html: string; texto: string } {
  const linhas = linhasDaEstadia(e);
  const html: string[] = [];
  const texto: string[] = [];
  if (frase) {
    html.push(`<p style="margin:0 0 12px;">${escaparHtml(frase)}</p>`);
    texto.push(frase, "");
  }
  html.push(blocoDados(linhas.map((l) => ({ rotulo: escaparHtml(l.rotulo), valor: escaparHtml(l.valor) }))));
  texto.push(...linhas.map((l) => `${l.rotulo}: ${l.valor}`));
  if (paraMorador) {
    const itens = instrucoesNoEmail(instrucoes);
    html.push(`<p style="margin:0 0 8px;font-weight:700;">Instruções de chegada</p>`);
    texto.push("", "Instruções de chegada");
    if (itens.length) {
      for (const it of itens) {
        html.push(`<p style="margin:0 0 10px;"><strong>${escaparHtml(it.rotulo)}:</strong><br>${escaparHtml(it.valor).replace(/\r?\n/g, "<br>")}</p>`);
        texto.push(`${it.rotulo}: ${it.valor}`);
      }
    } else {
      html.push(`<p style="margin:0 0 10px;">${escaparHtml(SEM_INSTRUCOES)}</p>`);
      texto.push(SEM_INSTRUCOES);
    }
  }
  return { html: html.join(""), texto: texto.join("\n") };
}
