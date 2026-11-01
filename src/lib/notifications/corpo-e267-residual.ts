/*
  E267 (residual) — os últimos e-mails a clientes que ainda saíam com o corpo genérico do modelo passam a nomear a
  pessoa ("Olá <nome>", pelo notify), o imóvel e o fato: manutenção (mudança, mensagem e prazo vencido), lembrete do
  interessado, pedido de moradia encerrado, foto do nível pelo celular e internet (remedir e medida do morador abaixo).
  Só o que o ponto de envio já leu; sem "comissão" nem "aluguel". Assuntos pela régua de assuntos.ts. PURO.
  Roda: node --test src/lib/notifications/corpo-e267-residual.test.ts
*/
import { dataHoraBRT } from "../datas-brasilia.ts";
import { imovelDoPedido, type LinhaEmail } from "../parceiros/email-pedido.ts";
import { SO_CATEGORIES } from "../service-orders.ts";
import { statusHumano } from "../status-humano.ts";
import { assuntoComTitulo, diaNoAssunto } from "./assuntos.ts";
import { blocoDados } from "./modelo-email.ts";
import { escaparHtml } from "../escapar-html.ts";

export interface CorpoResidual {
  /** Assunto com o fato e o imóvel; null → vale o assunto do modelo. */
  subject: string | null;
  body: (nome?: string) => string;
  linhas: LinhaEmail[];
}

type Imovel = { titulo?: string | null; bairro?: string | null; cidade?: string | null } | null | undefined;

const limpo = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const ola = (n?: string) => `Olá${n ? " " + n : ""}`;

