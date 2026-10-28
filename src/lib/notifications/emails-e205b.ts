/*
  E205-B — e-mails novos (desenho do coordenador, msg 65 de 28/10). PURO: textos, passos e regras de data.
  Regras de todos: um botão só; da outra parte, só o primeiro nome e só quando houver; vocabulário da casa ("taxa de
  serviço", "morador"; nada de "aluguel" no assunto); prazo SÓ quando o sistema tem um — sem prazo, sem data no texto.
  Roda: node --test src/lib/notifications/emails-e205b.test.ts
*/
import { primeiroNome } from "../display-name.ts";
import { dataBR } from "./dados-negociacao.ts";
import { blocoDados, botaoEmail } from "./modelo-email.ts";
import { escaparHtml } from "../escapar-html.ts";

const ola = (n?: string) => `Olá${n ? " " + n : ""}`;
const DIA_MS = 86_400_000;

/**
 * Os detalhes do e-mail: quadro de dados, passos numerados, linha de rodapé e, quando o destino é EXTERNO (mapa,
 * chamada), o próprio botão — com um link nos detalhes o modelo não põe o botão padrão (continua UM botão só).
 */
export function detalhes(o: {
  linhas?: { rotulo: string; valor: string }[];
  titulo?: string;
  passos?: string[];
  rodape?: string;
  externo?: { label: string; url: string } | null;
}): { html: string; texto: string } {
  const linhas = o.linhas ?? [];
  const passos = o.passos ?? [];
  const externo = o.externo && /^https:\/\//.test(o.externo.url) ? o.externo : null;
  const html =
    blocoDados(linhas.map((l) => ({ rotulo: escaparHtml(l.rotulo), valor: escaparHtml(l.valor) }))) +
    (passos.length
      ? `${o.titulo ? `<p style="margin:0 0 6px;font-weight:700;">${escaparHtml(o.titulo)}</p>` : ""}<ol style="margin:0 0 16px;padding-left:20px;">${passos.map((p) => `<li style="margin:0 0 6px;">${escaparHtml(p)}</li>`).join("")}</ol>`
      : "") +
    (o.rodape ? `<p style="margin:0 0 16px;">${escaparHtml(o.rodape)}</p>` : "") +
    (externo ? `<div style="margin-top:20px;">${botaoEmail(escaparHtml(externo.url), escaparHtml(externo.label))}</div>` : "");
  const texto = [
    ...linhas.map((l) => `${l.rotulo}: ${l.valor}`),
    ...(passos.length ? [...(o.titulo ? [o.titulo] : []), ...passos.map((p, i) => `${i + 1}. ${p}`)] : []),
    ...(o.rodape ? [o.rodape] : []),
    ...(externo ? [`${externo.label}: ${externo.url}`] : []),
  ].join("\n");
  return { html, texto };
}

/* ── (a) Boas-vindas ─────────────────────────────────────────────────────────────────────────────────────────── */

export type PerfilBoasVindas = "morador" | "proprietario";

/** Linha fixa de todas as boas-vindas. */
export const LINHA_DINHEIRO = "A Viva não recebe nem guarda dinheiro: o pagamento é direto entre vocês.";

export interface EmailPassos {
  assunto: string;
  abertura: (nome?: string) => string;
  /** Título do quadro de passos. */
  titulo: string;
  passos: string[];
  rodape?: string;
  cta: string;
  url: string;
}

/** O perfil das boas-vindas pela intenção do cadastro; sem intenção, pelo modo escolhido; senão, morador. */
export function perfilDasBoasVindas(intencao: readonly string[], modo: "owner" | "tenant" | null): PerfilBoasVindas {
  const morar = intencao.includes("morar");
  const anunciar = intencao.includes("anunciar");
  if (anunciar && !morar) return "proprietario";
  if (morar && !anunciar) return "morador";
  return modo === "owner" ? "proprietario" : "morador";
}

