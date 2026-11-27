/*
  E799 (D4) — FONTE ÚNICA E ESTÁVEL da prévia do perfil. PURO.
  Antes, a prévia caía no cartão de MORADOR enquanto a leitura não chegava e quando ela falhava; no servidor, uma falha
  passageira ao ler a faixa do proprietário virava "não é dono". O mesmo Paulo via ora "Paulo P. / Responde…", ora
  "Paulo Teste Proprietário2 / E-mail confirmado". Agora:
   • quem é dono = TER IMÓVEL (o mesmo fato da faixa pública, perfil_publico_proprietario);
   • leitura falhou ≠ "não é dono": é FALHA (dita na tela, com "tentar de novo") — nunca outro cartão;
   • enquanto a leitura não chega, a prévia espera (sem nome, sem papel), nunca chuta o cartão de morador.
  Roda: node --test src/lib/perfil/e799-espelho-estado.test.ts
*/

export type PapelEspelho = "morador" | "proprietario";
export type EstadoEspelho = "carregando" | "falha" | PapelEspelho;

/** Qual cartão a prévia mostra. `ehDono` só vale com a leitura `ok`. */
export function estadoDoEspelho(e: { leitura: "carregando" | "falha" | "ok"; ehDono: boolean; papelDoModo: PapelEspelho; visto: PapelEspelho | null }): EstadoEspelho {
  if (e.leitura === "carregando") return "carregando";
  if (e.leitura === "falha") return "falha";
  if (!e.ehDono) return "morador";
  return e.visto ?? e.papelDoModo;
}

/**
 * No servidor: o perfil público é de dono, de morador, ou a leitura FALHOU. `temImovel` null = a consulta falhou;
 * `faixaDoDonoLida` = a faixa do proprietário veio (getPerfilProprietario não devolveu null).
 */
export function papelDoPerfilPublico(temImovel: boolean | null, faixaDoDonoLida: boolean): "dono" | "morador" | "falha" {
  if (temImovel === null) return "falha";
  if (!temImovel) return "morador";
  return faixaDoDonoLida ? "dono" : "falha";
}
