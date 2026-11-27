/*
  E325 — os e-mails de visita dizem DE QUAL IMÓVEL é a visita. O pedido ao dono ("Pedido de visita no seu imóvel") e a
  confirmação ("Visita confirmada") saíam sem título nem código: dono com 2+ imóveis e morador com 2+ visitas não sabiam
  de qual se tratava. Agora o assunto leva o título, o corpo diz quem agiu, o imóvel (título + código VN-…) e o fato
  (horários propostos / horário confirmado), e o bloco tem "Imóvel: título · código VN-…". Mesmo padrão do E267.
  Sem telefone ou e-mail do morador para o dono aqui. E1039: na CONFIRMAÇÃO presencial o dono recebe o primeiro nome do
  morador, como na véspera (a confirmação libera o nome — E328). PURO.
  Roda: node --test src/lib/visitas/emails-visita.test.ts
*/
import { dataHoraBRT } from "../datas-brasilia.ts";
import { codigoDoImovel } from "../imovel-pagina.ts";
import { assuntoComTitulo } from "../notifications/assuntos.ts";
import { primeiroNome } from "../display-name.ts";
import { blocoDados } from "../notifications/modelo-email.ts";
import { escaparHtml } from "../escapar-html.ts";

export interface LinhaVisitaEmail {
  rotulo: string;
  valor: string;
}

export interface CorpoVisita {
  /** Assunto com o título do imóvel; null → vale o assunto do modelo. */
  subject: string | null;
  body: (nome?: string) => string;
  linhas: LinhaVisitaEmail[];
}

export interface ImovelDaVisita {
  id: string;
  titulo?: string | null;
}

const ola = (n?: string) => `Olá${n ? " " + n : ""}`;
const limpo = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** "05/11/2026 às 10:00" no horário de Brasília; vazio sem data. */
export function quandoVisita(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = dataHoraBRT(iso, { semEtiqueta: true });
  if (s === "—") return "";
  const [d, h] = s.split(" ");
  return `${d} às ${h}`;
}

/** "Apto Santa Mônica · código VN-3F9A2C" (sem título: só o código). */
export function imovelDaVisitaTexto(im: ImovelDaVisita): string {
  const titulo = limpo(im.titulo);
  const codigo = `código ${codigoDoImovel(im.id)}`;
  return titulo ? `${titulo} · ${codigo}` : codigo;
}

/** "a Apto Santa Mônica (código VN-3F9A2C)" / "ao imóvel de código VN-3F9A2C" para a frase do corpo. */
function aoImovel(im: ImovelDaVisita): string {
  const titulo = limpo(im.titulo);
  const codigo = codigoDoImovel(im.id);
  return titulo ? `a ${titulo} (código ${codigo})` : `ao imóvel de código ${codigo}`;
}

const tipoNaFrase = (modalidade: "video" | "presencial") => (modalidade === "video" ? "por vídeo" : "presencial");

/** Pedido de visita → dono. */
export function corpoVisitaPedida(d: { imovel: ImovelDaVisita; modalidade: "video" | "presencial"; horarios: string[] }): CorpoVisita {
  const horarios = [...d.horarios].sort().map(quandoVisita).filter(Boolean);
  const linhas: LinhaVisitaEmail[] = [
    { rotulo: "Imóvel", valor: imovelDaVisitaTexto(d.imovel) },
    { rotulo: "Visita", valor: d.modalidade === "video" ? "Por vídeo" : "Presencial" },
  ];
  if (horarios.length) linhas.push({ rotulo: "Horários propostos", valor: `${horarios.join("; ")} (horário de Brasília)` });
  return {
    subject: assuntoComTitulo("Pedido de visita: ", d.imovel.titulo),
    body: (n) =>
      `${ola(n)}, um interessado pediu uma visita ${tipoNaFrase(d.modalidade)} ${aoImovel(d.imovel)}. Confirme um dos horários, proponha outro ou recuse pela plataforma.`,
    linhas,
  };
}

/** E424: pedido de visita → cópia ao próprio morador (antes ele não recebia nada). */
export function corpoVisitaPedidaMorador(d: { imovel: ImovelDaVisita; modalidade: "video" | "presencial"; horarios: string[] }): CorpoVisita {
  const horarios = [...d.horarios].sort().map(quandoVisita).filter(Boolean);
  const linhas: LinhaVisitaEmail[] = [
    { rotulo: "Imóvel", valor: imovelDaVisitaTexto(d.imovel) },
    { rotulo: "Visita", valor: d.modalidade === "video" ? "Por vídeo" : "Presencial" },
  ];
  if (horarios.length) linhas.push({ rotulo: "Horários propostos", valor: `${horarios.join("; ")} (horário de Brasília)` });
  const depois =
    d.modalidade === "video"
      ? "O proprietário confirma um dos horários e envia o link da chamada."
      : "O proprietário confirma um dos horários; o endereço exato aparece depois da confirmação.";
  return {
    subject: assuntoComTitulo("Visita pedida: ", d.imovel.titulo),
    body: (n) => `${ola(n)}, seu pedido de visita ${tipoNaFrase(d.modalidade)} ${aoImovel(d.imovel)} foi enviado. ${depois} Você acompanha em Visitas, na plataforma.`,
    linhas,
  };
}

