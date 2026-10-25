/**
 * PROP-1 — navegação do DONO no computador (mockup painel-proprietario-desktop): sem barra lateral; abas no topo
 * (Início · Anúncios · Interessados · Contratos · Mensagens), sino e "Conta ▾" à direita, e subabas num componente
 * único. MENUS-5: as abas moram na fonte única config/abas-painel.ts (as mesmas do celular); aqui ficam os nomes que o
 * resto do código já usa.
 */
import {
  ABAS_PROPRIETARIO,
  GANHOS_DISPONIVEL,
  HREF_SINO,
  abaAtivaPainel,
  itensDaConta,
  subabaAtivaPainel,
  type AbaPainel,
  type ItemAba,
  type ItemConta,
} from "./abas-painel.ts";

export type ItemNavDono = ItemAba;
export type AbaDono = AbaPainel;
export type ItemContaDono = ItemConta;

export { GANHOS_DISPONIVEL };

export const ABAS_DONO: readonly AbaDono[] = ABAS_PROPRIETARIO;

/** "Conta ▾" do dono (à direita do topo). "Modo morador" e "Sair" são ações; os outros, links. */
export const CONTA_DONO: readonly ItemContaDono[] = itensDaConta("proprietario", { temImovel: true, admin: false });

/** O sino do topo leva às notificações do painel. */
export const HREF_SINO_DONO = HREF_SINO;

/** A aba de cima acesa nesta rota (a aba ou qualquer subaba dela); fora das cinco, nenhuma. */
export function abaAtivaDono(pathname: string): AbaDono | null {
  return abaAtivaPainel(ABAS_DONO, pathname);
}

/** A subaba acesa nesta rota (dentro da aba ativa). */
export function subabaAtivaDono(pathname: string): ItemNavDono | null {
  return subabaAtivaPainel(ABAS_DONO, pathname);
}

/** Itens do lado MORADOR: no modo dono não aparecem em menu nenhum (PROP-1, item 4). */
export const ROTAS_SO_MORADOR: readonly string[] = [
  "/buscar",
  "/dashboard/buscas",
  "/dashboard/favoritos",
  "/dashboard/pedidos",
  "/dashboard/locacoes",
  "/dashboard/candidaturas",
];