export function boasVindas(perfil: PerfilBoasVindas): EmailPassos {
  if (perfil === "proprietario")
    return {
      assunto: "Boas-vindas: como anunciar o seu imóvel",
      abertura: (n) => `${ola(n)}, a sua conta no Viva Nomads está pronta. Anunciar leva três passos.`,
      titulo: "Como anunciar",
      passos: [
        "Qualificação: confira se o imóvel atende o padrão mínimo para estadias de 30 a 180 dias.",
        "Cadastro: fotos, valores e regras da casa.",
        "Publicar: o anúncio entra na busca e os interessados falam com você pela plataforma.",
      ],
      rodape: LINHA_DINHEIRO,
      cta: "Anunciar meu imóvel",
      url: "/dashboard/imoveis/novo",
    };
  return {
    assunto: "Boas-vindas: como achar e garantir o seu imóvel",
    abertura: (n) => `${ola(n)}, a sua conta no Viva Nomads está pronta. Achar e garantir o seu imóvel leva três passos.`,
    titulo: "Como achar e garantir o seu imóvel",
    passos: [
      "Buscar: imóveis mobiliados para 30 a 180 dias, com filtros de cidade, valor e datas.",
      "Conversar ou visitar: tire dúvidas pelas mensagens ou peça uma visita.",
      "Receber a proposta: o proprietário envia valores e datas para você aceitar, ajustar ou recusar.",
    ],
    rodape: LINHA_DINHEIRO,
    cta: "Começar a buscar",
    url: "/buscar",
  };
}

/* ── (b) Proposta aceita ─────────────────────────────────────────────────────────────────────────────────────── */

/** Ao dono: "{primeiro nome} quer morar no seu imóvel" (sem nome: "o morador"). */
export function propostaAceitaDono(o: { nomeMorador?: string | null; leadId: string }): EmailPassos {
  const pn = primeiroNome(o.nomeMorador);
  return {
    assunto: `Proposta aceita: ${pn || "o morador"} quer morar no seu imóvel`,
    abertura: (n) => `${ola(n)}, ${pn || "o morador"} aceitou a proposta. O próximo passo é o contrato.`,
    titulo: "Próximo passo",
    passos: ["Prepare o contrato no fechamento: os valores e as datas desta proposta já vão preenchidos."],
    cta: "Preparar o contrato",
    url: `/dashboard/fechamento?c=${o.leadId}`,
  };
}

/** Uma etapa da linha do tempo do morador; `prazo` só quando o sistema tem a data. */
export interface EtapaLinhaDoTempo {
  rotulo: string;
  prazo: string | null;
}

/**
 * A linha do tempo do morador depois do aceite. Prazos que o sistema tem: a Caução vence na entrada (regra
 * publicada "antes da entrada") e as instruções de chegada saem 7 dias antes da entrada (cron D-7). O contrato e o
 * 1º pagamento não têm prazo no sistema: vão sem data.
 */
export function linhaDoTempoMorador(dataEntrada: string | null | undefined): EtapaLinhaDoTempo[] {
  const entrada = String(dataEntrada ?? "").slice(0, 10);
  const t = Date.parse(`${entrada}T12:00:00Z`);
  const temEntrada = /^\d{4}-\d{2}-\d{2}$/.test(entrada) && Number.isFinite(t);
  const d7 = temEntrada ? new Date(t - 7 * DIA_MS).toISOString().slice(0, 10) : null;
  return [
    { rotulo: "Contrato para assinar", prazo: null },
    { rotulo: "Caução, quando o contrato tiver", prazo: temEntrada ? `até a entrada, em ${dataBR(entrada)}` : null },
    { rotulo: "Primeiro pagamento, direto ao proprietário", prazo: null },
    { rotulo: "Instruções de chegada", prazo: d7 ? `7 dias antes da entrada, em ${dataBR(d7)}` : "7 dias antes da entrada" },
  ];
}

export const textoEtapa = (e: EtapaLinhaDoTempo) => (e.prazo ? `${e.rotulo}: ${e.prazo}` : e.rotulo);