/** Visita confirmada → a outra parte. `quemConfirmou`: quem agiu (o dono confirma; o morador aceita o novo horário). */
export function corpoVisitaConfirmada(d: {
  imovel: ImovelDaVisita;
  modalidade: "video" | "presencial";
  horario: string;
  quemConfirmou: "proprietario" | "morador";
  /** E1039: nome do morador. Só aparece ao DONO de visita presencial (como na véspera), e só o primeiro nome (E328). */
  nomeMorador?: string | null;
}): CorpoVisita {
  const q = quandoVisita(d.horario);
  const quem = d.quemConfirmou === "proprietario" ? "o proprietário confirmou a sua visita" : "o interessado confirmou a visita";
  // E1039: a confirmação traz o que a véspera traria (condição do coordenador, peça 36 da Pista 3).
  // Ao dono (quem confirmou foi o morador) de visita presencial: com quem é a visita.
  const pn = d.quemConfirmou === "morador" && d.modalidade === "presencial" ? primeiroNome(d.nomeMorador) : "";
  // Por vídeo: como entrar na chamada (a mesma frase da véspera; o link cru nunca vai no e-mail — E326).
  const comoEntrar = d.modalidade === "video" ? " Na hora, entre pela página da visita na plataforma." : "";
  // E1039 (texto do coordenador, ORDEM-DUET-258): presencial — o documento com foto, uma linha a cada lado.
  const documento =
    d.modalidade !== "presencial"
      ? ""
      : d.quemConfirmou === "proprietario"
        ? " Leve um documento com foto."
        : " O visitante foi orientado a levar um documento com foto.";
  const linhas: LinhaVisitaEmail[] = [
    { rotulo: "Imóvel", valor: imovelDaVisitaTexto(d.imovel) },
    { rotulo: "Visita", valor: d.modalidade === "video" ? "Por vídeo" : "Presencial" },
  ];
  if (q) linhas.push({ rotulo: "Quando", valor: `${q} (horário de Brasília)` });
  if (pn) linhas.push({ rotulo: "Morador", valor: pn });
  return {
    subject: assuntoComTitulo("Visita confirmada: ", d.imovel.titulo),
    body: (n) =>
      `${ola(n)}, ${quem} ${tipoNaFrase(d.modalidade)}${pn ? ` com ${pn}` : ""} ${aoImovel(d.imovel)}${q ? ` para ${q} (horário de Brasília)` : ""}.${comoEntrar}${documento} Os detalhes ficam em Visitas, na plataforma.`,
    linhas,
  };
}

/**
 * E1039 (trava): os detalhes do aviso de visita como saem no e-mail — bloco de dados (linhas do corpo), a frase do
 * fato e, só quando vier (visita presencial confirmada, ao morador), o endereço exato e "Abrir no mapa". Era montado
 * dentro do avisarVisita (visitas-video-actions.ts); saiu para cá, igual, para o conteúdo ter teste determinístico.
 */
export function detalhesDoAvisoVisita(d: {
  detalhe: string;
  endereco?: { texto: string; mapa: string } | null;
  linhas?: LinhaVisitaEmail[] | null;
}): { texto: string; html: string } {
  const { detalhe, endereco } = d;
  return {
    texto: endereco ? `${detalhe}\nEndereço: ${endereco.texto}\nAbrir no mapa: ${endereco.mapa}` : detalhe,
    html:
      (d.linhas ? blocoDados(d.linhas.map((l) => ({ rotulo: escaparHtml(l.rotulo), valor: escaparHtml(l.valor) }))) : "") +
      `<p style="margin:12px 0 0">${detalhe.replace(/[<>&]/g, "")}</p>` +
      (endereco
        ? `<p style="margin:8px 0 0"><strong>Endereço:</strong> ${endereco.texto.replace(/[<>&"]/g, "")}</p><p style="margin:8px 0 0"><a href="${endereco.mapa.replace(/"/g, "%22")}">Abrir no mapa</a></p>`
        : ""),
  };
}
