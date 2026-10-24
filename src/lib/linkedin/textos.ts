/*
  63-A — os textos das telas do selo "LinkedIn conectado". PURO e sem node:crypto: as telas do navegador importam daqui
  (regras.ts reexporta, para o servidor e os testes do 63-B).
  Roda: node --test src/lib/linkedin/textos.test.ts
*/
export const SELO_LINKEDIN = "LinkedIn conectado";

export const MSG_NOME_DIVERGENTE = "O nome no LinkedIn não confere com o nome da sua conta.";
export const MSG_JA_CONECTADO = "Este LinkedIn já está conectado a outra conta.";
export const MSG_FALHA = "Não foi possível conectar o LinkedIn agora. Tente de novo.";
export const MSG_LIMITE = "Muitas tentativas. Tente de novo em uma hora.";
export const MSG_CANCELADO = "Você cancelou a conexão com o LinkedIn. Nada foi gravado.";

/** Conta › Privacidade e segurança: o que é o selo, em uma frase. */
export const TEXTO_O_QUE_E = "Mostra aos outros que você tem um LinkedIn com o mesmo nome desta conta. Ninguém vê seu perfil do LinkedIn.";
/** Confirmação de 1 passo do "Desconectar". */
export const TEXTO_DESCONECTAR = "O selo sai do seu perfil agora. Você pode conectar de novo quando quiser.";
export const TEXTO_OPCIONAL = "Opcional";
export const ROTA_CONECTAR = "/api/conta/linkedin/conectar";

export type ResultadoRetorno = "conectado" | "nome" | "outra" | "cancelado" | "limite" | "falha" | "indisponivel";

/** A volta do fluxo chega com ?linkedin=<resultado>: sucesso, ou a falha com a causa e "Tentar de novo". */
export const RETORNO_LINKEDIN: Record<ResultadoRetorno, { titulo: string; texto: string | null; ok: boolean; tentarDeNovo: boolean }> = {
  conectado: { titulo: SELO_LINKEDIN, texto: "O selo já aparece para quem conversa com você.", ok: true, tentarDeNovo: false },
  nome: { titulo: "Não conectado", texto: MSG_NOME_DIVERGENTE, ok: false, tentarDeNovo: true },
  outra: { titulo: "Não conectado", texto: MSG_JA_CONECTADO, ok: false, tentarDeNovo: true },
  cancelado: { titulo: "Não conectado", texto: MSG_CANCELADO, ok: false, tentarDeNovo: true },
  limite: { titulo: "Não conectado", texto: MSG_LIMITE, ok: false, tentarDeNovo: false },
  falha: { titulo: "Não conectado", texto: MSG_FALHA, ok: false, tentarDeNovo: true },
  indisponivel: { titulo: "Não conectado", texto: "Conectar o LinkedIn não está disponível agora.", ok: false, tentarDeNovo: false },
};

export function retornoLinkedin(busca: string): (typeof RETORNO_LINKEDIN)[ResultadoRetorno] | null {
  const r = new URLSearchParams(busca).get("linkedin");
  return r && r in RETORNO_LINKEDIN ? RETORNO_LINKEDIN[r as ResultadoRetorno] : null;
}

/** Nas listas de selos (strings), o do LinkedIn sai pelo componente único. */
export const ehSeloLinkedin = (s: string) => s === SELO_LINKEDIN;
