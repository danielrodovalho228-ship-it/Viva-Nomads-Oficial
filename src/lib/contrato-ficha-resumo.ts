/*
  E634 — FICHA-RESUMO do contrato (aprovado pelo Daniel em 05/11/2026). PURO.
  Página-resumo gerada dos dados do contrato: datas de início e fim, valor, vencimento e conta de recebimento, com a
  AUTORIZAÇÃO EXPRESSA registrada quando a conta for de terceiro. Atrás da chave FICHA_RESUMO_ATIVA (desligada): entra no ar
  junto com o modelo de contrato da Dra. Beatriz.
  A Viva guarda só o FINAL do documento e da conta/Pix (a chave e o resultado, não o dado bruto — desenho do E293).
*/
import { dataBR, formatBRL } from "./utils.ts";

/** Versão do texto da autorização: vai junto do registro, para saber exatamente o que a pessoa aceitou. */
export const VERSAO_TEXTO_AUTORIZACAO = "ficha-resumo-v1";

export const ROTULO_PENDENCIA_VENCIMENTO = "Falta o dia de vencimento do aluguel.";
export const ROTULO_PENDENCIA_CONTA = "Falta a conta de recebimento.";
export const ROTULO_PENDENCIA_AUTORIZACAO = "Falta a autorização expressa do proprietário para a conta de terceiro.";

export function textoAutorizacaoTerceiro(nomeTitular: string): string {
  return `Eu, proprietário deste imóvel, autorizo expressamente que os pagamentos deste contrato sejam feitos na conta de ${nomeTitular.trim()}, terceiro que não sou eu, e assumo a responsabilidade por essa indicação.`;
}

/** Últimos `n` caracteres, sem pontuação de documento. Nunca devolve o dado inteiro quando ele é maior que `n`. */
export function finalDe(valor: string, n: number): string {
  const limpo = /@/.test(valor) ? valor.trim() : valor.replace(/[.\-/\s]/g, "");
  return limpo.length <= n ? limpo : limpo.slice(-n);
}

/** O vencimento mensal precisa existir em todo mês: de 1 a 28. */
export function diaVencimentoValido(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 28;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
/** Mesmo primeiro e último nome. Conservador: na dúvida, é outra pessoa. */
function mesmaPessoa(a: string, b: string): boolean {
  const pa = semAcento(a).split(" ");
  const pb = semAcento(b).split(" ");
  return !!pa[0] && pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1];
}

export interface ContaRecebimentoEntrada {
  titularNome: string;
  /** CPF ou CNPJ do titular, como a pessoa digitou. Só o final é guardado. */
  titularDocumento: string;
  instituicao: string;
  /** Número da conta ou chave Pix. Só o final é guardado. */
  referencia: string;
  titularProprio: boolean;
  /** Marcou a autorização expressa (só vale/precisa quando a conta é de terceiro). */
  autorizo: boolean;
}

export interface ContaRecebimentoGravar {
  titularNome: string;
  titularDocumentoFinal: string;
  instituicao: string;
  referenciaFinal: string;
  titularProprio: boolean;
  /** Conta de terceiro: o servidor registra quem, quando e a versão do texto. */
  precisaAutorizacao: boolean;
}

export function validarContaRecebimento(e: ContaRecebimentoEntrada, nomeProprietario: string): { ok: true; valor: ContaRecebimentoGravar } | { ok: false; erros: string[] } {
  const erros: string[] = [];
  const nome = (e.titularNome ?? "").trim();
  const doc = (e.titularDocumento ?? "").replace(/\D/g, "");
  const inst = (e.instituicao ?? "").trim();
  const ref = (e.referencia ?? "").trim();
  if (nome.length < 3) erros.push("Informe o nome do titular da conta.");
  if (!(doc.length === 11 || doc.length === 14)) erros.push("Informe o CPF (11 números) ou o CNPJ (14 números) do titular.");
  if (inst.length < 2) erros.push("Informe o banco ou a instituição.");
  if (ref.length < 4) erros.push("Informe a conta ou a chave Pix.");
  if (e.titularProprio && nome && !mesmaPessoa(nome, nomeProprietario)) {
    erros.push("O titular informado não é o do proprietário. Marque que a conta é de terceiro e dê a autorização expressa.");
  }
  if (!e.titularProprio && !e.autorizo) erros.push("Conta de terceiro precisa da autorização expressa do proprietário.");
  if (erros.length) return { ok: false, erros };
  return {
    ok: true,
    valor: {
      titularNome: nome,
      titularDocumentoFinal: finalDe(doc, 4),
      instituicao: inst,
      referenciaFinal: finalDe(ref, 4),
      titularProprio: e.titularProprio,
      precisaAutorizacao: !e.titularProprio,
    },
  };
}

export interface ContaRecebimentoFicha {
  titularNome: string;
  titularDocumentoFinal: string;
  instituicao: string;
  referenciaFinal: string;
  titularProprio: boolean;
  /** ISO de quando a autorização expressa foi registrada (conta de terceiro). */
  autorizacaoEm: string | null;
}

export interface DadosFicha {
  numero: string;
  imovel: string;
  proprietario: string;
  inquilino: string;
  inicio: string | null;
  fim: string | null;
  aluguelMensal: number;
  diaVencimento: number | null;
  conta: ContaRecebimentoFicha | null;
}

export interface FichaResumo {
  linhas: { rotulo: string; valor: string }[];
  pendencias: string[];
  completa: boolean;
}

export function montarFicha(d: DadosFicha): FichaResumo {
  const pendencias: string[] = [];
  const linhas: { rotulo: string; valor: string }[] = [
    { rotulo: "Contrato", valor: d.numero },
    { rotulo: "Imóvel", valor: d.imovel },
    { rotulo: "Proprietário", valor: d.proprietario },
    { rotulo: "Inquilino", valor: d.inquilino },
    { rotulo: "Início", valor: d.inicio ? dataBR(d.inicio) : "—" },
    { rotulo: "Fim", valor: d.fim ? dataBR(d.fim) : "—" },
    { rotulo: "Aluguel mensal", valor: formatBRL(d.aluguelMensal) },
  ];
  if (diaVencimentoValido(d.diaVencimento)) linhas.push({ rotulo: "Vencimento", valor: `todo dia ${d.diaVencimento}` });
  else {
    linhas.push({ rotulo: "Vencimento", valor: "a informar" });
    pendencias.push(ROTULO_PENDENCIA_VENCIMENTO);
  }
  if (d.conta) {
    const c = d.conta;
    linhas.push({ rotulo: "Conta de recebimento", valor: `${c.titularNome} · ${c.instituicao} · documento final ${c.titularDocumentoFinal} · conta/Pix final ${c.referenciaFinal}` });
    if (c.titularProprio) linhas.push({ rotulo: "Titularidade da conta", valor: "Conta do próprio proprietário" });
    else if (c.autorizacaoEm) linhas.push({ rotulo: "Titularidade da conta", valor: `Conta de terceiro, com autorização expressa do proprietário registrada em ${dataBR(c.autorizacaoEm)}` });
    else {
      linhas.push({ rotulo: "Titularidade da conta", valor: "Conta de terceiro, sem autorização registrada" });
      pendencias.push(ROTULO_PENDENCIA_AUTORIZACAO);
    }
  } else {
    linhas.push({ rotulo: "Conta de recebimento", valor: "a informar" });
    pendencias.push(ROTULO_PENDENCIA_CONTA);
  }
  return { linhas, pendencias, completa: pendencias.length === 0 };
}
