/*
  E289 (grupo 2) — os e-mails da avaliação de imóvel (vistoria) com os FATOS do caso: o imóvel nomeado (título ·
  bairro, cidade) em todos, a data e a hora da visita nos de visita (agendada, concordância, lembrete, ausência) e o
  avaliador designado (nome público) no aviso ao dono. Só o que o pedido já guarda no momento do disparo. PURO.
  Roda: node --test src/lib/vistoria/corpo-email.test.ts
*/
import { dataHoraBRT } from "../datas-brasilia.ts";
import { PRAZO_DONO_ACEITAR_HORAS, PRAZO_RESPOSTA_PADRAO_HORAS } from "./prazos.ts";
import { REGRA_DO_REAGENDAMENTO } from "./regras.ts";
import { A_VIVA_AVISA_QUANDO_HOUVER } from "./telas-exibicao.ts";
import { textoDoPrazoDeAceiteDesdeAProposta } from "./relogio-do-pedido.ts";
import { AVISO_EXPIRACAO_DIAS, PRAZO_DEVOLUCAO_DIAS, PRAZO_RESSALVA_DIAS, VALIDADE_LAUDO_MESES } from "./laudo.ts";
import { imovelDoPedido, type LinhaEmail } from "../parceiros/email-pedido.ts";
import { assuntoComTitulo, diaHoraNoAssunto } from "../notifications/assuntos.ts";

export type EventoVistoria =
  | "vistoria_designada"
  | "vistoria_designado_dono"
  | "vistoria_recusada_dono"
  | "vistoria_sem_resposta_dono"
  | "vistoria_proposta_expirada"
  | "vistoria_proposta_expirada_dono"
  | "vistoria_proposta_aceita"
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
  "vistoria_recusada_dono",
  "vistoria_sem_resposta_dono",
  "vistoria_proposta_expirada",
  "vistoria_proposta_expirada_dono",
  "vistoria_proposta_aceita",
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
  imovel: { id?: string | null; titulo?: string | null; bairro?: string | null; cidade?: string | null } | null;
  /** Data e hora da visita (instante ISO), quando o pedido já tem. */
  visita?: string | null;
  /** Nome público do avaliador designado. */
  avaliador?: string | null;
  /** E1160 (3): o número de credenciado do avaliador do pedido — o laudo é dele, e o e-mail diz de quem. */
  numeroCredenciado?: string | null;
  /** E1160 (1): quando a proposta do avaliador chegou — de onde se conta o prazo do aceite do dono. */
  propostaEm?: string | null;
  /** E1160 (2, 4): o pedido voltou (ou nasceu) sem avaliador para o dono escolher — o e-mail não manda "escolher". */
  aguardandoAvaliador?: boolean | null;
  /** E1160 (6): a visita já tinha data e mudou. */
  reagendada?: boolean | null;
  /** E1160 (6): a data que a visita tinha antes da troca, quando ainda se conhece no momento do envio. */
  visitaAnterior?: string | null;
  /** E1160 (5): quem lê. O lembrete do morador é outro texto; a regra do reagendamento só vale para as duas partes. */
  destinatario?: "dono" | "avaliador" | "morador" | null;
}

