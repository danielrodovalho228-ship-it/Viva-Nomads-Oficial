/*
  Regras do robots.txt, sem dependências do app (testáveis com node --test).
  Buscadores de IA liberados de forma explícita (ordem 9f68d9d3); as áreas
  privadas continuam bloqueadas para todos.
*/
export const AREAS_PRIVADAS = [
  "/dashboard",
  "/admin",
  "/auth",
  "/api",
  "/simulacao",
  "/roi",
  "/modelodenegocio",
  "/socios",
  "/decisao",
  "/tributario",
  "/acesso-socios",
  "/dev",
];

export const BOTS_DE_IA = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended"];
