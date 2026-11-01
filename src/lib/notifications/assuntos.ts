/*
  Assuntos dos e-mails de cliente — FONTE ÚNICA (rota rápida "e-mails profissionais", item 2). PURO.
  Regras (testadas sobre todos os assuntos gerados): até 70 caracteres, começa com maiúscula, nenhuma palavra em caixa
  alta, sem código interno (#, ORC-, CAU-, REC-, VN-, 4+ dígitos seguidos) — exceto o número do chamado no fim,
  entre parênteses —, sem slug, sem emoji, sem "[TESTE]" e terminando em "· Viva Nomads" (a marca aparece mesmo
  quando o celular corta o nome do remetente). O título do imóvel pode entrar (até 40 caracteres); número de
  documento, proposta ou contrato vai no corpo, nunca no assunto.
*/
export const SUFIXO_ASSUNTO = " · Viva Nomads";
export const ASSUNTO_MAX = 70;
const TITULO_IMOVEL_MAX = 40;

/** Põe a marca no fim (uma vez só). */
export function comMarca(assunto: string): string {
  const limpo = assunto.replace(/\s+/g, " ").trim().replace(/\s*[·—-]\s*Viva Nomads$/i, "");
  return `${limpo}${SUFIXO_ASSUNTO}`;
}

/** Título do anúncio para o assunto: sem quebra, sem link, até 40 caracteres. */
export function tituloNoAssunto(titulo: string | null | undefined, max = TITULO_IMOVEL_MAX): string {
  const t = String(titulo ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "")
    // 4+ dígitos seguidos (número de apartamento, telefone, código) ficam fora do assunto: a regra do item 2 vale
    // também para o que o usuário escreveu.
    .replace(/\d{4,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "seu imóvel";
  return t.length > max ? cortarEmPalavra(t, max) : t;
}

/**
 * E342: corta o título numa FRONTEIRA DE PALAVRA, com "…" — o nome nunca morre no meio ("Automaçõ…"). Uma palavra só
 * maior que o espaço (sem fronteira antes) cai no corte por letra, para o assunto ainda caber.
 */
function cortarEmPalavra(t: string, max: number): string {
  const limite = max - 1;
  const palavras = t.split(" ");
  let out = "";
  for (const w of palavras) {
    const prox = out ? `${out} ${w}` : w;
    if (prox.length > limite) break;
    out = prox;
  }
  out = out.replace(/[\s,;:·—-]+$/u, "");
  return out ? `${out}…` : `${t.slice(0, limite).trimEnd()}…`;
}

/** E342: o título cortado ainda diz qual é o imóvel? Precisa sobrar ao menos uma palavra de verdade fora do "[TESTE …]". */
function tituloAindaIdentifica(cortado: string): boolean {
  // A marca "[TESTE …]" (inteira ou cortada, sem o "]") não identifica imóvel nenhum.
  const semMarca = cortado.replace(/…$/, "").replace(/\[[^\]]*(?:\]|$)/g, " ");
  return /[\p{L}\d]{3,}/u.test(semMarca);
}

const CHAMADO_NO_FIM = /\s\(VN-[A-Z0-9-]{1,20}\)$/;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}]/u;

/** O que está fora da regra (vazio = assunto aprovado). */
export function problemasDoAssunto(assunto: string): string[] {
  const p: string[] = [];
  if (!assunto.endsWith(SUFIXO_ASSUNTO)) p.push("não termina com '· Viva Nomads'");
  if (assunto.length > ASSUNTO_MAX) p.push(`mais de ${ASSUNTO_MAX} caracteres`);
  const miolo = assunto.slice(0, assunto.length - (assunto.endsWith(SUFIXO_ASSUNTO) ? SUFIXO_ASSUNTO.length : 0));
  if (!/^[A-ZÀ-Ý0-9]/.test(miolo)) p.push("não começa com maiúscula");
  if (/\b[A-ZÀ-Ý]{3,}\b/u.test(miolo.replace(/[A-ZÀ-Ý]+-/g, ""))) p.push("palavra em caixa alta");
  const semChamado = miolo.replace(CHAMADO_NO_FIM, "");
  if (/#|\b(?:ORC|CAU|REC|VN)-/i.test(semChamado)) p.push("código interno no assunto");
  if (/\d{4,}/.test(semChamado)) p.push("número longo no assunto");
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(miolo) || /\d\d-/.test(semChamado)) p.push("parece slug");
  if (EMOJI.test(assunto)) p.push("emoji");
  if (/\[TESTE\]/i.test(assunto)) p.push("[TESTE] no assunto");
  return p;
}

