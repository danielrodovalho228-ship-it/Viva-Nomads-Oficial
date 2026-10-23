/*
  Qual aditivo a página da estadia mostra no painel. O aberto (proposto ou aceito) e, logo depois da segunda
  assinatura, o que acabou de ser assinado: sem isso, o refresh tira o painel da tela junto com "Assinatura
  registrada." e a pessoa fica sem a confirmação (t256, t264). Passados os minutos abaixo, ele fica só no histórico.
*/
export const MINUTOS_ADITIVO_RECEM_ASSINADO = 10;

type AditivoMinimo = { status: string; assinadoEm: string | null };

export function aditivoEmTela<A extends AditivoMinimo>(aditivos: A[], agora: Date = new Date()): A | undefined {
  const aberto = aditivos.find((a) => a.status === "proposto" || a.status === "aceito");
  if (aberto) return aberto;
  const limite = agora.getTime() - MINUTOS_ADITIVO_RECEM_ASSINADO * 60_000;
  return aditivos.find((a) => a.status === "assinado" && !!a.assinadoEm && Date.parse(a.assinadoEm) >= limite);
}