function dia(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** "05/11/2026 às 10:00" no horário de Brasília; vazio sem data. */
function quando(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = dataHoraBRT(iso, { semEtiqueta: true });
  if (s === "—") return "";
  const [d, h] = s.split(" ");
  return `${d} às ${h}`;
}

function linhaImovel(im: Imovel): LinhaEmail[] {
  const v = imovelDoPedido(im ?? null);
  return v ? [{ rotulo: "Imóvel", valor: v }] : [];
}

/** "hidráulica" (minúscula no meio da frase); "outros" vira só "manutenção". */
export function categoriaNaFrase(categoria: string | null | undefined): string {
  const c = SO_CATEGORIES.find((x) => x.id === categoria);
  return c && c.id !== "outros" ? c.label.toLocaleLowerCase("pt-BR") : "";
}

// ── Manutenção ──────────────────────────────────────────────────────────────────────────────────────────────────
export type FatoManutencao =
  | { tipo: "status"; para: string }
  | { tipo: "provisoria" }
  | { tipo: "confirmada" }
  | { tipo: "mensagem" };

export interface DadosManutencao {
  imovel: Imovel;
  categoria?: string | null;
  abertaEm?: string | null;
  /** Quem agiu (a outra parte de quem recebe). */
  quem: "proprietario" | "morador";
}

export function corpoManutencao(d: DadosManutencao, fato: FatoManutencao): CorpoResidual {
  const titulo = limpo(d.imovel?.titulo);
  const cat = categoriaNaFrase(d.categoria);
  // "manutenção de hidráulica em Apto Santa Mônica" (o artigo vem de quem usa: a/na/da).
  const ordem = `manutenção${cat ? ` de ${cat}` : ""}${titulo ? ` em ${titulo}` : ""}`;
  const quem = d.quem === "proprietario" ? "o proprietário" : "o morador";
  const linhas = linhaImovel(d.imovel);
  if (cat) linhas.push({ rotulo: "Manutenção", valor: cat.charAt(0).toLocaleUpperCase("pt-BR") + cat.slice(1) });
  if (quando(d.abertaEm)) linhas.push({ rotulo: "Aberta em", valor: `${quando(d.abertaEm)} (horário de Brasília)` });
  switch (fato.tipo) {
    case "status": {
      const st = statusHumano(fato.para);
      linhas.push({ rotulo: "Situação agora", valor: st });
      return {
        subject: assuntoComTitulo("Manutenção atualizada: ", titulo),
        body: (n) => `${ola(n)}, ${quem} mudou a ${ordem} para "${st}". Veja o histórico pela plataforma.`,
        linhas,
      };
    }
    case "provisoria":
      return {
        subject: assuntoComTitulo("Solução provisória na manutenção: ", titulo),
        body: (n) => `${ola(n)}, ${quem} marcou a solução provisória na ${ordem}. O prazo da solução definitiva continua valendo.`,
        linhas,
      };
    case "confirmada":
      return {
        subject: assuntoComTitulo("Solução confirmada: ", titulo),
        body: (n) => `${ola(n)}, ${quem} confirmou a solução da ${ordem}. A ordem está concluída.`,
        linhas,
      };
    case "mensagem":
      return {
        subject: assuntoComTitulo("Nova mensagem na manutenção: ", titulo),
        body: (n) => `${ola(n)}, ${quem} escreveu na ${ordem}. Responda pela plataforma.`,
        linhas,
      };
  }
}

/** Prazo do proprietário vencido sem resposta (cron do atendimento). */
export function corpoManutencaoAtrasada(d: { imovel: Imovel; categoria?: string | null; abertaEm?: string | null; prazoHoras: number }): CorpoResidual {
  const titulo = limpo(d.imovel?.titulo);
  const cat = categoriaNaFrase(d.categoria);
  const aberta = quando(d.abertaEm);
  const linhas = linhaImovel(d.imovel);
  if (cat) linhas.push({ rotulo: "Manutenção", valor: cat.charAt(0).toLocaleUpperCase("pt-BR") + cat.slice(1) });
  if (aberta) linhas.push({ rotulo: "Aberta em", valor: `${aberta} (horário de Brasília)` });
  linhas.push({ rotulo: "Prazo para responder", valor: `${d.prazoHoras} horas (vencido)` });
  return {
    subject: assuntoComTitulo("Manutenção sem resposta: ", titulo),
    body: (n) =>
      `${ola(n)}, o pedido de manutenção${cat ? ` de ${cat}` : ""} do seu morador${titulo ? ` em ${titulo}` : ""}${aberta ? `, aberto em ${aberta} (horário de Brasília),` : ""} passou do prazo de ${d.prazoHoras} horas sem resposta. Responda pela plataforma.`,
    linhas,
  };
}

// ── Interessado que aguarda resposta (lembrete pela Viva) ───────────────────────────────────────────────────────
export function corpoLembreteInteressado(d: { imovel: Imovel; interessado?: string | null; desde?: string | null }): CorpoResidual {
  const titulo = limpo(d.imovel?.titulo);
  const quem = limpo(d.interessado);
  const desde = dia(d.desde);
  const linhas = linhaImovel(d.imovel);
  if (quem) linhas.push({ rotulo: "Interessado", valor: quem });
  if (desde) linhas.push({ rotulo: "Candidatura enviada em", valor: desde });
  return {
    subject: assuntoComTitulo("Lembrete: interessado aguarda em ", titulo),
    body: (n) =>
      `${ola(n)}, ${quem || "um interessado"} aguarda a sua resposta${titulo ? ` sobre ${titulo}` : ""}${desde ? ` desde ${desde}` : ""}. Aceite, peça mais informações ou recuse pela plataforma.`,
    linhas,
  };
}

// ── Pedido de moradia encerrado pelo morador ────────────────────────────────────────────────────────────────────
export function corpoPedidoEncerrado(d: { cidade?: string | null; imovel: Imovel }): CorpoResidual {
  const cidade = limpo(d.cidade);
  const titulo = limpo(d.imovel?.titulo);
  const linhas: LinhaEmail[] = [];
  if (cidade) linhas.push({ rotulo: "Pedido em", valor: cidade });
  linhas.push(...linhaImovel(d.imovel).map((l) => ({ ...l, rotulo: "Você respondeu com" })));
  return {
    subject: cidade ? `Pedido de moradia em ${limpo(cidade).slice(0, 30)} encerrado` : null,
    body: (n) =>
      `${ola(n)}, o morador encerrou o pedido de moradia${cidade ? ` em ${cidade}` : ""} que você respondeu${titulo ? ` com ${titulo}` : ""}. Ele não aparece mais na sua lista.`,
    linhas,
  };
}

// ── Foto do item do nível pelo celular ──────────────────────────────────────────────────────────────────────────
export function corpoProvaCelular(d: { imovel: Imovel; item?: string | null; expiraEm?: string | null }): CorpoResidual {
  const titulo = limpo(d.imovel?.titulo);
  const item = limpo(d.item);
  const ate = quando(d.expiraEm);
  const linhas = linhaImovel(d.imovel);
  if (item) linhas.push({ rotulo: "Item", valor: item });
  if (ate) linhas.push({ rotulo: "O link vale até", valor: `${ate} (horário de Brasília)` });
  return {
    subject: assuntoComTitulo("Fotografe pelo celular o item de ", titulo),
    body: (n) =>
      `${ola(n)}, abra este e-mail no celular e toque no botão para fotografar${item ? ` "${item}"` : " o item do nível"}${titulo ? ` de ${titulo}` : ""} na hora, pela câmera. O link vale por 30 minutos e uma vez só.`,
    linhas,
  };
}

// ── Internet ────────────────────────────────────────────────────────────────────────────────────────────────────
const mbps = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? `${Math.round(v)} Mbps` : "");