// ── Assuntos fixos (sem marca; o envio põe "· Viva Nomads") ─────────────────────────────────────────────────────
export const ASSUNTOS = {
  codigoAssinatura: "Seu código para assinar o contrato",
  codigo2fa: "Seu código de segurança",
  codigoVinculo: "Seu código do vínculo profissional",
  exclusaoConta: "Confirme a exclusão da sua conta",
  parceriaAprovada: "Sua parceria foi aprovada: ative sua página",
  recibo: "Seu recibo de pagamento",
  comprovanteCaucao: "Seu comprovante de Caução",
  termoDevolucao: "Termo de devolução da Caução",
  contratoPronto: "Seu contrato está pronto para assinar",
  contratoFaltaVoce: "Falta a sua assinatura no contrato",
  contratoAssinado: "Contrato assinado pelas duas partes",
  propostaRecebida: "Você recebeu uma proposta",
  propostaRespondida: "Sua proposta foi respondida",
  propostaAceita: "Sua proposta foi aceita",
  manutencao: "Pedido de manutenção no seu imóvel",
  manutencaoUrgente: "Manutenção urgente no seu imóvel",
  manutencaoLembrete: "Lembrete: manutenção sem resposta no seu imóvel",
  lembreteInteressado: "Lembrete: um interessado aguarda sua resposta",
  // E269: a cópia de quem cancelou a visita.
  visitaCanceladaPorVoce: "Você cancelou a visita",
} as const;

export function assuntoChamado(evento: "chamado_aberto" | "chamado_respondido" | "chamado_resolvido", numero: string): string {
  const base = { chamado_aberto: "Recebemos seu chamado", chamado_respondido: "Seu chamado foi respondido", chamado_resolvido: "Seu chamado foi resolvido" }[evento];
  const n = String(numero ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);
  return n ? `${base} (${n})` : base;
}

export function assuntoManutencao(o: { urgente: boolean; lembrete: boolean }): string {
  if (o.lembrete) return ASSUNTOS.manutencaoLembrete;
  return o.urgente ? ASSUNTOS.manutencaoUrgente : ASSUNTOS.manutencao;
}

/** Decisão de documento (item 3b): um documento só, ou o resultado agrupado do imóvel. */
export function assuntoDecisaoDocumento(o: { titulo: string | null | undefined; linhas: { aprovado: boolean }[] }): string {
  const prefixo =
    // "Resultado da conferência dos documentos: " deixava só 15 caracteres para o título; esta forma deixa 28.
    o.linhas.length > 1 ? "Conferência dos documentos: " : o.linhas[0]?.aprovado ? "Documento aprovado: " : "Documento precisa de ajuste: ";
  // O título encolhe para o assunto inteiro (com a marca) caber em 70 caracteres.
  const cabe = Math.min(TITULO_IMOVEL_MAX, ASSUNTO_MAX - SUFIXO_ASSUNTO.length - prefixo.length);
  return `${prefixo}${tituloNoAssunto(o.titulo, cabe)}`;
}

