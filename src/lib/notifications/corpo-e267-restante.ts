/*
  E267 (restante) — os e-mails a clientes que ainda abriam com a frase genérica do modelo ("você recebeu uma nova
  mensagem", "o inquilino abriu um pedido de manutenção no seu imóvel", "a entrada no imóvel do seu contrato está
  chegando", "o total por mês do seu anúncio", "recebemos seu chamado") passam a nomear no CORPO a pessoa ("Olá <nome>",
  pelo notify), o imóvel (quando há um) e o fato (quem escreveu, urgência e prazo, data da entrada, valores, número e
  assunto do chamado). Só o que o ponto de envio já leu. PURO.

  O corpo entra cru no HTML e no texto (a mesma função serve aos dois): o texto do usuário (título do anúncio, nome,
  assunto do chamado) passa por `seguro` — sem links e sem < > " &, para valer nas duas versões.
  Roda: node --test src/lib/notifications/corpo-e267-restante.test.ts
*/
import { textoPlano } from "./texto-seguro.ts";

const ola = (n?: string) => `Olá${n ? " " + n : ""}`;

/** Texto do usuário que vale no HTML e no texto do e-mail: sem links, sem marcação, curto. */
export function seguro(t: string | null | undefined, max = 120): string {
  return textoPlano(t, max).replace(/&/g, " e ").replace(/[<>"]/g, "").replace(/\s+/g, " ").trim();
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v).replace(/ /g, " ");

function dia(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** "05/11/2026 às 10:00" no horário de Brasília. */
function diaHoraBRT(d: Date): string {
  const s = d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return s.replace(",", " às");
}

// ── Mensagem nova ────────────────────────────────────────────────────────────────────────────────────────────────
export function corpoMensagemNova(d: { remetente: string | null | undefined; imovelTitulo?: string | null }): (nome?: string) => string {
  const quem = seguro(d.remetente, 40) || "Uma pessoa";
  const titulo = seguro(d.imovelTitulo);
  return (n) => `${ola(n)}, ${quem} mandou uma mensagem para você no Viva Nomads${titulo ? ` sobre ${titulo}` : ""}. Responda pela plataforma.`;
}

// ── Manutenção nova (ao proprietário) ────────────────────────────────────────────────────────────────────────────
export function corpoManutencaoNova(d: { imovelTitulo?: string | null; urgente: boolean; prazo: Date; lembrete?: boolean }): (nome?: string) => string {
  const titulo = seguro(d.imovelTitulo === "seu imóvel" ? null : d.imovelTitulo);
  const onde = titulo ? `em ${titulo}` : "no seu imóvel";
  const urg = d.urgente ? " urgente" : "";
  const abertura = d.lembrete ? `o pedido de manutenção${urg} ${onde} ainda espera a sua resposta` : `o morador abriu um pedido de manutenção${urg} ${onde}`;
  return (n) => `${ola(n)}, ${abertura}. Responda pela plataforma até ${diaHoraBRT(d.prazo)} (horário de Brasília).`;
}

// ── Lembrete da entrada ──────────────────────────────────────────────────────────────────────────────────────────
export function corpoLembreteEntrada(d: { imovelTitulo?: string | null; entrada: string; amanha: boolean; horario?: string | null; morador: boolean }): (nome?: string) => string {
  const titulo = seguro(d.imovelTitulo);
  const onde = titulo ? ` em ${titulo}` : " no imóvel do seu contrato";
  const quando = d.amanha ? `amanhã (${dia(d.entrada)})` : `em ${dia(d.entrada)}`;
  const hora = seguro(d.horario, 10);
  const sujeito = d.morador ? `a sua entrada${onde}` : `a entrada do morador${onde}`;
  return (n) => `${ola(n)}, ${sujeito} é ${quando}${hora ? `, a partir das ${hora}` : ""}. Confira o horário e as instruções de entrada pela plataforma.`;
}

// ── Preço justo acima do Airbnb ──────────────────────────────────────────────────────────────────────────────────
export function corpoPrecoJustoAcima(d: { imovelTitulo?: string | null; totalViva: number; valorAirbnb: number; ate: number }): (nome?: string) => string {
  const titulo = seguro(d.imovelTitulo);
  const anuncio = titulo ? `de ${titulo}` : "do seu anúncio";
  return (n) =>
    `${ola(n)}, o total por mês ${anuncio} na Viva (${brl(d.totalViva)}) ficou igual ou acima do mesmo imóvel no Airbnb (${brl(d.valorAirbnb)} em 30 noites, com descontos, limpeza e taxas). Por isso o anúncio está sem o selo "Preço justo"; com o total por mês até ${brl(d.ate)}, ele volta. Só você recebe este aviso.`;
}

// ── Chamado (Central de Ajuda) ───────────────────────────────────────────────────────────────────────────────────
export type EventoChamado = "chamado_aberto" | "chamado_respondido" | "chamado_resolvido";
export function corpoChamado(evento: EventoChamado, d: { numero: string | null | undefined; assunto?: string | null }): (nome?: string) => string {
  const num = String(d.numero ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);
  const ass = seguro(d.assunto, 80);
  const chamado = `seu chamado${num ? ` ${num}` : ""}${ass ? ` (${ass})` : ""}`;
  const frase = {
    chamado_aberto: `recebemos ${chamado} na Central de Ajuda do Viva Nomads. Você acompanha e responde por lá.`,
    chamado_respondido: `a equipe Viva Nomads respondeu ${chamado}.`,
    chamado_resolvido: `marcamos ${chamado} como resolvido. Se algo ficou pendente, é só responder por lá.`,
  }[evento];
  return (n) => `${ola(n)}, ${frase}`;
}