export function corpoInternetRemedir(d: { imovel: Imovel; validoAte?: string | null }): CorpoResidual {
  const titulo = limpo(d.imovel?.titulo);
  const vence = dia(d.validoAte);
  const linhas = linhaImovel(d.imovel);
  if (vence) linhas.push({ rotulo: "A medição vale até", valor: vence });
  return {
    subject: assuntoComTitulo("Meça de novo a internet de ", titulo, vence ? ` até ${diaNoAssunto(d.validoAte)}` : ""),
    body: (n) =>
      `${ola(n)}, a medição da internet${titulo ? ` de ${titulo}` : " do seu imóvel"} vence ${vence ? `em ${vence}` : "em cerca de 2 semanas"}. Meça de novo, conectado ao Wi-Fi do imóvel, para o anúncio continuar mostrando o número.`,
    linhas,
  };
}

/**
 * E267 (resíduo): o cartão do anúncio para compartilhar (contrato assinado pelas duas partes) diz QUAL anúncio — o dono
 * pode ter vários; antes era "o cartão do seu anúncio está pronto".
 */
export function corpoAnuncioCompartilhar(d: { imovel: Imovel }): CorpoResidual {
  const titulo = limpo(d.imovel?.titulo);
  return {
    subject: assuntoComTitulo("Compartilhe o cartão de ", titulo),
    body: (n) =>
      `${ola(n)}, o contrato${titulo ? ` de ${titulo}` : ""} foi assinado pelas duas partes, e o cartão do anúncio está pronto, com um QR que leva direto ao imóvel. Compartilhe no WhatsApp em um toque.`,
    linhas: linhaImovel(d.imovel),
  };
}

export function corpoInternetAbaixo(d: { imovel: Imovel; morador?: { download?: number; upload?: number } | null; dono?: { download?: number; upload?: number } | null }): CorpoResidual {
  const titulo = limpo(d.imovel?.titulo);
  const mor = d.morador?.download != null ? `${mbps(d.morador.download)} de download e ${mbps(d.morador.upload)} de upload` : "";
  const don = d.dono?.download != null ? `${mbps(d.dono.download)} e ${mbps(d.dono.upload)}` : "";
  const linhas = linhaImovel(d.imovel);
  if (mor) linhas.push({ rotulo: "Medida do morador", valor: mor });
  if (don) linhas.push({ rotulo: "Sua última medição", valor: `${don} (download e upload)` });
  return {
    subject: assuntoComTitulo("A internet medida pelo morador ficou abaixo em ", titulo),
    body: (n) =>
      `${ola(n)}, o morador mediu a internet${titulo ? ` de ${titulo}` : ""} na entrada${mor ? `: ${mor}` : ""}, abaixo da metade da sua última medição${don ? ` (${don})` : ""}. Vale conferir o roteador ou a operadora e medir de novo.`,
    linhas,
  };
}

// ── Calendário importado (Prompt 53) ────────────────────────────────────────────────────────────────────────────
const COMPROMISSO: Record<string, string> = { contrato: "um contrato", proposta: "uma proposta", candidatura: "uma candidatura" };

/** E267 (restante): data importada cruza um compromisso da Viva — o imóvel, as datas de lá e o compromisso daqui. */
export function corpoCalendarioConflito(d: {
  imovel: Imovel;
  importado: { inicio: string; fim: string };
  compromisso: { tipo: string; inicio: string; fim: string };
}): CorpoResidual {
  const titulo = limpo(d.imovel?.titulo);
  const la = `${dia(d.importado.inicio)} a ${dia(d.importado.fim)}`;
  const aqui = `${COMPROMISSO[d.compromisso.tipo] ?? "um compromisso"} de ${dia(d.compromisso.inicio)} a ${dia(d.compromisso.fim)}`;
  const linhas = linhaImovel(d.imovel);
  linhas.push({ rotulo: "Ocupado no outro site", valor: la });
  linhas.push({ rotulo: "Na Viva", valor: aqui.charAt(0).toLocaleUpperCase("pt-BR") + aqui.slice(1) });
  return {
    subject: assuntoComTitulo("Datas importadas cruzam a agenda de ", titulo),
    body: (n) =>
      `${ola(n)}, o calendário importado marcou ${la} como ocupado${titulo ? ` em ${titulo}` : " no seu imóvel"}, e na Viva há ${aqui}. Nada foi cancelado: confira as datas e decida qual vale.`,
    linhas,
  };
}

