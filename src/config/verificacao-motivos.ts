/*
  Prompt 50 — motivos de reprovação da verificação de identidade → texto legível com o PRÓXIMO PASSO. Nunca um aviso
  genérico ("Falha na verificação"): cada motivo diz o que aconteceu e o que fazer agora. Lido do laudo (caf_result)
  sem guardar nada novo. Na 1ª reprovação automática a pessoa tenta de novo na hora; na 2ª, o caso vai para a análise
  de uma pessoa (fila de documentos do admin) com o motivo.
*/

export type MotivoVerificacao =
  | "foto_escura"
  | "documento_ilegivel"
  | "documento_nao_reconhecido"
  | "selfie_nao_confere"
  | "prova_de_vida"
  | "nome_nao_confere"
  | "cpf_nao_confere"
  | "em_analise";

export interface TextoMotivo {
  titulo: string;
  proximoPasso: string;
}

export const MOTIVOS_VERIFICACAO: Record<MotivoVerificacao, TextoMotivo> = {
  foto_escura: { titulo: "Foto escura", proximoPasso: "Tire de novo perto de uma janela, com luz de frente e sem flash." },
  documento_ilegivel: { titulo: "Documento ilegível", proximoPasso: "Apoie o documento numa mesa, enquadre as quatro bordas e espere o foco antes de fotografar." },
  documento_nao_reconhecido: { titulo: "Documento não reconhecido", proximoPasso: "Use RG, CNH ou RNE/CRNM originais, fora do plástico, frente e verso." },
  selfie_nao_confere: { titulo: "A selfie não confere com o documento", proximoPasso: "Tire a selfie sem óculos, boné ou máscara, com o rosto inteiro no quadro." },
  prova_de_vida: { titulo: "A prova de vida não completou", proximoPasso: "Siga os movimentos pedidos na tela até o fim, sem trocar de aplicativo." },
  nome_nao_confere: { titulo: "O nome do documento é diferente do perfil", proximoPasso: "Corrija o nome no perfil igual ao documento e verifique de novo." },
  cpf_nao_confere: { titulo: "O CPF não confere com a Receita", proximoPasso: "Confira o CPF no perfil (os 11 números) e verifique de novo." },
  em_analise: { titulo: "Ainda em análise", proximoPasso: "A resposta chega em instantes; você recebe um aviso quando terminar." },
};

/** O laudo como a CAF devolve (só os campos que explicam a reprovação). */
export interface LaudoParaMotivo {
  light?: string | null;
  identity?: boolean;
  liveness?: boolean;
  document?: boolean;
  ocrConfere?: boolean | null;
  receitaConfere?: boolean | null;
  pendente?: boolean;
  notes?: string[];
}

/** O motivo da reprovação, do mais específico ao mais geral. null = aprovado. */
export function motivoDaReprovacao(l: LaudoParaMotivo): MotivoVerificacao | null {
  if (l.pendente) return "em_analise";
  const notas = (l.notes ?? []).join(" ").toLowerCase();
  if (/escur|ilumina|luz/.test(notas)) return "foto_escura";
  if (l.receitaConfere === false) return "cpf_nao_confere";
  if (l.ocrConfere === false) return "nome_nao_confere";
  if (l.document === false) return /leg|foco|borr|desfoc/.test(notas) ? "documento_ilegivel" : "documento_nao_reconhecido";
  if (l.liveness === false) return "prova_de_vida";
  if (l.identity === false) return "selfie_nao_confere";
  if (l.light === "red" || l.light === "yellow") return "documento_ilegivel";
  return null;
}

/** Depois de N reprovações automáticas: tentar de novo na hora (1ª) ou ir para uma pessoa (2ª em diante). */
export function proximaAcaoVerificacao(reprovacoesAutomaticas: number): "tentar_de_novo" | "analise_humana" | null {
  if (reprovacoesAutomaticas <= 0) return null;
  return reprovacoesAutomaticas === 1 ? "tentar_de_novo" : "analise_humana";
}
