import { papelGravadoEfetivo } from "./papel-ativo.ts";

/*
  E1026 — o papel do cabeçalho logo depois do login. O navegador só fica sabendo que a conta é "parceiro" quando o
  AuthProvider termina de ler o perfil; até lá o cabeçalho nascia como dono/morador e trocava. O painel passa a receber
  do SERVIDOR o papel ativo lido ao montar (prop + contexto) e a usá-lo enquanto o navegador não conhece o papel. PURO.
*/

/** O papel que o servidor leu ao montar o painel, com a conta de quem é. */
export type PapelInicialServidor = { conta: string; parceiro: boolean };

/**
 * No servidor: a conta abre como parceiro? A mesma regra do navegador — o papel gravado que vale (E668: "parceiro" só
 * com o carimbo da escolha) e a parceria ativa (aprovada e não suspensa).
 */
export function parceiroInicialDoServidor(e: { papelAtivo: unknown; escolhidoEm: unknown; parceriaAtiva: boolean }): boolean {
  return papelGravadoEfetivo(e.papelAtivo, e.escolhidoEm) === "parceiro" && e.parceriaAtiva;
}

/**
 * No navegador: o papel ativo é parceiro? Papel conhecido (perfil lido ou troca explícita) = o que o navegador guarda,
 * como sempre — o layout não se refaz ao navegar, e o que o servidor leu fica velho depois de uma troca. Ainda não
 * conhecido = o que o servidor leu para ESTA conta. Sem leitura do servidor (atrasou, falhou, ou é de outra conta), fica
 * o que o navegador guarda.
 */
export function preferenciaParceiroEfetiva(e: { guardado: boolean; papelConhecido: boolean; conta: string | null | undefined; servidor: PapelInicialServidor | null }): boolean {
  if (e.papelConhecido || !e.servidor || !e.conta || e.servidor.conta !== e.conta) return e.guardado;
  return e.servidor.parceiro;
}
