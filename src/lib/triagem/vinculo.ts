/*
  Prompt 52 — triagem do morador, parte que não depende da Certta: o comprovante de VÍNCULO. PURO
  (node --test src/lib/triagem/vinculo.test.ts).

  Atrás da chave TRIAGEM_VINCULO_ATIVA (desligada até o parecer do item 13: texto de coleta, finalidade e prazo de guarda
  vêm da Dra. Beatriz). No degrau da transação (candidatura aceita, antes do contrato) o morador envia UM comprovante:
  carta da residência/programa, carta do empregador ou contracheque recente. A equipe confere (admin com 2FA). Aprovado,
  vale 12 meses. "Morador verificado" = identidade confirmada (fluxo vigente, estadoIdentidade/CAF) + vínculo aprovado e
  dentro da validade — visível SÓ para o dono, na candidatura e na proposta, sem arquivo e sem valor de renda.
  Antecedentes criminais e score de crédito: FORA (parecer jurídico).
*/

export type TipoVinculo = "carta_programa" | "carta_empregador" | "contracheque";

export const TIPOS_VINCULO: { tipo: TipoVinculo; titulo: string; ajuda: string; paraDono: string }[] = [
  { tipo: "carta_programa", titulo: "Carta da residência ou do programa", ajuda: "Residência médica, mestrado, doutorado, intercâmbio: carta da instituição com seu nome e o período.", paraDono: "carta da residência ou do programa" },
  { tipo: "carta_empregador", titulo: "Carta do empregador", ajuda: "Carta da empresa com seu nome, o cargo e a data. Não precisa dizer o salário.", paraDono: "carta do empregador" },
  { tipo: "contracheque", titulo: "Contracheque recente", ajuda: "Dos últimos 3 meses. Pode cobrir os valores: a equipe confere só o nome, a empresa e a data.", paraDono: "contracheque" },
];

export const ehTipoVinculo = (v: unknown): v is TipoVinculo => TIPOS_VINCULO.some((t) => t.tipo === v);

export const VALIDADE_MESES = 12;

/** Motivos de recusa: sempre um texto que o morador entende e consegue corrigir na hora. */
export const MOTIVOS_RECUSA = {
  ilegivel: "O arquivo está ilegível. Envie de novo com o documento inteiro e nítido.",
  sem_nome: "Não aparece o seu nome no documento. Envie um comprovante em seu nome.",
  antigo: "O documento é antigo. Envie um de até 3 meses (contracheque) ou com o período atual (carta).",
  tipo_errado: "Esse documento não comprova vínculo. Envie uma carta da residência/programa, do empregador ou um contracheque.",
  outro: "A equipe não conseguiu confirmar o vínculo com este arquivo.",
} as const;
export type MotivoRecusa = keyof typeof MOTIVOS_RECUSA;
export const ehMotivoRecusa = (v: unknown): v is MotivoRecusa => typeof v === "string" && v in MOTIVOS_RECUSA;

/** Texto do motivo que o morador lê (o complemento da equipe vai junto, curto). */
export function textoDaRecusa(motivo: MotivoRecusa, complemento?: string | null): string {
  const extra = (complemento ?? "").trim().slice(0, 200);
  return extra ? `${MOTIVOS_RECUSA[motivo]} ${extra}` : MOTIVOS_RECUSA[motivo];
}

export interface LinhaVinculo {
  tipo: string;
  status: "pendente" | "aprovado" | "recusado";
  motivo: string | null;
  decidido_em: string | null;
  valido_ate: string | null;
  enviado_em: string;
}

export type EstadoVinculo = "nenhum" | "pendente" | "aprovado" | "recusado" | "vencido";

/** Estado do vínculo pela linha mais recente. */
export function estadoVinculo(l: LinhaVinculo | null, agora: Date): EstadoVinculo {
  if (!l) return "nenhum";
  if (l.status === "aprovado") return l.valido_ate && Date.parse(l.valido_ate) > agora.getTime() ? "aprovado" : "vencido";
  return l.status;
}

/** Validade de um vínculo aprovado agora: +12 meses. */
export function validoAte(decididoEm: Date): string {
  const d = new Date(decididoEm.getTime());
  d.setUTCMonth(d.getUTCMonth() + VALIDADE_MESES);
  return d.toISOString();
}

/** O morador pode enviar (ou reenviar) agora? Recusado: na hora. Aprovado e válido: não precisa. */
export function podeEnviar(e: EstadoVinculo): boolean {
  return e !== "aprovado";
}

/**
 * Selo "Morador verificado": as DUAS confirmações e dentro da validade. A identidade vem do estado único
 * (estadoIdentidade: "confirmada" já respeita a validade do laudo).
 */
export function moradorVerificado(identidade: { estado: string } | null | undefined, vinculo: LinhaVinculo | null, agora: Date): boolean {
  return identidade?.estado === "confirmada" && estadoVinculo(vinculo, agora) === "aprovado";
}

/** O que o DONO vê: só o selo e o tipo do vínculo. Nunca o arquivo, nunca valores. */
export function textoParaDono(identidade: { estado: string } | null | undefined, vinculo: LinhaVinculo | null, agora: Date): string | null {
  if (!moradorVerificado(identidade, vinculo, agora)) return null;
  const t = TIPOS_VINCULO.find((x) => x.tipo === vinculo!.tipo);
  return `Morador verificado · vínculo confirmado (${t?.paraDono ?? "comprovante"})`;
}

/** Contagens da triagem para a equipe — contas de teste FORA. */
export function metricasTriagem(linhas: readonly { user_id: string; status: string }[], contasTeste: ReadonlySet<string>): { pendentes: number; aprovados: number; recusados: number } {
  const m = { pendentes: 0, aprovados: 0, recusados: 0 };
  for (const l of linhas) {
    if (contasTeste.has(l.user_id)) continue;
    if (l.status === "pendente") m.pendentes++;
    else if (l.status === "aprovado") m.aprovados++;
    else if (l.status === "recusado") m.recusados++;
  }
  return m;
}

/** Caminho no bucket privado triagem-vinculos: <user_id>/<uuid>.<ext>. */
export function caminhoVinculo(userId: string, arquivoId: string, ext: "pdf" | "jpg" | "png"): string {
  return `${userId}/${arquivoId}.${ext}`;
}

export const BUCKET_TRIAGEM = "triagem-vinculos";
