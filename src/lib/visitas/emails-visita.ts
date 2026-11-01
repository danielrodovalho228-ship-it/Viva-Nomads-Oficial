/*
  E325 — os e-mails de visita dizem DE QUAL IMÓVEL é a visita. O pedido ao dono ("Pedido de visita no seu imóvel") e a
  confirmação ("Visita confirmada") saíam sem título nem código: dono com 2+ imóveis e morador com 2+ visitas não sabiam
  de qual se tratava. Agora o assunto leva o título, o corpo diz quem agiu, o imóvel (título + código VN-…) e o fato
  (horários propostos / horário confirmado), e o bloco tem "Imóvel: título · código VN-…". Mesmo padrão do E267.
  Sem nome, telefone ou e-mail do morador para o dono aqui (a regra de nome depois da confirmação é o E328). PURO.
  Roda: node --test src/lib/visitas/emails-visita.test.ts
*/
import { dataHoraBRT } from "../datas-brasilia.ts";
import { codigoDoImovel } from "../imovel-pagina.ts";
import { assuntoComTitulo } from "../notifications/assuntos.ts";

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

/** Visita confirmada → a outra parte. `quemConfirmou`: quem agiu (o dono confirma; o morador aceita o novo horário). */
export function corpoVisitaConfirmada(d: {
  imovel: ImovelDaVisita;
  modalidade: "video" | "presencial";
  horario: string;
  quemConfirmou: "proprietario" | "morador";
}): CorpoVisita {
  const q = quandoVisita(d.horario);
  const quem = d.quemConfirmou === "proprietario" ? "o proprietário confirmou a sua visita" : "o interessado confirmou a visita";
  const linhas: LinhaVisitaEmail[] = [
    { rotulo: "Imóvel", valor: imovelDaVisitaTexto(d.imovel) },
    { rotulo: "Visita", valor: d.modalidade === "video" ? "Por vídeo" : "Presencial" },
  ];
  if (q) linhas.push({ rotulo: "Quando", valor: `${q} (horário de Brasília)` });
  return {
    subject: assuntoComTitulo("Visita confirmada: ", d.imovel.titulo),
    body: (n) => `${ola(n)}, ${quem} ${tipoNaFrase(d.modalidade)} ${aoImovel(d.imovel)}${q ? ` para ${q} (horário de Brasília)` : ""}. Os detalhes ficam em Visitas, na plataforma.`,
    linhas,
  };
}