/** Ao morador: "Você garantiu o seu próximo lar". */
export function propostaAceitaMorador(o: { dataEntrada: string | null; propostaId: string }): EmailPassos {
  return {
    assunto: "Você garantiu o seu próximo lar",
    abertura: (n) => `${ola(n)}, a proposta foi aceita. Veja o que vem agora, na ordem.`,
    titulo: "Próximos passos",
    passos: linhaDoTempoMorador(o.dataEntrada).map(textoEtapa),
    rodape: LINHA_DINHEIRO,
    cta: "Ver os próximos passos",
    url: `/dashboard/propostas/${o.propostaId}`,
  };
}

/* ── (c) Proposta recusada ───────────────────────────────────────────────────────────────────────────────────── */

/**
 * Recusa: o assunto diz quem recusou (primeiro nome; sem nome, "O morador"/"O proprietário"), o corpo diz o motivo
 * quando houver. Tom neutro. Recusa do morador → dono ajusta e envia nova versão; recusa do dono → morador vê
 * imóveis parecidos (mesma cidade).
 */
export function propostaRecusada(o: {
  quemRecusou: "owner" | "tenant";
  nomeDeQuemRecusou?: string | null;
  motivo?: string | null;
  texto?: string | null;
  propostaId: string;
  cidade?: string | null;
}): EmailPassos {
  const pn = primeiroNome(o.nomeDeQuemRecusou);
  const quem = pn || (o.quemRecusou === "tenant" ? "O morador" : "O proprietário");
  const motivo = [o.motivo?.trim(), o.texto?.trim()].filter(Boolean).join(". ");
  const paraDono = o.quemRecusou === "tenant";
  const cidade = o.cidade?.trim();
  return {
    assunto: `${quem} recusou a proposta`,
    abertura: (n) =>
      `${ola(n)}, ${pn || quem.toLowerCase()} recusou a proposta.${motivo ? ` Motivo: ${motivo}.` : ""} ${
        paraDono ? "Se fizer sentido, ajuste os valores ou as datas e envie uma nova versão." : "Há outros imóveis parecidos na busca."
      }`.replace(/\.\./g, "."),
    titulo: "",
    passos: [],
    cta: paraDono ? "Ajustar e enviar nova versão" : "Ver outros imóveis parecidos",
    url: paraDono ? `/dashboard/propostas/${o.propostaId}` : cidade ? `/buscar?cidade=${encodeURIComponent(cidade)}` : "/buscar",
  };
}

/* ── (d) Visitas ─────────────────────────────────────────────────────────────────────────────────────────────── */

/** O motivo gravado quando o pedido expira (status "cancelado"; sem status novo, sem migração). */
export const MOTIVO_EXPIROU = "expirou";

/** Cancelada: quem cancelou, o motivo e o horário. Ao morador, o botão é "Pedir outro horário". */
export function visitaCancelada(o: {
  quemCancelou: "dono" | "morador";
  nomeDeQuemCancelou?: string | null;
  motivo?: string | null;
  horario?: string | null;
  tipo: string;
  imovel?: string | null;
  propertyId: string;
  paraMorador: boolean;
}): { abertura: (n?: string) => string; linhas: { rotulo: string; valor: string }[]; cta: string; url: string } {
  const pn = primeiroNome(o.nomeDeQuemCancelou);
  const quem = pn || (o.quemCancelou === "dono" ? "O proprietário" : "O morador");
  const linhas = [
    ...(o.imovel ? [{ rotulo: "Imóvel", valor: o.imovel }] : []),
    { rotulo: "Visita", valor: o.tipo },
    ...(o.horario ? [{ rotulo: "Horário", valor: o.horario }] : []),
    { rotulo: "Cancelada por", valor: quem },
    ...(o.motivo?.trim() ? [{ rotulo: "Motivo", valor: o.motivo.trim() }] : []),
  ];
  return {
    abertura: (n) => `${ola(n)}, ${pn || quem.toLowerCase()} cancelou a visita ${o.tipo}.${o.paraMorador ? " Se ainda quiser conhecer o imóvel, peça outro horário." : ""}`,
    linhas,
    cta: o.paraMorador ? "Pedir outro horário" : "Ver as visitas",
    url: o.paraMorador ? `/imoveis/${o.propertyId}` : "/dashboard/visitas",
  };
}

