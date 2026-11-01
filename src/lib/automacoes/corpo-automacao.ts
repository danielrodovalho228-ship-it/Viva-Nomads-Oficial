/*
  E289 — os e-mails do cron de automações com os FATOS do caso no assunto e no corpo (a régua do E264-B/E267):
  a pessoa ("Olá <nome>"), o imóvel nomeado (título · bairro, cidade) e o fato concreto (a data da saída, o fim do
  período, o número e o prazo da proposta, a data da entrada). Só o que o cron já leu no momento do disparo; nada
  inventado. Vocabulário da plataforma (sem "comissão", sem "aluguel"). PURO.
  Roda: node --test src/lib/automacoes/corpo-automacao.test.ts
*/
import { dataHoraBRT } from "../datas-brasilia.ts";
import { imovelDoPedido, type LinhaEmail } from "../parceiros/email-pedido.ts";
import { assuntoComTitulo, diaHoraNoAssunto, diaNoAssunto } from "../notifications/assuntos.ts";
import { FRASE_AVALIACAO } from "./regras.ts";

export type TipoCorpoAutomacao = "saida_lembrete" | "avaliacao_pedido" | "renovacao_aviso" | "proposta_vencendo" | "estadia_instrucoes_pendentes";

export const TIPOS_COM_CORPO: ReadonlySet<string> = new Set<TipoCorpoAutomacao>([
  "saida_lembrete",
  "avaliacao_pedido",
  "renovacao_aviso",
  "proposta_vencendo",
  "estadia_instrucoes_pendentes",
]);

export interface DadosAutomacao {
  imovel: { titulo?: string | null; bairro?: string | null; cidade?: string | null } | null;
  /** O dia do fato (yyyy-mm-dd): saída, fim do período, entrada. */
  data?: string | null;
  /** Horário do imóvel (saída até / entrada a partir de), como cadastrado ("11:00"). */
  horario?: string | null;
  /** Proposta: número e prazo (instante ISO). */
  numero?: string | null;
  prazo?: string | null;
  /** E343: proposta — o valor mensal, o total do contrato e a conta aberta do total (a mesma da tela). */
  valorMensal?: number | null;
  totalContrato?: number | null;
  contaTotal?: string | null;
}

const reais = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}` : "";

export interface CorpoAutomacao {
  /** Assunto com o fato e o imóvel (régua de assuntos.ts); null → vale o assunto do modelo. */
  subject: string | null;
  body: (nome?: string) => string;
  linhas: LinhaEmail[];
}

const limpo = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

function dia(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** O dia (yyyy-mm-dd) N dias antes. */
function diasAntes(iso: string | null | undefined, n: number): string {
  const t = Date.parse(`${String(iso ?? "").slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(t) ? new Date(t - n * 86_400_000).toISOString().slice(0, 10) : "";
}

