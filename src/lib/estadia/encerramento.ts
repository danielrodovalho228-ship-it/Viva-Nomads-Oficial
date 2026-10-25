/*
  Encerrar contrato (Prompt 32, item 7) — tela pronta, cálculo desligado.
  Fluxo: motivo → consequências → confirmar na página. Com ENCERRAMENTO_REGRAS_ATIVO desligada (padrão), a Viva
  recebe o pedido e conduz o encerramento com as partes: nenhum valor de multa ou devolução é calculado nem mostrado.
  Ligada (depois do parecer jurídico), consequenciasDoEncerramento passa a calcular — hoje ela existe e não tem regras.
*/

export const MOTIVOS_ENCERRAMENTO = [
  { id: "mudanca_planos_morador", rotulo: "Mudança de planos do morador" },
  { id: "imovel_indisponivel", rotulo: "Imóvel indisponível (proprietário)" },
  { id: "problema_no_imovel", rotulo: "Problema no imóvel" },
  { id: "acordo_entre_partes", rotulo: "Acordo entre as partes" },
  { id: "outro", rotulo: "Outro" },
] as const;

export type MotivoEncerramento = (typeof MOTIVOS_ENCERRAMENTO)[number]["id"];

export const TEXTO_REGRAS_DESLIGADAS =
  "As regras de encerramento estão sendo finalizadas. Ao confirmar, a Viva recebe o pedido e conduz o encerramento com vocês.";

export const ROTULO_STATUS_ENCERRAMENTO: Record<string, string> = {
  aberto: "Pedido recebido",
  em_conducao: "A Viva está conduzindo",
  concluido: "Concluído",
};

export function rotuloMotivo(id: string): string {
  return MOTIVOS_ENCERRAMENTO.find((m) => m.id === id)?.rotulo ?? "Outro";
}

export function validarPedidoEncerramento(p: { motivo: string; texto?: string | null }): { ok: true; motivo: MotivoEncerramento; texto: string | null } | { ok: false; erro: string } {
  const m = MOTIVOS_ENCERRAMENTO.find((x) => x.id === p.motivo);
  if (!m) return { ok: false, erro: "Escolha um motivo." };
  const texto = (p.texto ?? "").trim().slice(0, 1000);
  if (m.id === "outro" && texto.length < 5) return { ok: false, erro: "Conte em poucas palavras o motivo." };
  return { ok: true, motivo: m.id, texto: texto || null };
}

export interface ConsequenciasEncerramento {
  multa: number;
  devolucaoCaucao: number;
  datasLiberadas: { inicio: string; fim: string } | null;
}

/**
 * Consequências do encerramento: multa, devolução da Caução e datas que voltam a ficar livres. Criada e SEM regras
 * até o parecer jurídico: com a chave desligada devolve null (a tela não mostra valor nenhum).
 */
export function consequenciasDoEncerramento(chaveLigada: boolean): ConsequenciasEncerramento | null {
  if (!chaveLigada) return null;
  // As regras entram aqui depois do parecer (multa, devolução da Caução, datas livres). Até lá, nada calculado.
  return null;
}
