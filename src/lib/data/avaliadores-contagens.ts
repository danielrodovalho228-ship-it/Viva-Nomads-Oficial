import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { credenciamentoADecidir } from "@/lib/vistoria/telas-exibicao";
import { separarContasDeTeste, type ContagemDaCentral } from "@/lib/vistoria/contagens-da-central";
import type { StatusCredenciamento } from "@/lib/vistoria/regras";
import { aEsperaDaConcordancia, concordanciaRecusada } from "@/lib/vistoria/concordancia";

/*
  E1163 (ORDENS-DUET 684 e 685) — as três filas da avaliação que esperam a equipe, lidas num lugar só. É a fonte ÚNICA
  do "Para decidir" da Central (/admin) e do "Para decidir" da página dos avaliadores (/admin/avaliadores): o mesmo
  número nas duas telas, e a lista de cada fila sai da mesma leitura.

  Antes a página contava sozinha, e duas contas estavam erradas:
   · "sem avaliador" olhava só os 50 pedidos mais recentes — o pedido parado mais antigo ficava de fora;
   · "laudos atrasados" refazia a conta pelo relógio — a rotina já grava o atraso em `laudo_atrasado_em`.

  Cada leitura vem da mais antiga para a mais nova (o teto corta as recentes, nunca as que esperam há mais tempo).
  Leitura que falha devolve null: a tela avisa, nunca mostra zero. As contas de teste ficam fora do número, à parte.
*/

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
const TETO = 1000;

export type PedidoSemAvaliador = { id: string; cidade: string; tipo: string; criado_em: string; owner_id: string | null };
export type LaudoAtrasado = { id: string; cidade: string; visita_concluida_em: string | null; laudo_atrasado_em: string; owner_id: string | null; avaliadores_credenciamento: { numero_credenciado: string } | null };
export type CredenciamentoADecidir = { id: string; status: StatusCredenciamento; criado_em: string; user_id: string | null; parceiros: { user_id: string | null } | null };

/**
 * Pedidos sem nenhum avaliador que o dono possa escolher: o mesmo critério da rotina que tenta de novo
 * (`status = 'pedido'` e `aguardando_avaliador`). Sem "recentes": o parado há mais tempo é o primeiro.
 */
export async function pedidosSemAvaliador(admin: Admin, contasDeTeste: ReadonlySet<string>): Promise<ContagemDaCentral<PedidoSemAvaliador> | null> {
  const { data, error } = await admin
    .from("vistoria_pedidos")
    .select("id, cidade, tipo, criado_em, owner_id")
    .eq("status", "pedido")
    .eq("aguardando_avaliador", true)
    .order("criado_em", { ascending: true })
    .limit(TETO);
  if (error) return null;
  return separarContasDeTeste((data ?? []) as unknown as PedidoSemAvaliador[], (p) => p.owner_id, (p) => p.criado_em, contasDeTeste);
}

/** Laudos atrasados: a visita foi feita e a ROTINA já marcou o atraso (`laudo_atrasado_em`) — nunca um segundo relógio. */
export async function laudosAtrasados(admin: Admin, contasDeTeste: ReadonlySet<string>): Promise<ContagemDaCentral<LaudoAtrasado> | null> {
  const { data, error } = await admin
    .from("vistoria_pedidos")
    .select("id, cidade, visita_concluida_em, laudo_atrasado_em, owner_id, avaliadores_credenciamento(numero_credenciado)")
    .eq("status", "realizada")
    .not("laudo_atrasado_em", "is", null)
    .order("laudo_atrasado_em", { ascending: true })
    .limit(TETO);
  if (error) return null;
  return separarContasDeTeste((data ?? []) as unknown as LaudoAtrasado[], (p) => p.owner_id, (p) => p.laudo_atrasado_em, contasDeTeste);
}

/** Credenciamentos para decidir: o pedido novo ("solicitado"), pela regra única da tela (`credenciamentoADecidir`). */
export async function credenciamentosADecidir(admin: Admin, contasDeTeste: ReadonlySet<string>): Promise<ContagemDaCentral<CredenciamentoADecidir> | null> {
  const { data, error } = await admin
    .from("avaliadores_credenciamento")
    .select("id, status, criado_em, user_id, parceiros(user_id)")
    .eq("status", "solicitado")
    .order("criado_em", { ascending: true })
    .limit(TETO);
  if (error) return null;
  const linhas = ((data ?? []) as unknown as CredenciamentoADecidir[]).filter((c) => credenciamentoADecidir(c.status));
  return separarContasDeTeste(linhas, (c) => c.user_id ?? c.parceiros?.user_id, (c) => c.criado_em, contasDeTeste);
}

export type PedidoAEsperaDoMorador = {
  id: string;
  cidade: string;
  status: string;
  ocupado: boolean;
  agendado_para: string | null;
  concordancia_pedida_em: string | null;
  concordancia_em: string | null;
  owner_id: string | null;
};

/**
 * E1175: os pedidos do imóvel ocupado que esperam o morador, nos DOIS estados da mesma linha da Central — a data à
 * espera da concordância (`aEsperaDaConcordancia`) e o recusado à espera de nova data (`concordanciaRecusada`). A
 * consulta traz os candidatos; quem decide o estado são as regras puras do E1173. Do pedido mais antigo para o mais novo.
 */
export async function pedidosAEsperaDaMoradora(
  admin: Admin,
  contasDeTeste: ReadonlySet<string>,
): Promise<{ espera: ContagemDaCentral<PedidoAEsperaDoMorador>; recusados: ContagemDaCentral<PedidoAEsperaDoMorador> } | null> {
  const { data, error } = await admin
    .from("vistoria_pedidos")
    .select("id, cidade, status, ocupado, agendado_para, concordancia_pedida_em, concordancia_em, owner_id")
    .eq("status", "designado")
    .eq("ocupado", true)
    .is("concordancia_em", null)
    .not("concordancia_pedida_em", "is", null)
    .order("concordancia_pedida_em", { ascending: true })
    .limit(TETO);
  if (error) return null;
  const linhas = (data ?? []) as unknown as PedidoAEsperaDoMorador[];
  const estado = (p: PedidoAEsperaDoMorador) => ({ status: p.status, ocupado: p.ocupado, agendadoPara: p.agendado_para, concordanciaPedidaEm: p.concordancia_pedida_em, concordanciaEm: p.concordancia_em });
  const separar = (l: PedidoAEsperaDoMorador[]) => separarContasDeTeste(l, (p) => p.owner_id, (p) => p.concordancia_pedida_em, contasDeTeste);
  return {
    espera: separar(linhas.filter((p) => aEsperaDaConcordancia(estado(p)))),
    recusados: separar(linhas.filter((p) => concordanciaRecusada(estado(p)))),
  };
}