export interface CorpoVistoria {
  /** Assunto com o fato e o imóvel (régua de assuntos.ts); null → vale o assunto do modelo. */
  subject: string | null;
  body: (nome?: string) => string;
  linhas: LinhaEmail[];
  /** E1160: o botão, quando o do modelo prometeria um passo que o estado do pedido não dá; sem ele vale o do modelo. */
  cta?: string;
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
  // E1160 (6): só o agendamento e o pedido de concordância dizem "nova data" (o lembrete e a ausência falam da visita).
  const reagendada = f.reagendada === true && (ev === "vistoria_agendada" || ev === "vistoria_concordancia");
  const anterior = reagendada ? quando(f.visitaAnterior) : "";
  const rotuloDaVisita = ev === "vistoria_concordancia" ? (reagendada ? "Nova data proposta" : "Data proposta") : reagendada ? "Nova data" : "Visita";
  if (comVisita && visita) linhas.push({ rotulo: rotuloDaVisita, valor: `${visita} (horário de Brasília)` });
  if (anterior) linhas.push({ rotulo: "Data anterior", valor: `${anterior} (horário de Brasília)` });
  if (ev === "vistoria_designado_dono" && avaliador) linhas.push({ rotulo: "Avaliador", valor: avaliador });
  const hb = visita ? `${visita} (horário de Brasília)` : "";
  // "06/11/2026 às 14:30; antes: 05/11/2026 às 10:00 (horário de Brasília)" — o fuso dito uma vez, no fim.
  const novaData = visita ? `: ${visita}${anterior ? `; antes: ${anterior}` : ""} (horário de Brasília)` : "";
  // E1160 (2, 4): o passo do dono segue o estado real do pedido — a mesma frase que a tela usa quando não há quem escolher.
  const semAvaliador = f.aguardandoAvaliador === true;
  const semOutro = `Não há outro avaliador disponível agora; ${A_VIVA_AVISA_QUANDO_HOUVER}.`;
  const escolhaOutro = semAvaliador ? semOutro : "Escolha outro avaliador na página da avaliação.";
  const botaoSemEscolha = semAvaliador ? { cta: "Ver a avaliação" } : {};

