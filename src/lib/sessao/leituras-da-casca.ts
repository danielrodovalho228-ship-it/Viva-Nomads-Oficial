import { useAuthStore } from "@/lib/store";
import { getMyAvatarUrl } from "@/lib/data/avatar-actions";
import { ehParceiroAprovado } from "@/lib/parceiros/painel-actions";
import { esquecerLeitura, leituraPartilhada } from "@/lib/sessao/leitura-partilhada";

/**
 * E1025 — as leituras que a casca do painel repete em vários componentes (barra de baixo, topo, menu, cartões da
 * Conta) saem daqui: uma ida ao servidor por conta e por abertura de tela, repartida por quem pedir.
 */

/** O tempo de uma abertura de tela: junta os componentes que montam juntos; a tela seguinte lê de novo. */
const PARTILHA_MS = 5_000;

/**
 * A conta de quem lê entra na chave: outra conta neste aparelho não herda a leitura.
 * Vale a conta que o componente já conhece (no painel, a do 1.º quadro, que vem do servidor antes de o store acordar);
 * sem ela, a do store; sem nenhuma das duas, a última conta que leu nesta página (o componente ainda não sabe quem é,
 * mas a sessão é a mesma).
 */
let ultimaConta: string | null = null;
function contaAtual(dada?: string | null): string {
  const conhecida = dada || useAuthStore.getState().user?.id || null;
  if (conhecida) ultimaConta = conhecida;
  return conhecida ?? ultimaConta ?? "sem-conta";
}

/** A parceria desta conta está aprovada? (`ehParceiroAprovado`, uma vez por abertura de tela.) */
export function lerParceiroAprovado(contaConhecida?: string | null): Promise<boolean> {
  const conta = contaAtual(contaConhecida);
  return leituraPartilhada(`parceiro:${conta}`, ehParceiroAprovado, PARTILHA_MS);
}

/** A URL da minha foto de perfil (`getMyAvatarUrl`, uma vez por abertura de tela). */
export function lerMeuAvatar(contaConhecida?: string | null): ReturnType<typeof getMyAvatarUrl> {
  const conta = contaAtual(contaConhecida);
  return leituraPartilhada(`avatar:${conta}`, getMyAvatarUrl, PARTILHA_MS);
}

/** A foto mudou: a leitura seguinte da URL vai ao servidor. */
export function esquecerMeuAvatar(): void {
  esquecerLeitura(`avatar:${contaAtual()}`);
}