/** E267 (restante): o link do calendário falhou 3 vezes — o imóvel e a causa. */
export function corpoCalendarioFalha(d: { imovel: Imovel; causa?: string | null }): CorpoResidual {
  const titulo = limpo(d.imovel?.titulo);
  const causa = limpo(d.causa);
  const linhas = linhaImovel(d.imovel);
  if (causa) linhas.push({ rotulo: "O que aconteceu", valor: causa });
  return {
    subject: assuntoComTitulo("Não conseguimos ler o calendário importado de ", titulo),
    body: (n) =>
      `${ola(n)}, tentamos ler o link do calendário do outro site${titulo ? ` de ${titulo}` : ""} 3 vezes seguidas, sem sucesso${causa ? ` (${causa.replace(/\.$/, "")})` : ""}. Enquanto isso, as datas de lá não chegam aqui.`,
    linhas,
  };
}

// ── Verificação de identidade parada (Prompt 50) ──────────────────────────────────────────────────────────────
/** E267 (restante): o motivo da última tentativa e o próximo passo NO CORPO (antes, só na versão em texto). */
export function corpoVerificacaoParada(d: { titulo: string; proximoPasso: string }): CorpoResidual {
  return {
    subject: null,
    body: (n) => `${ola(n)}, a última tentativa de verificar sua identidade não passou: ${d.titulo.toLocaleLowerCase("pt-BR")}. ${d.proximoPasso}`,
    linhas: [
      { rotulo: "Última tentativa", valor: d.titulo },
      { rotulo: "O que fazer agora", valor: d.proximoPasso },
    ],
  };
}

// ── Pedido de moradia: resposta e aceite (E267, resíduo de 01/11) ───────────────────────────────────────────────
/** Ao morador: QUEM respondeu ao pedido de moradia, com QUAL imóvel (antes: "um proprietário respondeu"). */
export function corpoPedidoResposta(d: { imovel: Imovel; quem?: string | null; cidade?: string | null; inicio?: string | null }): CorpoResidual {
  const titulo = limpo(d.imovel?.titulo);
  const quem = limpo(d.quem) || "um proprietário";
  const cidade = limpo(d.cidade);
  const inicio = dia(d.inicio);
  const linhas = linhaImovel(d.imovel);
  if (cidade || inicio) linhas.push({ rotulo: "Seu pedido", valor: [cidade, inicio ? `entrada em ${inicio}` : ""].filter(Boolean).join(", ") });
  return {
    subject: assuntoComTitulo("Resposta ao seu pedido: ", titulo),
    body: (n) =>
      `${ola(n)}, ${quem} respondeu ao seu pedido de moradia${cidade ? ` em ${cidade}` : ""} com ${titulo ? `o imóvel ${titulo}` : "um imóvel"}. Veja e aceite para conversar pela plataforma.`,
    linhas,
  };
}

/** Ao dono: QUEM aceitou a resposta e sobre QUAL imóvel a conversa abriu (antes: "um inquilino aceitou"). */
export function corpoPedidoAceito(d: { imovel: Imovel; quem?: string | null }): CorpoResidual {
  const titulo = limpo(d.imovel?.titulo);
  const quem = limpo(d.quem) || "o morador";
  return {
    subject: assuntoComTitulo("Conversa aberta sobre ", titulo),
    body: (n) =>
      `${ola(n)}, ${quem} aceitou a sua resposta ao pedido de moradia${titulo ? ` com ${titulo}` : ""} e abriu a conversa. Responda pela plataforma.`,
    linhas: linhaImovel(d.imovel),
  };
}

/** O que vai ao notify(): assunto (se houver), abertura e o bloco "Imóvel / …" em HTML escapado. */
export function paraNotify(c: CorpoResidual): { subject?: string; body: (nome?: string) => string; detailsHtml?: string } {
  return {
    ...(c.subject ? { subject: c.subject } : {}),
    body: c.body,
    ...(c.linhas.length ? { detailsHtml: blocoDados(c.linhas.map((l) => ({ rotulo: escaparHtml(l.rotulo), valor: escaparHtml(l.valor) }))) } : {}),
  };
}
