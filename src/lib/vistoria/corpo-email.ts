/*
  E289 (grupo 2) — os e-mails da avaliação de imóvel (vistoria) com os FATOS do caso: o imóvel nomeado (título ·
  bairro, cidade) em todos, a data e a hora da visita nos de visita (agendada, concordância, lembrete, ausência) e o
  avaliador designado (nome público) no aviso ao dono. Só o que o pedido já guarda no momento do disparo. PURO.
  Roda: node --test src/lib/vistoria/corpo-email.test.ts
*/
import { dataHoraBRT } from "../datas-brasilia.ts";
import { imovelDoPedido, type LinhaEmail } from "../parceiros/email-pedido.ts";
import { assuntoComTitulo, diaHoraNoAssunto } from "../notifications/assuntos.ts";

export type EventoVistoria =
  | "vistoria_designada"
  | "vistoria_designado_dono"
  | "vistoria_agendada"
  | "vistoria_concordancia"
  | "vistoria_lembrete"
  | "vistoria_ausencia"
  | "vistoria_laudo_emitido"
  | "vistoria_fora_da_busca"
  | "vistoria_ressalva_vencida"
  | "vistoria_vistoriado_expira"
  | "vistoria_strike"
  | "vistoria_verificacao"
  | "vistoria_devolucao"
  | "vistoria_correcao_enviada";

export const EVENTOS_VISTORIA_COM_FATOS: ReadonlySet<string> = new Set<EventoVistoria>([
  "vistoria_designada",
  "vistoria_designado_dono",
  "vistoria_agendada",
  "vistoria_concordancia",
  "vistoria_lembrete",
  "vistoria_ausencia",
  "vistoria_laudo_emitido",
  "vistoria_fora_da_busca",
  "vistoria_ressalva_vencida",
  "vistoria_vistoriado_expira",
  "vistoria_strike",
  "vistoria_verificacao",
  "vistoria_devolucao",
  "vistoria_correcao_enviada",
]);

export interface FatosVistoria {
  imovel: { titulo?: string | null; bairro?: string | null; cidade?: string | null } | null;
  /** Data e hora da visita (instante ISO), quando o pedido já tem. */
  visita?: string | null;
  /** Nome público do avaliador designado. */
  avaliador?: string | null;
}

export interface CorpoVistoria {
  /** Assunto com o fato e o imóvel (régua de assuntos.ts); null → vale o assunto do modelo. */
  subject: string | null;
  body: (nome?: string) => string;
  linhas: LinhaEmail[];
}

const limpo = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** "05/11/2026 às 10:00" no horário de Brasília (vazio sem data). */
function quando(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = dataHoraBRT(iso, { semEtiqueta: true });
  if (s === "—") return "";
  const [d, h] = s.split(" ");
  return `${d} às ${h}`;
}