/** "11:00" → "11:00"; "11:00:00" → "11:00"; o resto some. */
function hora(h: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(limpo(h));
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** Dias de antecedência do lembrete das instruções que o morador recebe (D-7, Prompt 32). */
export const INSTRUCOES_LIBERADAS_DIAS = 7;

export function corpoAutomacao(tipo: TipoCorpoAutomacao, d: DadosAutomacao): CorpoAutomacao {
  const titulo = limpo(d.imovel?.titulo);
  const im = imovelDoPedido(d.imovel ?? null);
  const data = dia(d.data);
  const h = hora(d.horario);
  const ola = (nome?: string) => `Olá${nome ? " " + nome : ""}`;
  const linhas: LinhaEmail[] = im ? [{ rotulo: "Imóvel", valor: im }] : [];
  switch (tipo) {
    case "saida_lembrete": {
      if (data) linhas.push({ rotulo: "Saída", valor: h ? `${data}, até as ${h}` : data });
      return {
        subject: assuntoComTitulo("Saída de ", titulo, d.data ? ` em ${diaNoAssunto(d.data)}` : " em 3 dias"),
        body: (n) =>
          `${ola(n)}, a saída${titulo ? ` de ${titulo}` : " do imóvel do seu contrato"} é em ${data || "3 dias"}${h ? ` (até as ${h})` : ""}. Combine a conferência de saída pela plataforma.`,
        linhas,
      };
    }
    case "avaliacao_pedido": {
      if (data) linhas.push({ rotulo: "Saída", valor: data });
      return {
        subject: assuntoComTitulo("Como foi a estadia em ", titulo, "?"),
        body: (n) =>
          `${ola(n)}, a estadia${titulo ? ` em ${titulo}` : ""} terminou${data ? ` em ${data}` : ""}. ${FRASE_AVALIACAO}`,
        linhas,
      };
    }
    case "renovacao_aviso": {
      if (data) linhas.push({ rotulo: "Fim do período", valor: data });
      return {
        subject: assuntoComTitulo("Renovar ", titulo, `? O período termina em ${diaNoAssunto(d.data) || "15 dias"}`),
        body: (n) =>
          `${ola(n)}, o período atual do contrato${titulo ? ` de ${titulo}` : ""} termina em ${data || "15 dias"}. Se quiserem seguir, combinem a renovação pela plataforma: o aditivo de prorrogação já vem preenchido.`,
        linhas,
      };
    }
    case "proposta_vencendo": {
      const numero = limpo(d.numero);
      const prazo = d.prazo ? dataHoraBRT(d.prazo, { semEtiqueta: true }) : "";
      const vence = prazo && prazo !== "—" ? prazo : "";
      // E343: o valor do que o dono decide (aceitar, contrapor ou recusar) — mensal e total, como no E202.
      const mensal = reais(d.valorMensal);
      const total = reais(d.totalContrato);
      if (mensal) linhas.push({ rotulo: "Valor mensal", valor: mensal });
      if (limpo(d.contaTotal) || total) linhas.push({ rotulo: "Total do contrato", valor: limpo(d.contaTotal) || total });
      if (numero) linhas.push({ rotulo: "Proposta", valor: numero });
      if (vence) linhas.push({ rotulo: "Vence em", valor: `${vence} (horário de Brasília)` });
      const valores = mensal ? `, de ${mensal} por mês${total ? ` (total do contrato ${total})` : ""},` : "";
      return {
        // O número da proposta vai no corpo, nunca no assunto (régua de assuntos.ts).
        subject: assuntoComTitulo("Proposta de ", titulo, ` vence ${diaHoraNoAssunto(d.prazo) ? `em ${diaHoraNoAssunto(d.prazo)}` : "em 24 horas"}`),
        body: (n) =>
          `${ola(n)}, a proposta${numero ? ` ${numero}` : ""}${titulo ? ` de ${titulo}` : ""}${valores} aguarda a sua resposta e vence ${vence ? `em ${vence} (horário de Brasília)` : "em menos de 24 horas"}. Aceite, contraproponha ou recuse pela plataforma.`,
        linhas,
      };
    }
    case "estadia_instrucoes_pendentes": {
      const libera = dia(diasAntes(d.data, INSTRUCOES_LIBERADAS_DIAS));
      if (data) linhas.push({ rotulo: "Entrada do morador", valor: h ? `${data}, a partir das ${h}` : data });
      if (libera) linhas.push({ rotulo: "O morador recebe as instruções em", valor: libera });
      return {
        subject: assuntoComTitulo("Instruções de chegada: ", titulo, `, entrada ${diaNoAssunto(d.data) || "em 10 dias"}`),
        body: (n) =>
          `${ola(n)}, a entrada do morador${titulo ? ` em ${titulo}` : ""} é em ${data || "10 dias"}. Preencha as instruções de chegada: o morador as recebe ${libera ? `em ${libera}` : "7 dias antes"}.`,
        linhas,
      };
    }
  }
}
