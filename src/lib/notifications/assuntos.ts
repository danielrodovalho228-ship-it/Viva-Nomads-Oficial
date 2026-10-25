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
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
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