export function corpoVistoria(ev: EventoVistoria, f: FatosVistoria): CorpoVistoria {
  const titulo = limpo(f.imovel?.titulo);
  const im = imovelDoPedido(f.imovel ?? null);
  const visita = quando(f.visita);
  const avaliador = limpo(f.avaliador);
  const ola = (n?: string) => `Olá${n ? " " + n : ""}`;
  // "do imóvel Apto X" / "do seu imóvel" — o nome entra sempre que existe.
  const doImovel = (seu: boolean) => (titulo ? `de ${titulo}` : seu ? "do seu imóvel" : "do imóvel");
  const em = (s: string) => (s ? ` em ${s}` : "");
  const vAss = diaHoraNoAssunto(f.visita);
  const linhas: LinhaEmail[] = im ? [{ rotulo: "Imóvel", valor: im }] : [];
  const comVisita = ["vistoria_agendada", "vistoria_concordancia", "vistoria_lembrete", "vistoria_ausencia"].includes(ev);
  if (comVisita && visita) linhas.push({ rotulo: ev === "vistoria_concordancia" ? "Data proposta" : "Visita", valor: `${visita} (horário de Brasília)` });
  if (ev === "vistoria_designado_dono" && avaliador) linhas.push({ rotulo: "Avaliador", valor: avaliador });
  const hb = visita ? `${visita} (horário de Brasília)` : "";

  switch (ev) {
    case "vistoria_designada":
      return {
        subject: assuntoComTitulo("Nova avaliação designada a você: ", titulo),
        body: (n) => `${ola(n)}, a Viva designou você para avaliar ${titulo ? `${im}` : "um imóvel"}. Aceite ou recuse em até 24 horas; sem resposta, a avaliação passa ao próximo avaliador.`,
        linhas,
      };
    case "vistoria_designado_dono":
      return {
        subject: assuntoComTitulo("O avaliador de ", titulo, " foi designado"),
        body: (n) => `${ola(n)}, a Viva designou ${avaliador ? `${avaliador}, avaliador credenciado,` : "o avaliador credenciado"} para a avaliação ${doImovel(true)}. Combine a data da visita pelas mensagens da Viva.`,
        linhas,
      };
    case "vistoria_agendada":
      return {
        subject: vAss ? assuntoComTitulo("Visita de avaliação: ", titulo, `, ${vAss}`) : assuntoComTitulo("Visita de avaliação agendada: ", titulo),
        body: (n) => `${ola(n)}, a visita de avaliação ${doImovel(false)} está agendada${hb ? ` para ${hb}` : ""}. Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso.`,
        linhas,
      };
    case "vistoria_concordancia":
      return {
        subject: vAss ? `Concorda com a visita de avaliação em ${vAss}?` : null,
        body: (n) => `${ola(n)}, o proprietário pediu a avaliação ${titulo ? `de ${titulo}, ` : "do "}imóvel onde você mora${hb ? `, com a visita proposta para ${hb}` : ""}. A visita só acontece se você concordar com a data. O avaliador não fotografa os seus pertences.`,
        linhas,
      };
    case "vistoria_lembrete":
      return {
        subject: assuntoComTitulo(vAss ? `Visita de avaliação amanhã às ${vAss.split(" às ")[1]}: ` : "Visita de avaliação amanhã: ", titulo),
        body: (n) => `${ola(n)}, a visita de avaliação ${doImovel(false)} é amanhã${hb ? `, ${hb}` : ""}. Se precisar mudar, avise pelas mensagens da Viva.`,
        linhas,
      };
    case "vistoria_ausencia":
      return {
        subject: assuntoComTitulo("Ausência na visita de avaliação de ", titulo),
        body: (n) => `${ola(n)}, a visita de avaliação ${doImovel(false)}${em(hb)} não aconteceu por ausência. Veja o que acontece agora na página da avaliação.`,
        linhas,
      };
    case "vistoria_laudo_emitido":
      return {
        subject: assuntoComTitulo("O laudo de avaliação de ", titulo, " saiu"),
        body: (n) => `${ola(n)}, o laudo de avaliação ${doImovel(true)} foi emitido pela Viva. Veja o resultado, o que corrigir (se houver), o prazo e o próximo passo.`,
        linhas,
      };
    case "vistoria_fora_da_busca":
      return {
        subject: assuntoComTitulo("", titulo, " saiu da busca por um item de segurança"),
        body: (n) => `${ola(n)}, a avaliação ${doImovel(true)} encontrou um item de segurança não conforme. O anúncio fica fora da busca até a correção ser comprovada; veja no laudo o que corrigir.`,
        linhas,
      };
    case "vistoria_ressalva_vencida":
      return {
        subject: assuntoComTitulo("O prazo da ressalva de ", titulo, " terminou"),
        body: (n) => `${ola(n)}, o prazo de 15 dias para corrigir as ressalvas do laudo ${doImovel(true)} terminou sem a correção. Veja o que acontece agora e peça uma nova avaliação.`,
        linhas,
      };
    case "vistoria_vistoriado_expira":
      return {
        subject: assuntoComTitulo("A confirmação do nível de ", titulo, " vence em 30 dias"),
        body: (n) => `${ola(n)}, o laudo ${doImovel(true)} completa 12 meses em 30 dias e o nível deixa de aparecer como confirmado por avaliador no dia. Peça uma nova avaliação para manter.`,
        linhas,
      };
    case "vistoria_strike":
      return {
        subject: assuntoComTitulo("Registro da verificação de ", titulo),
        body: (n) => `${ola(n)}, a verificação ${doImovel(true)} gerou um registro. Veja o passo em que você está, o que muda no anúncio e como voltar com uma nova avaliação aprovada.`,
        linhas,
      };
    case "vistoria_verificacao":
      return {
        subject: assuntoComTitulo("A Viva abriu uma verificação de ", titulo),
        body: (n) => `${ola(n)}, a Viva abriu uma verificação do estado ${doImovel(true)}, com o motivo descrito na página da avaliação. Um avaliador credenciado vai combinar a visita.`,
        linhas,
      };
    case "vistoria_devolucao":
      return {
        subject: assuntoComTitulo("Devolução da 2ª avaliação de ", titulo),
        body: (n) => `${ola(n)}, a 2ª avaliação ${doImovel(false)} deu razão ao proprietário. Pela regra da contestação, devolva a ele o valor pago pela 2ª avaliação em até 15 dias; ele confirma o recebimento na plataforma.`,
        linhas,
      };
    case "vistoria_correcao_enviada":
      return {
        subject: assuntoComTitulo("Correção da ressalva enviada: ", titulo),
        body: (n) => `${ola(n)}, o proprietário enviou a foto da correção de uma ressalva do laudo ${doImovel(false)}. Confira para a plataforma emitir a nova versão.`,
        linhas,
      };
  }
}
