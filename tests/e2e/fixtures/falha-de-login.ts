/*
  E744 (triagem do t187) — a frase que o global-setup imprime quando o login de um papel não passa.
  Antes só saía "page.waitForURL: Timeout 20000ms exceeded", igual para senha recusada, limite de tentativas e código de
  duas etapas recusado. Puro (sem Playwright): testado em tests/laboratorio/e744-falha-de-login.test.ts.
*/
export type EtapaDoLogin = "senha" | "duas-etapas";

const LIMITE_DO_AVISO = 120;

export function mensagemDaFalhaDeLogin(f: { papel: string; etapa: EtapaDoLogin; caminho: string; aviso: string | null }): string {
  const aviso = f.aviso ? f.aviso.replace(/\s+/g, " ").trim().slice(0, LIMITE_DO_AVISO) : "";
  const tela = aviso ? `a tela disse "${aviso}"` : "a tela não mostrou aviso";
  const base = `login de "${f.papel}" parou no passo ${f.etapa === "senha" ? "da senha" : "das duas etapas"}: a página ficou em ${f.caminho} e ${tela}`;
  if (f.etapa !== "duas-etapas") return base;
  // Causa conhecida no laboratório local: semear de novo cria outro fator, e o shell segue com o segredo antigo.
  return `${base} — o TESTES_ADMIN_TOTP_SEGREDO deste ambiente não é o do fator atual da conta? (laboratório semeado de novo: recarregue as variáveis)`;
}

/**
 * A falha foi o limite de tentativas de login (o aviso "Muitas tentativas…" da tela)? Fora do laboratório não há como
 * zerar o limite: repetir só gasta mais tentativas e mantém o limite estourado para a rodada seguinte (E2E da prévia).
 */
export function recusaPorLimite(mensagem: string): boolean {
  return /muitas\s+tentativas/i.test(mensagem);
}
