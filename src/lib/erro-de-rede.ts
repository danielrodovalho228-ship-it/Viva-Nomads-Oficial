/*
  Mensagem de erro das telas de envio (documento, vínculo, matrícula, vídeo, foto de perfil). PURO.
  Quando a conexão cai, o navegador rejeita o fetch (ou a ação do servidor) com um TypeError e um texto cru, em inglês:
  "Failed to fetch" (Chrome/Edge/Android), "Load failed" (Safari/iPhone), "NetworkError when attempting to fetch
  resource." (Firefox). Esse texto ia direto para a tela. Aqui:
   • falha de rede → MSG_SEM_CONEXAO, em português, a mesma no computador e no celular;
   • outro erro técnico do navegador (JSON quebrado, envio cancelado) → a mensagem padrão da tela;
   • erro lançado por nós (Error com texto em português, ex.: o motivo devolvido pela API) → esse texto.
  Roda: node --test src/lib/erro-de-rede.test.ts
*/

export const MSG_SEM_CONEXAO = "A conexão caiu. Confira a internet e tente de novo.";

/** Textos que os navegadores (e o Node) usam quando a rede falha num fetch ou numa ação do servidor. */
const TEXTO_DE_REDE =
  /failed to fetch|load failed|networkerror|network ?error|network request failed|fetch failed|internet connection appears to be offline|err_internet_disconnected|err_network|unexpected response was received from the server/i;

/** A falha é de conexão (rede caiu, servidor fora de alcance)? */
export function ehErroDeRede(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const msg = String((e as { message?: unknown }).message ?? "");
  if (TEXTO_DE_REDE.test(msg)) return true;
  // Um TypeError sem texto reconhecido, vindo de um fetch, também é rede (cada navegador muda o texto).
  return e instanceof TypeError && /fetch|network|load/i.test(msg);
}

/** Erro técnico do navegador ou do JavaScript (não é texto nosso): nunca vai para a tela. */
function ehErroTecnico(e: Error): boolean {
  return e instanceof TypeError || e instanceof SyntaxError || e instanceof RangeError || e.name === "AbortError" || e.name === "TimeoutError";
}

/**
 * O texto que a tela mostra para um erro qualquer de envio. `padrao` é a frase da própria tela
 * (ex.: "Não foi possível enviar o documento agora.").
 */
export function textoDoErro(e: unknown, padrao: string): string {
  if (ehErroDeRede(e)) return MSG_SEM_CONEXAO;
  if (!(e instanceof Error) || !e.message.trim() || ehErroTecnico(e)) return padrao;
  return e.message;
}
