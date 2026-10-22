/*
  Prompt 38 — textos dos e-mails do vínculo de parceiro fixo (puro). O convite diz quem convidou, para qual serviço e
  qual imóvel ("Paulo quer você como limpeza fixa do Apto Santa Mônica"); a resposta diz se o parceiro aceitou ou
  recusou. Só primeiro nome do dono, nome público do parceiro e título do anúncio — nada de endereço.
*/
import { primeiroNome } from "../display-name.ts";
import { rotuloCategoria } from "../parceiros/regras.ts";
import { assuntoVinculoConvite, assuntoVinculoResposta } from "../notifications/assuntos.ts";

export interface DadosVinculo {
  categoria: string;
  tituloImovel: string | null;
  cidade: string | null;
  nomeDono: string | null;
  nomeParceiro: string | null;
}

const ola = (n?: string) => `Olá${n ? " " + n : ""}`;
const servicoFixo = (categoria: string) => `${rotuloCategoria(categoria).toLowerCase()} fixa`;
const imovel = (d: DadosVinculo) => {
  const t = d.tituloImovel?.trim();
  return t ? `${t}${d.cidade?.trim() ? ` (${d.cidade.trim()})` : ""}` : "um imóvel";
};

export function textoConvite(d: DadosVinculo): { subject: string; body: (n?: string) => string } {
  const dono = primeiroNome(d.nomeDono) || "Um proprietário";
  return {
    subject: assuntoVinculoConvite(primeiroNome(d.nomeDono), servicoFixo(d.categoria)),
    body: (n) =>
      `${ola(n)}, ${dono} quer você como ${servicoFixo(d.categoria)} de ${imovel(d)}. Os pedidos chegam a cada saída de morador, com a janela de horário, e você aceita ou recusa cada um. Responda ao convite em Imóveis fixos.`,
  };
}

export function textoResposta(d: DadosVinculo, aceitou: boolean): { subject: string; body: (n?: string) => string } {
  const parceiro = d.nomeParceiro?.trim() || "O parceiro";
  const servico = servicoFixo(d.categoria);
  return aceitou
    ? {
        subject: assuntoVinculoResposta(d.nomeParceiro, servico, true),
        body: (n) => `${ola(n)}, ${parceiro} aceitou ser ${servico} de ${imovel(d)}. Os pedidos saem a cada saída de morador, do jeito que você escolheu em Parceiros do imóvel.`,
      }
    : {
        subject: assuntoVinculoResposta(d.nomeParceiro, servico, false),
        body: (n) => `${ola(n)}, ${parceiro} recusou o convite para ser ${servico} de ${imovel(d)}. Escolha outro parceiro da cidade em Parceiros do imóvel.`,
      };
}
