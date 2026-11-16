import type { SessionUser } from "../store";

/**
 * Identidade SEM NOME da demonstração: só o que decide papéis e plano quando não há usuário (build de demonstração,
 * sem login). Plano Gestor para exibir os recursos de operador (Atualização 12) e os dois papéis para exibir a troca
 * de modo (rodada 19). Não há nome nem e-mail fictícios: a persona fictícia saiu do produto (Gerente,
 * 16/11/2026) — nenhuma tela a mostrava, e este arquivo entra no pacote de todas as telas do painel.
 */
export const PAPEIS_DA_DEMONSTRACAO: SessionUser = {
  id: "demo-owner",
  name: "",
  email: "",
  role: "owner",
  fullName: "",
  plan: "gestor",
  isOwner: true,
  isTenant: true,
};
