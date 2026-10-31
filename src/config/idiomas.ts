/*
  PUBLICO-A — os idiomas do globo do topo público (chave SELETOR_IDIOMA). Só o português existe nas telas; o inglês
  aparece "em breve" e não pode ser escolhido (a tradução é fase pós-lançamento). PURO.
*/
export interface Idioma {
  codigo: "pt" | "en";
  sigla: string;
  nome: string;
  disponivel: boolean;
}

export const IDIOMAS: readonly Idioma[] = [
  { codigo: "pt", sigla: "PT", nome: "Português", disponivel: true },
  { codigo: "en", sigla: "EN", nome: "English", disponivel: false },
];

export const IDIOMA_PADRAO = IDIOMAS[0];
export const ROTULO_EM_BREVE = "em breve";
