/*
  64-B — pausar e reativar anúncio pelo dono. PURO.

  O motivo da pausa (properties.pausa_motivo) decide quem pode reativar: só o que o DONO pausou volta pelo botão
  "Reativar" (e pela mesma porta da publicação). Pausa da Viva (padrão mínimo, câmera, admin, avaliação, conta pausada)
  mostra o motivo e o caminho, nunca o botão.
  E233-A: não existe mais limite de anúncios por plano (os planos com mensalidade são histórico, config/planos.ts). Nem a
  publicação nem a reativação contam quantos anúncios o dono tem no ar.
*/

export const MOTIVOS_PAUSA = ["dono", "conforto", "camera", "admin", "avaliacao", "conta"] as const;
export type MotivoPausa = (typeof MOTIVOS_PAUSA)[number];

export function motivoPausaValido(v: unknown): v is MotivoPausa {
  return typeof v === "string" && (MOTIVOS_PAUSA as readonly string[]).includes(v);
}

/** Só o que o dono pausou ele mesmo reativa. */
export function donoPodeReativar(motivo: string | null | undefined): boolean {
  return motivo === "dono";
}

/** O que a tela mostra para cada pausa: o motivo e o caminho (pausa da Viva nunca tem botão de reativar). */
export const PAUSA_TEXTO: Record<MotivoPausa, { motivo: string; caminho: { rotulo: string; href: string } | null }> = {
  dono: { motivo: "Você pausou este anúncio.", caminho: null },
  conforto: { motivo: "Pausado pela Viva: o padrão mínimo de conforto venceu.", caminho: { rotulo: "Confirme o padrão mínimo", href: "/dashboard/imoveis" } },
  camera: { motivo: "Pausado pela Viva para conferir a declaração de câmeras.", caminho: { rotulo: "Fale com a Viva", href: "/dashboard/conta/ajuda" } },
  admin: { motivo: "Pausado pela Viva.", caminho: { rotulo: "Fale com a Viva", href: "/dashboard/conta/ajuda" } },
  avaliacao: { motivo: "Pausado pela Viva depois da avaliação do imóvel.", caminho: { rotulo: "Fale com a Viva", href: "/dashboard/conta/ajuda" } },
  conta: { motivo: "Sua conta está pausada: o anúncio volta quando você reativar a conta.", caminho: { rotulo: "Reativar minha conta", href: "/dashboard" } },
};

export function textoDaPausa(motivo: string | null | undefined): { motivo: string; caminho: { rotulo: string; href: string } | null } {
  return motivoPausaValido(motivo) ? PAUSA_TEXTO[motivo] : PAUSA_TEXTO.admin;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O que está em andamento num anúncio e continua depois da pausa (a tela lista antes de confirmar). */
export interface EmAndamento {
  candidaturasAbertas: number;
  propostasAceitas: number;
  visitasMarcadas: number;
  contratosVigentes: number;
}

export function textoEmAndamento(e: EmAndamento): string[] {
  const t: string[] = [];
  if (e.contratosVigentes) t.push(`${plural(e.contratosVigentes, "contrato vigente continua", "contratos vigentes continuam")} sem mudança.`);
  if (e.propostasAceitas) t.push(`${plural(e.propostasAceitas, "proposta aceita continua", "propostas aceitas continuam")}.`);
  if (e.visitasMarcadas) t.push(`${plural(e.visitasMarcadas, "visita marcada continua", "visitas marcadas continuam")}.`);
  if (e.candidaturasAbertas) t.push(`${plural(e.candidaturasAbertas, "candidatura aberta continua", "candidaturas abertas continuam")}; você pode responder a ${e.candidaturasAbertas === 1 ? "ela" : "elas"}.`);
  return t;
}