  switch (ev) {
    case "vistoria_designada":
      return {
        subject: assuntoComTitulo("Um proprietário escolheu você: ", titulo),
        body: (n) => `${ola(n)}, um proprietário escolheu você para avaliar ${titulo ? `${im}` : "um imóvel"}. Responda no prazo que você declarou (padrão: ${PRAZO_RESPOSTA_PADRAO_HORAS} horas) com o seu valor e o seu prazo, ou recuse; sem resposta, o pedido volta ao proprietário para escolher outro avaliador.`,
        linhas,
      };
    case "vistoria_designado_dono":
      // E1160 (1): este aviso é só o da proposta que chegou. A recusa e a falta de resposta têm cada uma o seu evento —
      // antes os três momentos liam o mesmo texto, que mandava aceitar uma proposta que na recusa não existe.
      return {
        subject: assuntoComTitulo("Proposta de avaliação recebida: ", titulo),
        body: (n) => `${ola(n)}, ${avaliador ? `${avaliador}, avaliador credenciado que você escolheu,` : "o avaliador credenciado que você escolheu"} enviou a proposta de valor e prazo para a avaliação ${doImovel(true)}. ${textoDoPrazoDeAceiteDesdeAProposta(f.propostaEm)}`,
        linhas,
      };
    case "vistoria_recusada_dono":
      // E1160 (1): o avaliador recusou. O pedido já voltou ao dono quando o aviso sai (não há proposta a aceitar).
      return {
        subject: assuntoComTitulo("O avaliador recusou a avaliação de ", titulo, "", { antes: "Avaliador recusou: " }),
        body: (n) => `${ola(n)}, o avaliador credenciado que você escolheu recusou o pedido de avaliação ${doImovel(true)}. ${escolhaOutro}`,
        linhas,
        ...botaoSemEscolha,
      };
    case "vistoria_sem_resposta_dono":
      // E1160 (1): o avaliador não respondeu no prazo que declarou; a rotina devolveu o pedido ao dono.
      return {
        subject: assuntoComTitulo("O avaliador não respondeu no prazo: ", titulo, "", { antes: "Avaliador sem resposta: " }),
        body: (n) => `${ola(n)}, o avaliador credenciado que você escolheu não respondeu no prazo ao pedido de avaliação ${doImovel(true)}. ${escolhaOutro}`,
        linhas,
        ...botaoSemEscolha,
      };
    case "vistoria_proposta_expirada":
      // E1142: ao avaliador, quando a proposta dele vence sem o aceite do dono.
      return {
        subject: assuntoComTitulo("A sua proposta de avaliação expirou: ", titulo),
        body: (n) => `${ola(n)}, o proprietário não aceitou a sua proposta de avaliação ${titulo ? `de ${titulo} ` : ""}no prazo de ${PRAZO_DONO_ACEITAR_HORAS} horas, e ela expirou. ${semAvaliador ? "O pedido voltou ao proprietário." : "O pedido voltou para ele escolher de novo."} Você não precisa fazer nada.`,
        linhas,
      };
    case "vistoria_proposta_expirada_dono":
      // E1144: ao dono, na mesma expiração — o que aconteceu e o que ele faz a seguir (o botão leva à escolha).
      // O assunto aprovado ("O prazo para aceitar a proposta de avaliação terminou: [imóvel]") deixa 1 carácter para o
      // imóvel na régua dos 70; a forma curta é a irmã do assunto do avaliador (E1142), e é ela que nomeia o imóvel.
      return {
        subject: assuntoComTitulo("O prazo para aceitar a proposta de avaliação terminou: ", titulo, "", { antes: "A proposta de avaliação expirou: " }),
        // E1160 (4): "voltou para você escolher" só é verdade se há quem escolher; sem avaliador na cidade, a Viva avisa.
        body: (n) => `${ola(n)}, o prazo de ${PRAZO_DONO_ACEITAR_HORAS} horas para aceitar a proposta de avaliação ${doImovel(true)} terminou, e ela expirou. ${semAvaliador ? semOutro : "O pedido voltou para você escolher de novo."}`,
        linhas,
        ...botaoSemEscolha,
      };
    case "vistoria_proposta_aceita":
      // E1153: ao avaliador, quando o dono aceita a proposta dele. Ainda não há visita: o que falta é combinar a data
      // (antes saía daqui o aviso de "visita agendada", que o sino esconde enquanto o pedido não tem data).
      return {
        subject: assuntoComTitulo("A sua proposta de avaliação foi aceita: ", titulo, "", { antes: "Proposta de avaliação aceita: " }),
        body: (n) => `${ola(n)}, o proprietário aceitou a sua proposta de avaliação${titulo ? ` de ${titulo}` : ""}. Combinem a data da visita.`,
        linhas,
      };
    case "vistoria_agendada":
      // E1160 (6): o reagendamento reenvia este aviso. Antes saía igual ao da primeira marcação; agora diz que a data
      // mudou — e qual era, quando o envio ainda a conhece. Sem o nome do imóvel o assunto é o daqui, não o do modelo
      // ("Visita de avaliação agendada"), que esconderia a troca.
      if (reagendada) {
        return {
          subject: (vAss ? assuntoComTitulo("Nova data da visita: ", titulo, `, ${vAss}`) : assuntoComTitulo("Nova data da visita de avaliação: ", titulo)) ?? `Nova data da visita de avaliação${vAss ? `: ${vAss}` : ""}`,
          body: (n) => `${ola(n)}, a visita de avaliação ${doImovel(false)} tem nova data${novaData}. ${REGRA_DO_REAGENDAMENTO}`,
          linhas,
        };
      }
      return {
        subject: vAss ? assuntoComTitulo("Visita de avaliação: ", titulo, `, ${vAss}`) : assuntoComTitulo("Visita de avaliação agendada: ", titulo),
        body: (n) => `${ola(n)}, a visita de avaliação ${doImovel(false)} está agendada${hb ? ` para ${hb}` : ""}. ${REGRA_DO_REAGENDAMENTO}`,
        linhas,
      };
    case "vistoria_concordancia":
      if (reagendada) {
        return {
          subject: vAss ? `Concorda com a nova data da visita: ${vAss}?` : "Concorda com a nova data da visita de avaliação?",
          body: (n) => `${ola(n)}, o proprietário pediu a avaliação ${titulo ? `de ${titulo}, ` : "do "}imóvel onde você mora, e a visita tem nova data proposta${novaData}. A visita só acontece se você concordar com a data. O avaliador não fotografa os seus pertences.`,
          linhas,
        };
      }
      return {
        subject: vAss ? `Concorda com a visita de avaliação em ${vAss}?` : null,
        body: (n) => `${ola(n)}, o proprietário pediu a avaliação ${titulo ? `de ${titulo}, ` : "do "}imóvel onde você mora${hb ? `, com a visita proposta para ${hb}` : ""}. A visita só acontece se você concordar com a data. O avaliador não fotografa os seus pertences.`,
        linhas,
      };
    case "vistoria_lembrete": {
      // E1160 (5): saiu o convite a mudar ("Se precisar mudar, avise…") — na véspera a troca sem custo pode já não caber.
      // O dono e o avaliador leem a regra da fonte; o morador não é parte do reagendamento e lê o que é dele.
      const amanha = `é amanhã${hb ? `, ${hb}` : ""}.`;
      const subject = assuntoComTitulo(vAss ? `Visita de avaliação amanhã às ${vAss.split(" às ")[1]}: ` : "Visita de avaliação amanhã: ", titulo);
      if (f.destinatario === "morador") {
        return { subject, body: (n) => `${ola(n)}, a visita de avaliação ${titulo ? `de ${titulo}, imóvel onde você mora,` : "do imóvel onde você mora"} ${amanha} O avaliador não fotografa os seus pertences.`, linhas };
      }
      const regra = f.destinatario === "dono" || f.destinatario === "avaliador" ? ` ${REGRA_DO_REAGENDAMENTO}` : "";
      return { subject, body: (n) => `${ola(n)}, a visita de avaliação ${doImovel(false)} ${amanha}${regra}`, linhas };
    }
    case "vistoria_ausencia":
      return {
        subject: assuntoComTitulo("Ausência na visita de avaliação de ", titulo),
        body: (n) => `${ola(n)}, a visita de avaliação ${doImovel(false)}${em(hb)} não aconteceu por ausência. Veja o que acontece agora na página da avaliação.`,
        linhas,
      };
    case "vistoria_laudo_emitido":
      return {
        subject: assuntoComTitulo("O laudo de avaliação de ", titulo, " saiu"),
        // E1160 (3): quem emite e assina o laudo é o avaliador (a tela de assinatura di-lo); a Viva guarda o registro.
        body: (n) => `${ola(n)}, o laudo de avaliação ${doImovel(true)} foi emitido e assinado pelo avaliador credenciado${limpo(f.numeroCredenciado) ? ` nº ${limpo(f.numeroCredenciado)}` : ""}; a Viva guarda o registro. Veja o resultado, o que corrigir (se houver), o prazo e o próximo passo.`,
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
        body: (n) => `${ola(n)}, o prazo de ${PRAZO_RESSALVA_DIAS} dias para corrigir as ressalvas do laudo ${doImovel(true)} terminou sem a correção. Veja o que acontece agora e peça uma nova avaliação.`,
        linhas,
      };
    case "vistoria_vistoriado_expira":
      return {
        subject: assuntoComTitulo("A confirmação do nível de ", titulo, ` vence em ${AVISO_EXPIRACAO_DIAS} dias`),
        body: (n) => `${ola(n)}, o laudo ${doImovel(true)} completa ${VALIDADE_LAUDO_MESES} meses em ${AVISO_EXPIRACAO_DIAS} dias e o nível deixa de aparecer como confirmado por avaliador no dia. Peça uma nova avaliação para manter.`,
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
        // E1160 (2): ninguém é designado — o passo é do dono. Sem avaliador para escolher, a Viva avisa quando houver.
        body: (n) => `${ola(n)}, a Viva abriu uma verificação do estado ${doImovel(true)}, com o motivo descrito na página da avaliação. ${semAvaliador ? `Não há avaliador disponível agora; ${A_VIVA_AVISA_QUANDO_HOUVER}.` : "O próximo passo é seu: escolha o avaliador credenciado na página da avaliação."}`,
        linhas,
      };
    case "vistoria_devolucao":
      return {
        subject: assuntoComTitulo("Devolução da 2ª avaliação de ", titulo),
        body: (n) => `${ola(n)}, a 2ª avaliação ${doImovel(false)} deu razão ao proprietário. Pela regra da contestação, devolva a ele o valor pago pela 2ª avaliação em até ${PRAZO_DEVOLUCAO_DIAS} dias; ele confirma o recebimento na plataforma.`,
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
