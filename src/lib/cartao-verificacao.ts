/*
  Complemento do prompt 23 (item 3) — PURO. O cartão "Verificação de identidade" da Visão geral do inquilino segue a
  MESMA regra de /dashboard/verificacao (lida de /api/caf/status):
  - laudo válido → "Identidade confirmada · válida até DD/MM/AAAA";
  - conta de teste sem laudo → botão "Verificar (simulado)";
  - conta real sem a verificação ativa → "em breve".
*/

export interface StatusVerificacao {
  teste: boolean;
  feita: boolean;
  ok: boolean;
  validoAte: string | null;
}

export interface CartaoVerificacao {
  estado: "confirmada" | "teste" | "em_breve";
  titulo: string;
  texto: string;
  cta: { label: string; href: string; variant: "primary" | "outline" };
}

/** "18/10/2027" no fuso de Brasília. */
export function dataValidade(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function cartaoVerificacao(s: StatusVerificacao | null): CartaoVerificacao {
  if (s && s.feita && s.ok) {
    const ate = s.validoAte ? dataValidade(s.validoAte) : "";
    return {
      estado: "confirmada",
      titulo: ate ? `Identidade confirmada · válida até ${ate}` : "Identidade confirmada",
      texto: s.teste ? "Conta de teste: verificação simulada." : "Seu perfil mostra o selo de identidade confirmada.",
      cta: { label: "Ver verificação", href: "/dashboard/verificacao", variant: "outline" },
    };
  }
  if (s && s.teste) {
    return {
      estado: "teste",
      titulo: "Verificação de identidade",
      texto: "Conta de teste: a verificação é simulada, sem documento real.",
      cta: { label: "Verificar (simulado)", href: "/dashboard/verificacao", variant: "primary" },
    };
  }
  return {
    estado: "em_breve",
    titulo: "Verificação de identidade (em breve)",
    texto: "Você já pode se candidatar sem ela. Quando abrir, avisamos — e ela reforça seu perfil.",
    cta: { label: "Saber mais", href: "/dashboard/verificacao", variant: "outline" },
  };
}
