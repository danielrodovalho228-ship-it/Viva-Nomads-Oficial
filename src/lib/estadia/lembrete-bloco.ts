/*
  E205-B2 — lembrete do bloco renovado ainda não pago (desenho do coordenador, 28/10). PURO.
  O pagamento na Viva é POR BLOCO, de uma vez (pagamento-bloco.ts); não existe parcela mensal.
    • Só blocos 2 em diante (o bloco 1 é coberto pelo fechamento e pela trava das instruções de chegada);
    • só bloco renovado: aceito pelas DUAS partes (aceite_proprietario_em e aceite_inquilino_em) e agendado/ativo;
    • início em até 3 dias (hoje conta) e nenhum pagamento registrado para o bloco.
  Uma vez por (contrato, bloco): a chave em automacoes_envios. Nada acontece quando o bloco começa sem pagamento
  (sem aviso de atraso, sem status novo) — isso espera o parecer jurídico.
  Roda: node --test src/lib/estadia/lembrete-bloco.test.ts
*/
import { rotuloPagamentoBloco } from "../pagamento-bloco.ts";

/** Dias de antecedência do lembrete. */
export const DIAS_LEMBRETE_BLOCO = 3;

export interface BlocoParaLembrete {
  numero: number;
  inicio: string; // AAAA-MM-DD
  fim: string;
  meses: number;
  valor: number;
  status: string;
  aceiteProprietario: string | null;
  aceiteInquilino: string | null;
}

const DIA_MS = 86_400_000;
const soData = (iso: string) => String(iso ?? "").slice(0, 10);
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(soData(ate)) - Date.parse(soData(de))) / DIA_MS);

/** Bloco renovado: 2 em diante, aceito pelas duas partes, agendado ou já ativo. */
export function blocoRenovado(b: Pick<BlocoParaLembrete, "numero" | "status" | "aceiteProprietario" | "aceiteInquilino">): boolean {
  return b.numero >= 2 && !!b.aceiteProprietario && !!b.aceiteInquilino && (b.status === "agendado" || b.status === "ativo");
}

/** Sai o lembrete? Renovado, começa em até 3 dias (não passou) e sem pagamento registrado. */
export function precisaLembreteDoBloco(b: BlocoParaLembrete, hoje: string, pagamentosDoBloco: number): boolean {
  if (!blocoRenovado(b) || pagamentosDoBloco > 0) return false;
  const faltam = diasEntre(hoje, b.inicio);
  return faltam >= 0 && faltam <= DIAS_LEMBRETE_BLOCO;
}

/** A chave de envio: uma vez por (contrato, bloco). */
export const chaveLembreteBloco = (contratoId: string, numero: number) => `bloco_inicio_lembrete:${contratoId}:${numero}`;

const ddmm = (iso: string) => `${soData(iso).slice(8, 10)}/${soData(iso).slice(5, 7)}`;
const ddmmaaaa = (iso: string) => `${ddmm(iso)}/${soData(iso).slice(0, 4)}`;

export const LINHA_PAGAMENTO_DIRETO = "O pagamento é direto ao proprietário; os dados estão na página da estadia.";

/** O e-mail: assunto, abertura e o quadro (imóvel, datas, valor com a conta aberta) + a linha do pagamento direto. */
export function emailLembreteBloco(b: BlocoParaLembrete, o: { imovel?: string | null; valorMensal?: number | null }): {
  assunto: string;
  abertura: (nome?: string) => string;
  linhas: { rotulo: string; valor: string }[];
  rodape: string;
  cta: string;
} {
  const imovel = (o.imovel ?? "").replace(/\s+/g, " ").trim();
  return {
    assunto: `O bloco ${b.numero} da sua estadia começa em ${ddmm(b.inicio)}`,
    abertura: (n) => `Olá${n ? " " + n : ""}, o bloco ${b.numero} da sua estadia${imovel ? ` em ${imovel}` : ""} começa em ${ddmmaaaa(b.inicio)}.`,
    linhas: [
      ...(imovel ? [{ rotulo: "Imóvel", valor: imovel }] : []),
      { rotulo: "Datas do bloco", valor: `${ddmmaaaa(b.inicio)} a ${ddmmaaaa(b.fim)}` },
      { rotulo: "Valor do bloco", valor: rotuloPagamentoBloco({ tipo: "aluguel", valor: b.valor, bloco: { numero: b.numero, meses: b.meses, inicio: b.inicio, fim: b.fim }, valorMensal: o.valorMensal ?? null }) },
    ],
    rodape: LINHA_PAGAMENTO_DIRETO,
    cta: "Ver a estadia",
  };
}