export const TEXTO_EXPIRADA_MORADOR = "O pedido expirou sem resposta. Peça outros horários.";
export const TEXTO_EXPIRADA_DONO = "Um pedido de visita expirou sem resposta. Responder rápido aumenta as suas chances.";

/** O pedido expira quando TODOS os horários propostos passaram sem confirmação (só status "pedido"). */
export function pedidoDeVisitaExpirou(v: { status: string; horarios: readonly string[] }, agora: Date): boolean {
  if (v.status !== "pedido" || v.horarios.length === 0) return false;
  return v.horarios.every((h) => {
    const t = Date.parse(h);
    return Number.isFinite(t) && t <= agora.getTime();
  });
}

/** Véspera: ~24 h antes do horário confirmado. */
export const VESPERA_MS = 24 * 3600_000;

/**
 * A véspera sai agora? Visita confirmada, ainda não passou e faltam no máximo 24 h. Vale para o cron (que passa a
 * cada 15 min) e para a confirmação com menos de 24 h de antecedência (sai na hora). A chave de envio garante uma vez.
 */
export function vesperaDaVisita(v: { status: string; horarioConfirmado: string | null }, agora: Date): boolean {
  if (v.status !== "confirmado" || !v.horarioConfirmado) return false;
  const t = Date.parse(v.horarioConfirmado);
  if (!Number.isFinite(t)) return false;
  const falta = t - agora.getTime();
  return falta > 0 && falta <= VESPERA_MS;
}

/**
 * O texto da véspera, por lado e modalidade:
 *  • presencial ao MORADOR: horário de Brasília + endereço exato + "Abrir no mapa" (regra de endereco-visita.ts);
 *  • presencial ao DONO: horário + primeiro nome do morador (sem endereço);
 *  • vídeo: "Entrar na chamada" para os dois.
 */
export function vesperaTexto(o: {
  modalidade: "presencial" | "video";
  paraMorador: boolean;
  horario: string;
  imovel?: string | null;
  nomeMorador?: string | null;
  endereco?: { texto: string; mapa: string } | null;
  linkChamada?: string | null;
}): { abertura: (n?: string) => string; linhas: { rotulo: string; valor: string }[]; cta: string; url: string } {
  const linhas = [...(o.imovel ? [{ rotulo: "Imóvel", valor: o.imovel }] : []), { rotulo: "Horário", valor: o.horario }];
  if (o.modalidade === "video") {
    return {
      abertura: (n) => `${ola(n)}, a visita por vídeo é amanhã ou nas próximas horas. Na hora, entre pela chamada.`,
      linhas,
      cta: "Entrar na chamada",
      url: o.linkChamada || "/dashboard/visitas",
    };
  }
  if (o.paraMorador) {
    return {
      abertura: (n) => `${ola(n)}, a visita presencial é amanhã ou nas próximas horas. O endereço está abaixo.`,
      linhas: [...linhas, ...(o.endereco ? [{ rotulo: "Endereço", valor: o.endereco.texto }] : [])],
      cta: "Abrir no mapa",
      url: o.endereco?.mapa || "/dashboard/visitas",
    };
  }
  const pn = primeiroNome(o.nomeMorador);
  return {
    abertura: (n) => `${ola(n)}, ${pn ? `a visita presencial com ${pn}` : "a visita presencial"} é amanhã ou nas próximas horas.`,
    linhas: [...linhas, ...(pn ? [{ rotulo: "Morador", valor: pn }] : [])],
    cta: "Ver a visita",
    url: "/dashboard/visitas",
  };
}