/** Nome (dono ou parceiro) no assunto: sem controle nem número longo, sem palavra em caixa alta, até 24 caracteres. */
export function nomeNoAssunto(nome: string | null | undefined, max = 24): string {
  const t = String(nome ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/\d{4,}/g, "")
    .replace(/\b([A-ZÀ-Ý])([A-ZÀ-Ý]{2,})\b/gu, (_, a: string, b: string) => a + b.toLocaleLowerCase("pt-BR"))
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Vínculo de parceiro fixo (Prompt 38): convite ao parceiro e resposta ao dono. `servico` = "limpeza fixa" etc. */
export function assuntoVinculoConvite(nomeDono: string | null | undefined, servico: string): string {
  const quem = nomeNoAssunto(nomeDono) || "Um proprietário";
  return `${quem.charAt(0).toLocaleUpperCase("pt-BR")}${quem.slice(1)} quer você como ${servico}`;
}

export function assuntoVinculoResposta(nomeParceiro: string | null | undefined, servico: string, aceitou: boolean): string {
  const quem = nomeNoAssunto(nomeParceiro) || "O parceiro";
  const q = `${quem.charAt(0).toLocaleUpperCase("pt-BR")}${quem.slice(1)}`;
  return aceitou ? `${q} aceitou ser sua ${servico}` : `${q} recusou ser sua ${servico}`;
}

/**
 * E289: assunto com o fato e o imóvel — `${antes}${título}${depois}`, com o título encolhido para o assunto inteiro
 * (com a marca) caber em 70 caracteres. Sem título (ou sem espaço para ele), null: vale o assunto do modelo.
 */
export function assuntoComTitulo(
  antes: string,
  titulo: string | null | undefined,
  depois = "",
  /**
   * E342: formas curtas do mesmo fato, tentadas EM ORDEM quando o título não cabe inteiro na anterior. A última pode
   * deixar a data só no corpo: o nome inteiro do imóvel vale mais no assunto que a data (que o corpo sempre traz).
   */
  compacto?: { antes: string; depois?: string } | readonly { antes: string; depois?: string }[],
): string | null {
  if (!String(titulo ?? "").trim()) return null;
  const curtas = compacto ? (Array.isArray(compacto) ? compacto : [compacto]) : [];
  const formas = [{ antes, depois }, ...curtas.map((c: { antes: string; depois?: string }) => ({ antes: c.antes, depois: c.depois ?? "" }))];
  const montar = (f: { antes: string; depois: string }, t: string) => {
    const a = `${f.antes}${t}${f.depois}`;
    return `${a.charAt(0).toLocaleUpperCase("pt-BR")}${a.slice(1)}`;
  };
  const cabeEm = (f: { antes: string; depois: string }) => Math.min(TITULO_IMOVEL_MAX, ASSUNTO_MAX - SUFIXO_ASSUNTO.length - f.antes.length - f.depois.length);
  const inteiro = tituloNoAssunto(titulo, Number.MAX_SAFE_INTEGER);
  if (inteiro === "seu imóvel") return null;
  // 1º: o título INTEIRO, na forma normal e depois na compacta.
  for (const f of formas) if (cabeEm(f) >= inteiro.length) return montar(f, inteiro);
  // 2º: o título cortado numa fronteira de palavra, desde que ainda identifique o imóvel (a forma com mais espaço antes).
  for (const f of [...formas].sort((x, y) => cabeEm(y) - cabeEm(x))) {
    const cabe = cabeEm(f);
    if (cabe < 10) continue;
    const t = tituloNoAssunto(titulo, cabe);
    if (tituloAindaIdentifica(t)) return montar(f, t);
  }
  // Sem jeito de nomear o imóvel sem mutilar: vale o assunto do modelo (o corpo nomeia o imóvel).
  return null;
}

/** "03/11" (o assunto não leva o ano: número longo fica no corpo). Vazio sem data. */
export function diaNoAssunto(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}` : "";
}

/** "03/11 às 10:00" no horário de Brasília. Vazio sem data. */
export function diaHoraNoAssunto(iso: string | null | undefined): string {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return "";
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return `${v("day")}/${v("month")} às ${v("hour")}:${v("minute")}`;
}
