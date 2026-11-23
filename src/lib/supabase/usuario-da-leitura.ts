/*
  E1093 — a sessão de UMA leitura do servidor. "Não consegui confirmar a sessão" não é "não há sessão".

  Cada leitura do painel confirma a sessão por conta própria (supabase.auth.getUser) e seguia com `if (!user) return
  vazio`. Quando a confirmação falhava (rede, limite de pedidos, erro do serviço), a leitura respondia como se ninguém
  estivesse logado: lista vazia, "não tem imóvel", sem cartão — e o painel do dono perdia secções sem aviso.

  A regra, numa função só (sem dependências, para o teste):
    • sem sessão (não há cookie, sessão encerrada, token recusado) → null, como antes;
    • confirmação que FALHOU → espera um instante e tenta mais UMA vez; se continuar a falhar, LANÇA com `exigir` (quem
      chamou cai no caminho de "não consegui ler agora" que já existe) e devolve null sem ele (como antes).
  Não muda quem pode ver o quê: só repete a mesma conferência e deixa de chamar a falha de "sem sessão".

  Onde a nova tentativa alcança: nas rotas e nas ações do servidor (cada getUser é um pedido). Na MONTAGEM de uma página
  o Next partilha, numa mesma carga, os pedidos GET iguais (docs: fetch › Memoization) — todas as confirmações daquela
  carga recebem a mesma resposta, e a nova tentativa recebe-a também. Foi medido no laboratório: UMA confirmação falhada
  esvaziava a página inteira. Por isso, na página, o que conta é a falha LANÇAR (a tela avisa) e o Início reler-se
  sozinho uma vez (lib/painel/sem-leitura.ts, deveRelerOInicio).
*/

export const MSG_SESSAO_NAO_CONFIRMADA = "Não foi possível confirmar a sua sessão agora.";

/** A confirmação da sessão falhou duas vezes seguidas (não é "sem sessão"). */
export class SessaoNaoConfirmada extends Error {
  constructor() {
    super(MSG_SESSAO_NAO_CONFIRMADA);
    this.name = "SessaoNaoConfirmada";
  }
}

/** Espera antes da nova tentativa: curta (a tela está a carregar), mas não imediata (não martela um serviço no limite). */
export const ESPERA_NOVA_CONFIRMACAO_MS = 250;

type ErroDaConfirmacao = { name?: string; status?: number } | null | undefined;

/**
 * O erro do getUser é uma confirmação que FALHOU (e não uma sessão que não existe)? Rede sem resposta e 502–504 chegam
 * como AuthRetryableFetchError; limite de pedidos é 429; erro do serviço, 5xx; resposta ilegível, AuthUnknownError.
 * Sessão ausente (AuthSessionMissingError) e token recusado (401/403) NÃO são falha: a pessoa não está logada.
 */
export function confirmacaoFalhou(erro: ErroDaConfirmacao): boolean {
  if (!erro) return false;
  if (erro.name === "AuthRetryableFetchError" || erro.name === "AuthUnknownError") return true;
  const status = typeof erro.status === "number" ? erro.status : 0;
  return status === 429 || status >= 500;
}

interface ClienteComSessao<U> {
  auth: { getUser(): Promise<{ data: { user: U | null }; error: ErroDaConfirmacao }> };
}

const esperarDeVerdade = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * O usuário desta leitura. null = não há sessão. Com `exigir`, LANÇA SessaoNaoConfirmada quando a confirmação falha
 * duas vezes; sem `exigir`, a falha segue valendo null (as leituras que não exigem continuam como antes).
 */
export async function usuarioDaLeitura<U>(supabase: ClienteComSessao<U>, opcoes: { exigir?: boolean; esperar?: (ms: number) => Promise<void> } = {}): Promise<U | null> {
  const primeira = await supabase.auth.getUser();
  if (primeira.data.user) return primeira.data.user;
  if (!confirmacaoFalhou(primeira.error)) return null;
  await (opcoes.esperar ?? esperarDeVerdade)(ESPERA_NOVA_CONFIRMACAO_MS);
  const segunda = await supabase.auth.getUser();
  if (segunda.data.user) return segunda.data.user;
  if (!confirmacaoFalhou(segunda.error)) return null;
  if (opcoes.exigir) throw new SessaoNaoConfirmada();
  return null;
}

/**
 * A leitura que SEMPRE exige (não tem versão "sem exigir"): o usuário, ou null sem sessão; LANÇA quando a confirmação
 * falha duas vezes. As funções com `opcoes.exigir` repassam as opções a usuarioDaLeitura.
 */
export function usuarioExigido<U>(supabase: ClienteComSessao<U>): Promise<U | null> {
  return usuarioDaLeitura(supabase, { exigir: true });
}
