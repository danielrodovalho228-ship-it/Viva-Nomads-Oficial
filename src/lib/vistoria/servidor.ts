import type { SupabaseClient } from "@supabase/supabase-js";
import { notify, type NotificationEvent } from "@/lib/notifications";
import { blocoDados } from "@/lib/notifications/modelo-email";
import { EVENTOS_VISITA_DE_AVALIACAO } from "@/lib/notifications/sino";
import { escaparHtml } from "@/lib/escapar-html";
import { EVENTOS_VISTORIA_COM_FATOS, corpoVistoria, type EventoVistoria, type FatosVistoria, type LaudoNoEmail } from "./corpo-email";
import { itensACorrigir } from "./telas-laudo";
import { urlConferir } from "@/lib/fiscal/prefixos";
import { SITE_URL } from "@/lib/site";
import type { Resultado } from "./laudo";
import { corpoDoAvisoDaFila } from "./rotulos-da-fila";
import { SO_O_ANTERIOR, avisoAoDono, estadoDaEscolha } from "./espera-de-avaliador";
import { laudoForaDoCombinado } from "./laudo";
import { hojeEmBrasilia } from "@/lib/checkin";
import { STATUS_TESTE_CONCLUIDO } from "./entrada";
import { criteriosAtingidos, propostaVencida, sugerirAvaliadores, CRITERIOS_PUBLICOS, type Sugestoes } from "./escolha";
import { fimDoPrazoDeAceite, precisaDoAceiteDoDono, relogioDoPedido } from "./relogio-do-pedido";
import { modoDaChaveAtual } from "./chave";
import { filaNoAmbito } from "./ambito-da-chave";
import { nomeDoAvaliador } from "./nome-do-avaliador";
import { LIMPEZA_DA_CONCORDANCIA } from "./concordancia";
import { estadoIdentidade } from "@/lib/identidade/estado-servidor";
import { registrarSemAvaliador, type ItemAberto } from "./fila-sem-avaliador";
import { lerGravacaoNaFila } from "./gravacao-na-fila";
import {
  COLUNAS_PRECO,
  atendeCidade,
  designacaoVencida,
  fechoDaDesignacaoAoDevolver,
  jaDesignadosNoPedido,
  linhaDaTabela,
  linhasDaCidade,
  motivoSemAvaliador,
  notaConduta,
  sorteadoParaAuditoria,
  visitaAmanha,
  type AvaliadorElegivel,
  type AvaliadorFila,
  type DesignacaoDoPedido,
  type HistoricoDesignacao,
  type LinhaPreco,
  type MotivoDaDevolucao,
  type MotivoForaDaEscolha,
  type PedidoParaDesignar,
  type StatusCredenciamento,
  type TipoPedido,
} from "./regras";

/*
  Prompt 62-B1 / E648 — o lado do servidor da avaliação do imóvel: lê a fila da cidade e o histórico, pede à regra pura os
  avaliadores SUGERIDOS e grava a escolha do DONO. A Viva não designa ninguém (E648, anti-subordinação) e não suspende
  ninguém sozinha: critérios públicos de qualidade só abrem uma revisão humana. Roda com o cliente de serviço (ações
  depois do portão de cada parte, e o cron). Nunca lança: aviso é complemento.
*/

type Admin = SupabaseClient;

export const ROTA_AVALIADOR = "/dashboard/parceiro/avaliacao";
export const rotaDono = (propertyId: string) => `/dashboard/imoveis/${propertyId}/nivel#avaliacao`;
export const rotaMorador = (pedidoId: string) => `/dashboard/avaliacao-imovel/${pedidoId}`;
export const ROTA_ADMIN = "/admin/avaliadores";

/**
 * E1084: os nomes das CONTAS (profiles.full_name) por user_id — a fonte única do nome do avaliador. Falha de leitura:
 * mapa vazio (cada tela cai no nome público do parceiro, como antes).
 */
export async function nomesDasContas(admin: Admin, userIds: readonly (string | null | undefined)[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (!ids.length) return new Map();
  const { data, error } = await admin.from("profiles").select("id, full_name").in("id", ids);
  if (error) return new Map();
  return new Map(((data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
}

/**
 * E1096 (ORDEM-DUET-453/460): as contas com a identidade CONFIRMADA — o fato (a mesma fonte do credenciamento), nunca o
 * status — para a linha "Identidade verificada pela Viva" do cartão da escolha do dono. A leitura que falha não afirma
 * nada: a conta fica fora do conjunto.
 */
export async function identidadesConfirmadas(admin: Admin, userIds: readonly (string | null | undefined)[], agora = new Date()): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  const pares = await Promise.all(
    ids.map(async (id) => [id, await estadoIdentidade(admin, id, agora).then((e) => e.estado === "confirmada").catch(() => false)] as const),
  );
  return new Set(pares.filter(([, ok]) => ok).map(([id]) => id));
}

/** De onde vêm os fatos do e-mail (E289): o pedido de avaliação (imóvel, data da visita, avaliador) ou só o imóvel. */
export type RefVistoria = {
  pedidoId?: string | null;
  propertyId?: string | null;
  /** E1160 (5): quem recebe o aviso (o lembrete do morador é outro texto). */
  papel?: "dono" | "avaliador" | "morador";
  /** E1160 (6): quem agenda sabe se está a trocar a data, e qual era — a gravação substitui-a. */
  reagendada?: boolean;
  /** E1173: no aviso da recusa do morador é a data recusada — quando o aviso sai, ela já foi limpa do pedido. */
  visitaAnterior?: string | null;
  /** E1177: o aviso "há avaliador" saiu porque chegou OUTRO avaliador (o dono esperava com o da avaliação anterior). */
  outro?: boolean;
};

/** E289: lê no banco o que o e-mail precisa nomear — imóvel (título, bairro, cidade), visita e avaliador. */
export async function fatosDaVistoria(admin: Admin, ref: RefVistoria, opcoes: { comLaudo?: boolean } = {}): Promise<FatosVistoria> {
  let propertyId = ref.propertyId ?? null;
  let visita: string | null = null;
  let avaliador: string | null = null;
  // E1160: o que o e-mail afirma sai do estado do pedido NO MOMENTO do envio — a proposta, se há avaliador para o dono
  // escolher, se a data é uma troca e o número de credenciado de quem assina o laudo.
  let doPedido: Pick<FatosVistoria, "numeroCredenciado" | "propostaEm" | "aguardandoAvaliador" | "motivoDaEspera" | "reagendada" | "valorProposto" | "prazoPropostoDias" | "prazoLaudoDiasUteis"> = { reagendada: ref.reagendada };
  let laudo: LaudoNoEmail | null = null;
  if (ref.pedidoId) {
    const { data: p } = await admin
      .from("vistoria_pedidos")
      .select("property_id, agendado_para, proposta_em, valor_proposto, prazo_proposto_dias, prazo_laudo_dias_uteis, aguardando_avaliador, motivo_da_espera, reagendou_dono, reagendou_avaliador, avaliadores_credenciamento(numero_credenciado, parceiros(nome_publico, user_id))")
      .eq("id", ref.pedidoId)
      .maybeSingle();
    const pp = p as {
      property_id?: string | null;
      agendado_para?: string | null;
      proposta_em?: string | null;
      valor_proposto?: number | string | null;
      prazo_proposto_dias?: number | null;
      prazo_laudo_dias_uteis?: number | null;
      aguardando_avaliador?: boolean | null;
      motivo_da_espera?: string | null;
      reagendou_dono?: boolean | null;
      reagendou_avaliador?: boolean | null;
      avaliadores_credenciamento?: { numero_credenciado?: string | null; parceiros?: { nome_publico?: string | null; user_id?: string | null } | null } | null;
    } | null;
    propertyId = propertyId ?? pp?.property_id ?? null;
    visita = pp?.agendado_para ?? null;
    // E1084: o nome do avaliador vem da conta (fonte única).
    const parc = pp?.avaliadores_credenciamento?.parceiros ?? null;
    avaliador = parc ? nomeDoAvaliador((await nomesDasContas(admin, [parc.user_id])).get(parc.user_id ?? ""), parc.nome_publico) : null;
    doPedido = {
      numeroCredenciado: pp?.avaliadores_credenciamento?.numero_credenciado ?? null,
      propostaEm: pp?.proposta_em ?? null,
      // E1188: a proposta como a tela a lê — o valor e os dois prazos do laudo (o novo, em dias úteis, e o de antes).
      valorProposto: pp?.valor_proposto ?? null,
      prazoPropostoDias: pp?.prazo_proposto_dias ?? null,
      prazoLaudoDiasUteis: pp?.prazo_laudo_dias_uteis ?? null,
      aguardandoAvaliador: pp?.aguardando_avaliador === true,
      // E1177: o motivo gravado no pedido — o e-mail diz por que não há quem escolher, em vez de prometer sempre.
      motivoDaEspera: pp?.motivo_da_espera ?? null,
      // Quem agenda diz se é troca; depois da concordância do morador (imóvel ocupado) vale o registo do pedido.
      reagendada: ref.reagendada ?? (pp?.reagendou_dono === true || pp?.reagendou_avaliador === true),
    };
  }
  // E1188: o laudo que acabou de sair — o último do pedido —, com os mesmos campos que a tela do dono mostra e o código
  // do documento registrado (a página pública de conferência). Leitura que falha: o e-mail sai sem esses fatos.
  if (opcoes.comLaudo && ref.pedidoId) {
    const { data: l } = await admin
      .from("vistoria_laudos")
      .select("numero, versao, resultado, nivel_sustentado, ressalvas, graves, documento_id")
      .eq("pedido_versao_id", ref.pedidoId)
      .order("emitido_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ll = l as { numero?: string | null; versao?: number | null; resultado?: Resultado | null; nivel_sustentado?: string | null; ressalvas?: { chave: string }[] | null; graves?: string[] | null; documento_id?: string | null } | null;
    if (ll?.numero && ll.resultado) {
      const { data: doc } = ll.documento_id ? await admin.from("documentos_registro").select("codigo_verificacao").eq("id", ll.documento_id).maybeSingle() : { data: null };
      const codigo = String((doc as { codigo_verificacao?: string | null } | null)?.codigo_verificacao ?? "").trim();
      laudo = {
        numero: ll.numero,
        versao: Number(ll.versao ?? 1),
        resultado: ll.resultado,
        nivelSustentado: ll.nivel_sustentado ?? null,
        itensACorrigir: itensACorrigir({ ressalvas: ll.ressalvas ?? [], graves: ll.graves ?? [] }).length,
        linkConferir: codigo ? urlConferir(SITE_URL, codigo) : null,
      };
    }
  }
  const fatos = { visita, avaliador, ...doPedido, laudo, visitaAnterior: ref.visitaAnterior ?? null, destinatario: ref.papel, outroAvaliador: ref.outro === true };
  if (!propertyId) return { imovel: null, ...fatos };
  const { data: im } = await admin.from("properties").select("title, address, city").eq("id", propertyId).maybeSingle();
  const i = im as { title?: string | null; address?: string | null; city?: string | null } | null;
  return { imovel: i ? { id: propertyId, titulo: i.title, bairro: i.address, cidade: i.city } : null, ...fatos };
}

/**
 * Avisa uma pessoa de um evento da avaliação. E289: com `ref`, o e-mail sai com os fatos do caso (imóvel nomeado, data
 * e hora da visita, avaliador) no assunto, no corpo e no bloco de dados.
 */
export async function avisar(admin: Admin, destino: string | null | undefined, ev: NotificationEvent, url: string, ref?: RefVistoria): Promise<void> {
  if (!destino) return;
  try {
    const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", destino).maybeSingle();
    const d = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    const corpo = ref && EVENTOS_VISTORIA_COM_FATOS.has(ev) ? corpoVistoria(ev as EventoVistoria, await fatosDaVistoria(admin, ref, { comLaudo: ev === "vistoria_laudo_emitido" })) : null;
    await notify({
      event: ev,
      email: d?.notif_email === false ? undefined : (d?.email ?? undefined),
      name: d?.full_name ?? undefined,
      userId: destino,
      pushUrl: url,
      imovelId: ref?.propertyId,
      // E1128: o aviso fica ligado ao pedido — é o que deixa o sino conferir o estado atual e a ação resolvê-lo.
      refId: ref?.pedidoId,
      ...(corpo
        ? {
            ...(corpo.subject ? { subject: corpo.subject } : {}),
            body: corpo.body,
            ...(corpo.cta ? { ctaLabel: corpo.cta } : {}),
            ...(corpo.linhas.length ? { detailsHtml: blocoDados(corpo.linhas.map((l) => ({ rotulo: escaparHtml(l.rotulo), valor: escaparHtml(l.valor) }))) } : {}),
          }
        : {}),
    });
  } catch {
    /* aviso é complemento */
  }
}

/**
 * E1128: a visita deste pedido deixou de estar por acontecer (concluída, laudo emitido, ausência, pedido devolvido ao
 * dono): os avisos de visita do pedido ficam resolvidos, de todas as partes. Nunca lança (o aviso é complemento).
 */
export async function resolverAvisosDaVisita(admin: Admin, pedidoId: string): Promise<void> {
  try {
    const { error } = await admin
      .from("avisos")
      .update({ resolvido_em: new Date().toISOString() })
      .eq("ref_id", pedidoId)
      .in("evento", [...EVENTOS_VISITA_DE_AVALIACAO])
      .is("resolvido_em", null);
    if (error) console.error("[avisos] não resolveu a visita de avaliação:", error.code, error.message);
  } catch {
    /* aviso é complemento */
  }
}

/**
 * E1173: o "não concordou com a data" que o dono e o avaliador receberam deixa de valer quando há data nova (ou quando o
 * pedido volta ao dono). Nunca lança (o aviso é complemento).
 */
export async function resolverAvisosDaRecusa(admin: Admin, pedidoId: string): Promise<void> {
  try {
    const { error } = await admin.from("avisos").update({ resolvido_em: new Date().toISOString() }).eq("ref_id", pedidoId).eq("evento", "vistoria_concordancia_recusada").is("resolvido_em", null);
    if (error) console.error("[avisos] não resolveu a recusa da data:", error.code, error.message);
  } catch {
    /* aviso é complemento */
  }
}

/**
 * E1158 (23): com `tipoDaFila`, o e-mail "novo item na fila" diz o tipo do item que entrou (o rótulo da tela). Só
 * muda o texto dos avisos que já existiam: nenhum tipo passa a avisar por causa disto (ORDEM-DUET-673).
 */
export async function avisarAdmins(admin: Admin, ev: NotificationEvent, tipoDaFila?: string): Promise<void> {
  try {
    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
    for (const ad of (admins ?? []) as { id: string }[]) {
      const { data: u } = await admin.auth.admin.getUserById(ad.id);
      await notify({ event: ev, email: u?.user?.email ?? undefined, userId: ad.id, pushUrl: ROTA_ADMIN, interno: true, ...(tipoDaFila ? { body: () => corpoDoAvisoDaFila(tipoDaFila) } : {}) });
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Item na fila do admin (um aberto por tipo e referência).
 * E1149: devolve se ESTA chamada inseriu. O índice único deixa entrar um só item aberto; quem chega em segundo recebe
 * `false` — e não avisa os admins outra vez.
 * E1185: a gravação é lida (a leitura do E1182). O banco a recusar o item deixa de ser igual a "já havia um item
 * aberto": a recusa fica registada no servidor, com o tipo, a referência e a mensagem. O que devolve não muda.
 */
export async function naFilaDoAdmin(admin: Admin, tipo: "sem_avaliador" | "avaliacao_teste" | "suspensao_automatica" | "proposta_descredenciamento" | "revisao_criterio" | "contestacao_sem_avaliador", ref: { pedidoId?: string; avaliadorId?: string }, motivo: string): Promise<boolean> {
  const { error } = await admin.from("vistoria_fila_admin").insert({ tipo, pedido_id: ref.pedidoId ?? null, avaliador_id: ref.avaliadorId ?? null, motivo });
  return lerGravacaoNaFila(error, { tipo, pedidoId: ref.pedidoId, avaliadorId: ref.avaliadorId }).inserido;
}

type LinhaCred = {
  id: string;
  cidade: string;
  status: StatusCredenciamento;
  criado_em: string;
  ativado_em: string | null;
  ultima_designacao_em: string | null;
  relacoes_donos: string[] | null;
  relacoes_imoveis: string[] | null;
  parceiros: { user_id: string } | null;
};

/**
 * A fila da cidade (todos os credenciamentos; a regra pura decide quem pode). Achado 39: uma leitura que falha LANÇA —
 * fila vazia por erro viraria "Nenhum avaliador elegível" (na designação) ou uma fila de rodízio vazia (no admin).
 */
export async function filaDaCidade(admin: Admin): Promise<AvaliadorFila[]> {
  const { data, error } = await admin
    .from("avaliadores_credenciamento")
    .select("id, cidade, status, criado_em, ativado_em, ultima_designacao_em, relacoes_donos, relacoes_imoveis, parceiros(user_id)")
    .in("status", ["em_teste", "ativo", "suspenso"]);
  if (error) throw new Error(`[vistoria] fila da cidade: ${error.message}`);
  const linhas = (data ?? []) as unknown as LinhaCred[];
  const ids = linhas.map((l) => l.parceiros?.user_id).filter((x): x is string => !!x);
  const { data: perfis, error: erroPerfis } = ids.length ? await admin.from("profiles").select("id, is_teste").in("id", ids) : { data: [], error: null };
  if (erroPerfis) throw new Error(`[vistoria] contas de teste da fila: ${erroPerfis.message}`);
  const teste = new Set(((perfis ?? []) as { id: string; is_teste: boolean | null }[]).filter((p) => p.is_teste).map((p) => p.id));
  return linhas
    .filter((l) => l.parceiros?.user_id)
    .map((l) => ({
      id: l.id,
      userId: l.parceiros!.user_id,
      cidade: l.cidade,
      status: l.status,
      teste: teste.has(l.parceiros!.user_id),
      credenciadoEm: l.ativado_em ?? l.criado_em,
      ultimaDesignacaoEm: l.ultima_designacao_em,
      relacoesDonos: l.relacoes_donos ?? [],
      relacoesImoveis: l.relacoes_imoveis ?? [],
    }));
}

/**
 * E1081: a fonte única da leitura da tabela de preço de uma cidade. Lê a tabela inteira (poucas linhas: cidade × porte ×
 * vigência) e filtra pela chave da cidade (linhasDaCidade) — nunca .eq("cidade", …) letra a letra. Falha de leitura:
 * tabela vazia, como antes (o pedido não abre e a tela diz que ainda não há valor).
 */
export async function tabelaDaCidade(admin: Admin, cidade: string | null | undefined): Promise<LinhaPreco[]> {
  const { data, error } = await admin.from("vistoria_precos").select(COLUNAS_PRECO).limit(1000);
  if (error) return [];
  return linhasDaCidade(((data ?? []) as Parameters<typeof linhaDaTabela>[0][]).map(linhaDaTabela), cidade);
}

/** E1077: as contas do piloto da avaliação (vistoria_piloto). Uma leitura que falha LANÇA (achado 39). */
export async function idsDoPiloto(admin: Admin): Promise<Set<string>> {
  const { data, error } = await admin.from("vistoria_piloto").select("user_id");
  if (error) throw new Error(`[vistoria] contas do piloto: ${error.message}`);
  return new Set(((data ?? []) as { user_id: string }[]).map((l) => l.user_id));
}

/**
 * Histórico para os impedimentos: serviços prestados ao dono (pedidos de parceiro do 31b e vínculo fixo do 38, nos dois
 * casos ligados à conta do parceiro) e as avaliações anteriores do imóvel. Os pedidos do catálogo antigo de serviços e
 * dos fotógrafos antigos não têm a conta do prestador gravada e não entram (ver o PR).
 */
export async function historicoDoPedido(admin: Admin, ownerId: string, propertyId: string): Promise<HistoricoDesignacao> {
  const [pedidos, vinculos, avaliacoes] = await Promise.all([
    admin.from("parceiro_pedidos").select("criado_em, status, parceiros(user_id)").eq("cliente_id", ownerId).not("status", "in", "(recusado,cancelado)"),
    admin.from("imovel_parceiros").select("criado_em, respondido_em, status, parceiros(user_id), properties!inner(owner_id)").eq("properties.owner_id", ownerId).in("status", ["ativo", "encerrado"]),
    admin.from("vistoria_pedidos").select("avaliador_id, criado_em, status").eq("property_id", propertyId).in("status", ["realizada", "laudo_emitido"]).not("avaliador_id", "is", null).order("criado_em", { ascending: true }),
  ]);
  // Achado 39: histórico incompleto por erro apagaria um impedimento (quem já prestou serviço ao dono seria designado).
  const falha = [pedidos, vinculos, avaliacoes].find((r) => r.error);
  if (falha) throw new Error(`[vistoria] histórico do pedido: ${falha.error!.message}`);
  type P = { criado_em: string; respondido_em?: string | null; parceiros: { user_id: string } | null };
  const servicos = [...((pedidos.data ?? []) as unknown as P[]), ...((vinculos.data ?? []) as unknown as P[])]
    .filter((p) => p.parceiros?.user_id)
    .map((p) => ({ userId: p.parceiros!.user_id, ownerId, em: p.respondido_em ?? p.criado_em }));
  return {
    servicosAoDono: servicos,
    avaliacoesDoImovel: ((avaliacoes.data ?? []) as { avaliador_id: string; criado_em: string }[]).map((a) => ({ avaliadorId: a.avaliador_id, em: a.criado_em })),
  };
}

type LinhaPedido = {
  id: string;
  property_id: string;
  owner_id: string;
  cidade: string;
  tipo: TipoPedido;
  teste: boolean;
  status: string;
  origem_pedido_id: string | null;
  /** E1177: o estado da escolha que o pedido já tinha — é o "antes" da passagem que avisa o dono. */
  aguardando_avaliador: boolean | null;
  motivo_da_espera: string | null;
};

/** foraDoPiloto (E1146): os avaliadores da cidade que a chave em modo piloto deixou fora desta escolha. */
type LeituraEscolha = { p: LinhaPedido; sugestoes: Sugestoes; foraDoPiloto: AvaliadorFila[] };

/** Lê o pedido, a fila e o histórico e devolve os sugeridos. Qualquer leitura que falha LANÇA (nunca vira "ninguém elegível"). */
async function leituraDaEscolha(admin: Admin, pedidoId: string, agora: Date, statusAceitos: readonly string[] = ["pedido"]): Promise<LeituraEscolha | null> {
  const { data } = await admin.from("vistoria_pedidos").select("id, property_id, owner_id, cidade, tipo, teste, status, origem_pedido_id, aguardando_avaliador, motivo_da_espera").eq("id", pedidoId).maybeSingle();
  const p = data as LinhaPedido | null;
  if (!p || !statusAceitos.includes(p.status)) return null;
  const [jaLeitura, filaToda, historico, modo, piloto] = await Promise.all([
    admin.from("vistoria_designacoes").select("avaliador_id, resposta, proposta_expirada_em").eq("pedido_id", p.id),
    filaDaCidade(admin),
    historicoDoPedido(admin, p.owner_id, p.property_id),
    modoDaChaveAtual(),
    idsDoPiloto(admin),
  ]);
  // E1077: com a chave desligada, o pedido de um dono do piloto só vê avaliadores do piloto — mesmo quando quem lê é o
  // admin (fora do piloto). Nunca outro credenciado, nem a massa de teste de produção.
  const fila = filaNoAmbito(filaToda, modo === "desligada" && piloto.has(p.owner_id) ? "piloto" : modo, piloto);
  if (jaLeitura.error) throw new Error(`[vistoria] designações do pedido: ${jaLeitura.error.message}`);
  let primeiro: string | null = null;
  if (p.tipo === "contestacao" && p.origem_pedido_id) {
    const { data: o } = await admin.from("vistoria_pedidos").select("avaliador_id").eq("id", p.origem_pedido_id).maybeSingle();
    primeiro = (o?.avaliador_id as string | null) ?? null;
  }
  const pedido: PedidoParaDesignar = {
    id: p.id,
    propertyId: p.property_id,
    ownerId: p.owner_id,
    cidade: p.cidade,
    tipo: p.tipo,
    teste: p.teste,
    primeiroAvaliadorId: primeiro,
    // E1143: fica fora quem recusou, não respondeu, faltou ou está designado agora; quem só teve a proposta vencida volta.
    jaDesignados: jaDesignadosNoPedido((jaLeitura.data ?? []) as DesignacaoDoPedido[]),
  };
  const naEscolha = new Set(fila.map((a) => a.id));
  const foraDoPiloto = filaToda.filter((a) => !naEscolha.has(a.id) && atendeCidade(a.cidade, p.cidade));
  return { p, sugestoes: sugerirAvaliadores(fila, pedido, historico, agora), foraDoPiloto };
}

/**
 * E1146: o motivo do item "sem avaliador" — por avaliador da cidade, a regra que o impede neste pedido. O número do
 * credenciado é só para o admin ler; se a leitura dele falhar, o motivo sai sem os números (nunca trava a escolha).
 * A ordem é a do número, para o texto não mudar de um tique para o outro sem nada ter mudado.
 */
async function motivoDoItemSemAvaliador(admin: Admin, l: LeituraEscolha): Promise<string> {
  const fora: { id: string; motivo: MotivoForaDaEscolha }[] = [...l.sugestoes.impedidos, ...l.foraDoPiloto.map((a) => ({ id: a.id, motivo: "fora_do_piloto" as const }))];
  const numeros = new Map<string, string>();
  if (fora.length) {
    const { data } = await admin.from("avaliadores_credenciamento").select("id, numero_credenciado").in("id", fora.map((f) => f.id));
    for (const c of (data ?? []) as { id: string; numero_credenciado: string | null }[]) if (c.numero_credenciado) numeros.set(c.id, c.numero_credenciado);
  }
  const lista = fora.map((f) => ({ numero: numeros.get(f.id) ?? null, motivo: f.motivo, id: f.id }));
  lista.sort((x, y) => (x.numero ?? "~").localeCompare(y.numero ?? "~") || x.id.localeCompare(y.id));
  return motivoSemAvaliador(l.p.cidade, lista);
}

/**
 * E648: abre a ESCOLHA do dono. Não designa ninguém: calcula quem pode ser escolhido. Sem nenhum sugerido, o pedido fica
 * "aguardando avaliador" e o admin é avisado (para credenciar mais gente). Devolve quantos o dono pode escolher (null se a
 * leitura falhou: o pedido fica aguardando e a rotina do cron tenta de novo, sem avisar o admin à toa).
 */
export async function abrirEscolha(admin: Admin, pedidoId: string, agora = new Date()): Promise<number | null> {
  let l: LeituraEscolha | null;
  try {
    l = await leituraDaEscolha(admin, pedidoId, agora);
  } catch (e) {
    console.error("[vistoria] abrirEscolha: leitura falhou; o pedido fica para a próxima rotina:", e instanceof Error ? e.message : e);
    await admin.from("vistoria_pedidos").update({ aguardando_avaliador: true, atualizado_em: agora.toISOString() }).eq("id", pedidoId).eq("status", "pedido");
    return null;
  }
  if (!l) return null;
  const quando = agora.toISOString();
  // E1177: o estado da escolha fica gravado no pedido — a lista vazia com o MOTIVO, ou a lista só com o avaliador da
  // avaliação anterior (a exceção da alternância). É o que deixa a tela dizer a verdade e a rotina saber a quem voltar.
  const fora: MotivoForaDaEscolha[] = [...l.sugestoes.impedidos.map((i) => i.motivo), ...l.foraDoPiloto.map(() => "fora_do_piloto" as const)];
  const antes = { aguardando: l.p.aguardando_avaliador === true, motivo: l.p.motivo_da_espera };
  const depois = estadoDaEscolha(l.p.tipo, l.sugestoes.sugeridos, fora);
  if (depois.aguardando) {
    await admin.from("vistoria_pedidos").update({ aguardando_avaliador: true, motivo_da_espera: depois.motivo, atualizado_em: quando }).eq("id", l.p.id);
    // E1146: o item diz a regra que impede cada avaliador. Há um item aberto por pedido (índice único): o que já
    // estava aberto com o texto antigo, ou com outro impedimento, é atualizado em vez de se tentar inserir outro.
    const motivo = await motivoDoItemSemAvaliador(admin, l);
    const p = l.p;
    // E1149: o e-mail aos admins só sai quando o item é NOVO ou o MOTIVO muda. Antes saía em toda abertura sem
    // sugeridos, e a rotina (de hora em hora) reabre a escolha de cada pedido parado: N pedidos × cada admin × cada hora.
    // A marca é o próprio item aberto. Quem perde a corrida do insert, ou da troca do motivo, não avisa.
    const mudanca = await registrarSemAvaliador(
      {
        aberto: async () => {
          const { data: abertos } = await admin.from("vistoria_fila_admin").select("id, motivo").eq("tipo", "sem_avaliador").eq("pedido_id", p.id).is("resolvido_em", null).limit(1);
          return ((abertos ?? []) as ItemAberto[])[0] ?? null;
        },
        inserir: (m) => naFilaDoAdmin(admin, "sem_avaliador", { pedidoId: p.id }, m),
        mudarMotivo: async (item, m) => {
          const troca = admin.from("vistoria_fila_admin").update({ motivo: m }).eq("id", item.id).is("resolvido_em", null);
          const { data: trocados } = await (item.motivo === null ? troca.is("motivo", null) : troca.eq("motivo", item.motivo)).select("id");
          return (trocados ?? []).length > 0;
        },
      },
      motivo,
    );
    // E1177 (coordenador): a contestação pede um avaliador diferente do primeiro; sem outro na cidade, a equipe assume
    // o pedido — o item entra na fila com o tipo próprio (um por pedido: o índice único recusa o segundo). Nenhum
    // e-mail novo (ORDEM-DUET-673): a equipe é avisada pelo aviso de sempre, o do "sem avaliador", logo abaixo.
    if (depois.motivo === "contestacao_sem_segundo") await naFilaDoAdmin(admin, "contestacao_sem_avaliador", { pedidoId: p.id }, motivo);
    if (mudanca !== "igual") await avisarAdmins(admin, "vistoria_sem_avaliador");
    return 0;
  }
  // Há quem escolher. O dono é avisado só na passagem em que esperava e passou a ter o que esperava (a promessa da
  // tela): a troca é condicional ao estado de antes, para duas leituras ao mesmo tempo não avisarem duas vezes.
  const aviso = avisoAoDono(antes, depois);
  const novoEstado = { aguardando_avaliador: false, motivo_da_espera: depois.motivo, atualizado_em: quando };
  let passou = false;
  if (aviso) {
    const troca = admin.from("vistoria_pedidos").update(novoEstado).eq("id", l.p.id);
    const { data: mudou } = await (aviso === "lista_abriu" ? troca.eq("aguardando_avaliador", true) : troca.eq("motivo_da_espera", SO_O_ANTERIOR)).select("id");
    passou = (mudou ?? []).length > 0;
  } else await admin.from("vistoria_pedidos").update(novoEstado).eq("id", l.p.id);
  await admin.from("vistoria_fila_admin").update({ resolvido_em: quando }).eq("tipo", "sem_avaliador").eq("pedido_id", l.p.id).is("resolvido_em", null);
  await admin.from("vistoria_fila_admin").update({ resolvido_em: quando }).eq("tipo", "contestacao_sem_avaliador").eq("pedido_id", l.p.id).is("resolvido_em", null);
  if (aviso && passou) await avisar(admin, l.p.owner_id, "vistoria_avaliador_disponivel", rotaDono(l.p.property_id), { pedidoId: l.p.id, propertyId: l.p.property_id, papel: "dono", outro: aviso === "chegou_outro" });
  return l.sugestoes.sugeridos.length;
}

/** Os sugeridos do pedido (o que o dono vê para escolher). Lança se uma leitura falha. */
export async function sugeridosDoPedido(admin: Admin, pedidoId: string, agora = new Date()): Promise<AvaliadorElegivel[] | null> {
  const l = await leituraDaEscolha(admin, pedidoId, agora);
  return l ? l.sugestoes.sugeridos : null;
}

/**
 * E1100: quantos avaliadores o dono poderá escolher se descartar AGORA o avaliador escolhido (e a proposta dele). É a
 * MESMA leitura da escolha, feita com o pedido ainda designado: o avaliador atual já está entre os "já designados" e não
 * volta. Nada muda em quem pode ser escolhido. Lança se uma leitura falha (quem chama não inventa número).
 */
export async function outrosParaTroca(admin: Admin, pedidoId: string, agora = new Date()): Promise<number | null> {
  const l = await leituraDaEscolha(admin, pedidoId, agora, ["designado"]);
  return l ? l.sugestoes.sugeridos.length : null;
}

/**
 * E648: o DONO escolheu o avaliador. Só vale quem está entre os sugeridos (os impedimentos de independência seguem
 * valendo). O avaliador é avisado e responde com o próprio preço e prazo (ou recusa); nada é imposto a ele.
 */
export async function escolherNoServidor(admin: Admin, pedidoId: string, avaliadorId: string, agora = new Date()): Promise<{ ok: true } | { ok: false; erro: string }> {
  let l: LeituraEscolha | null;
  try {
    l = await leituraDaEscolha(admin, pedidoId, agora);
  } catch {
    return { ok: false, erro: "Não foi possível conferir os avaliadores agora. Tente de novo." };
  }
  if (!l) return { ok: false, erro: "Este pedido não está aguardando a escolha do avaliador." };
  const a = l.sugestoes.sugeridos.find((x) => x.id === avaliadorId);
  if (!a) return { ok: false, erro: "Este avaliador não pode avaliar este imóvel. Escolha outro da lista." };
  const quando = agora.toISOString();
  // E1143: o avaliador que voltou à lista (a proposta dele venceu sem o aceite) é escolhido de novo na MESMA designação:
  // há uma linha por pedido e avaliador. Ela reabre, sem resposta e sem a marca; sem linha para reabrir, cria-se.
  const { data: reaberta, error: erroReabrir } = await admin
    .from("vistoria_designacoes")
    .update({ designado_em: quando, resposta: null, respondido_em: null, proposta_expirada_em: null, mesmo_da_anterior: a.mesmoDaAnterior === true })
    .eq("pedido_id", l.p.id)
    .eq("avaliador_id", a.id)
    .eq("resposta", "expirada")
    .not("proposta_expirada_em", "is", null)
    .select("id");
  if (erroReabrir) return { ok: false, erro: "Não foi possível registrar a escolha. Tente de novo." };
  if (!reaberta?.length) {
    // E1177: a designação guarda se o escolhido é o mesmo da avaliação anterior (só possível pela exceção da alternância).
    const { error } = await admin.from("vistoria_designacoes").insert({ pedido_id: l.p.id, avaliador_id: a.id, designado_em: quando, mesmo_da_anterior: a.mesmoDaAnterior === true });
    if (error) return { ok: false, erro: "Não foi possível registrar a escolha. Tente de novo." };
  }
  const { data: mudou } = await admin
    .from("vistoria_pedidos")
    .update({ status: "designado", avaliador_id: a.id, designado_em: quando, escolhido_em: quando, aguardando_avaliador: false, motivo_da_espera: null, atualizado_em: quando })
    .eq("id", l.p.id)
    .eq("status", "pedido")
    .select("id");
  if (!mudou?.length) return { ok: false, erro: "Este pedido não está aguardando a escolha do avaliador." };
  await admin.from("avaliadores_credenciamento").update({ ultima_designacao_em: quando }).eq("id", a.id);
  await admin.from("vistoria_fila_admin").update({ resolvido_em: quando }).eq("tipo", "sem_avaliador").eq("pedido_id", l.p.id).is("resolvido_em", null);
  await avisar(admin, a.userId, "vistoria_designada", ROTA_AVALIADOR, { pedidoId: l.p.id });
  return { ok: true };
}

/**
 * E1102: grava a resposta do AVALIADOR DO PEDIDO ("aceita" ao propor, "recusada" ao recusar) na designação aberta. Se o
 * pedido não tem a linha da designação (massa antiga, dado incoerente), ela é criada já com a resposta, na data da
 * designação do pedido — antes, a resposta não tinha onde ser gravada e a ação dizia que o prazo tinha passado.
 * Devolve false quando a designação JÁ tem resposta (nada é gravado por cima) ou quando a leitura falha.
 * Quem chama já conferiu que a sessão é do avaliador do pedido e que o pedido está "designado".
 */
export async function registrarRespostaDoAvaliador(admin: Admin, pedidoId: string, avaliadorId: string, resposta: "aceita" | "recusada", agora = new Date()): Promise<boolean> {
  const quando = agora.toISOString();
  const { data } = await admin.from("vistoria_designacoes").update({ resposta, respondido_em: quando }).eq("pedido_id", pedidoId).eq("avaliador_id", avaliadorId).is("resposta", null).select("id");
  if (data?.length) return true;
  const { data: ja, error } = await admin.from("vistoria_designacoes").select("id").eq("pedido_id", pedidoId).eq("avaliador_id", avaliadorId).maybeSingle();
  if (error || ja) return false;
  const { data: p } = await admin.from("vistoria_pedidos").select("designado_em").eq("id", pedidoId).maybeSingle();
  const { error: erroNova } = await admin
    .from("vistoria_designacoes")
    .insert({ pedido_id: pedidoId, avaliador_id: avaliadorId, designado_em: (p?.designado_em as string | null | undefined) ?? quando, resposta, respondido_em: quando });
  return !erroNova;
}

/**
 * Recusa, silêncio de 24 h, ausência do avaliador ou proposta descartada pelo dono: fecha a escolha e DEVOLVE o pedido ao
 * dono para escolher outro (a Viva não passa ao "próximo da fila"). Ausência confere os critérios públicos (revisão
 * humana; nada de suspensão automática).
 * E1146: a designação deixa de ficar "aceita" com o pedido devolvido (fechoDaDesignacaoAoDevolver). O descarte do dono
 * grava "recusada" com a marca proposta_descartada_em (0360); a hora da resposta do avaliador (a da proposta) fica.
 */
export async function devolverAoDono(admin: Admin, pedidoId: string, avaliadorId: string, motivo: MotivoDaDevolucao, agora = new Date()): Promise<void> {
  const quando = agora.toISOString();
  const { data: linha } = await admin.from("vistoria_designacoes").select("id, resposta").eq("pedido_id", pedidoId).eq("avaliador_id", avaliadorId).maybeSingle();
  const designacao = linha as { id: string; resposta: string | null } | null;
  const fecho = designacao ? fechoDaDesignacaoAoDevolver(designacao.resposta, motivo) : null;
  if (designacao && fecho) {
    // No descarte, a hora da resposta do avaliador (a da proposta) fica; nos outros casos a resposta é de agora.
    const quandoFoi = fecho.descartada ? { proposta_descartada_em: quando } : { respondido_em: quando };
    await admin.from("vistoria_designacoes").update({ resposta: fecho.resposta, ...quandoFoi }).eq("id", designacao.id);
  }
  await admin
    .from("vistoria_pedidos")
    .update({ status: "pedido", avaliador_id: null, designado_em: null, escolhido_em: null, valor_proposto: null, prazo_proposto_dias: null, prazo_laudo_dias_uteis: null, proposta_em: null, proposta_aceita_em: null, agendado_para: null, ...LIMPEZA_DA_CONCORDANCIA, atualizado_em: quando })
    .eq("id", pedidoId);
  // E1128: o pedido voltou ao dono sem data — os avisos da visita que estava marcada deixam de valer.
  await resolverAvisosDaVisita(admin, pedidoId);
  // E1173: e o "o morador não concordou" também — a data seguinte é com outro avaliador.
  await resolverAvisosDaRecusa(admin, pedidoId);
  await abrirEscolha(admin, pedidoId, agora);
  if (motivo === "ausencia") await revisarCriterios(admin, avaliadorId, agora);
}

/**
 * E648: confere os critérios PÚBLICOS de qualidade do avaliador. Atingir um critério só coloca um item na fila do admin
 * (revisão humana, com direito de resposta do avaliador). O status do avaliador nunca muda por aqui.
 */
/**
 * E1142: a proposta venceu sem o aceite do dono. A designação deixa de dizer "aceita" e fica "expirada", com o instante
 * em que o prazo do dono acabou (proposta_expirada_em). Essa marca é o que separa esta expiração da do avaliador que
 * não respondeu: sem ela, as telas leriam "Sem resposta em 24 horas" de quem respondeu. A hora da resposta dele fica.
 */
export async function registrarPropostaExpirada(admin: Admin, pedidoId: string, avaliadorId: string, venceuEm: string): Promise<void> {
  await admin.from("vistoria_designacoes").update({ resposta: "expirada", proposta_expirada_em: venceuEm }).eq("pedido_id", pedidoId).eq("avaliador_id", avaliadorId).eq("resposta", "aceita");
}

export async function revisarCriterios(admin: Admin, avaliadorId: string, agora = new Date()): Promise<string[]> {
  const dia = 86_400_000;
  const desde = (d: number) => new Date(agora.getTime() - d * dia).toISOString();
  const [aus, rev, ped, cond] = await Promise.all([
    admin.from("vistoria_designacoes").select("respondido_em").eq("avaliador_id", avaliadorId).eq("resposta", "ausencia").gte("respondido_em", desde(90)),
    admin.from("vistoria_auditoria").select("resultado").eq("avaliador_id", avaliadorId).eq("resultado", "nao_confere").gte("revisado_em", desde(365)),
    admin.from("vistoria_pedidos").select("id, proposta_aceita_em, prazo_proposto_dias, prazo_laudo_dias_uteis, visita_concluida_em, agendado_para").eq("avaliador_id", avaliadorId).not("proposta_aceita_em", "is", null).gte("proposta_aceita_em", desde(180)),
    // E679-B: conduta é cega — só a PUBLICADA (os dois enviaram ou a janela de 14 dias fechou) entra na revisão.
    admin.from("vistoria_conduta").select("pontualidade, cordialidade, cuidado").eq("avaliador_id", avaliadorId).eq("autor", "dono").not("publicada_em", "is", null),
  ]);
  if ([aus, rev, ped, cond].some((r) => r.error)) return [];
  const pedidos = (ped.data ?? []) as { id: string; proposta_aceita_em: string; prazo_proposto_dias: number | null; prazo_laudo_dias_uteis: number | null; visita_concluida_em: string | null; agendado_para: string | null }[];
  let foraDoPrazo = 0;
  if (pedidos.length) {
    const { data: laudos } = await admin.from("vistoria_laudos").select("pedido_id, emitido_em, versao").in("pedido_id", pedidos.map((x) => x.id)).eq("versao", 1);
    const emitido = new Map(((laudos ?? []) as { pedido_id: string; emitido_em: string }[]).map((l) => [l.pedido_id, l.emitido_em]));
    for (const x of pedidos) {
      const em = emitido.get(x.id);
      // E1156: fora do prazo é fora do COMBINADO (dias úteis depois da visita); o pedido antigo conta como antes.
      if (em && laudoForaDoCombinado(x, em)) foraDoPrazo++;
    }
  }
  const notas = ((cond.data ?? []) as { pontualidade: number; cordialidade: number; cuidado: number }[]).map((c) => ({ ...c }) as Record<string, number>);
  const atingidos = criteriosAtingidos({
    ausenciasSemAviso90d: (aus.data ?? []).length,
    naoConfere12m: (rev.data ?? []).length,
    laudosForaDoPrazo180d: foraDoPrazo,
    notaConduta: notaConduta(notas),
    avaliacoesConduta: notas.length,
  });
  if (!atingidos.length) return [];
  const { data: aberto } = await admin.from("vistoria_fila_admin").select("id").eq("tipo", "revisao_criterio").eq("avaliador_id", avaliadorId).is("resolvido_em", null).limit(1);
  if (!aberto?.length) {
    const textos = atingidos.map((id) => CRITERIOS_PUBLICOS.find((c) => c.id === id)!.texto);
    await naFilaDoAdmin(admin, "revisao_criterio", { avaliadorId }, `Critério público atingido: ${textos.join(" | ")} Rever com o avaliador (direito de resposta) antes de qualquer decisão.`);
  }
  return atingidos;
}

/** Cron: designação sem resposta no prazo do avaliador, ou proposta que o dono não aceitou em 72 h, volta ao dono (sem rodízio); lembrete D-1 da visita; sorteio da auditoria. */
export async function rotinaVistoria(admin: Admin, agora = new Date()): Promise<{ expiradas: number; lembretes: number; sorteadas: number; reprocessados: number }> {
  let expiradas = 0;
  let lembretes = 0;
  let sorteadas = 0;
  let reprocessados = 0;
  const { data: abertas } = await admin.from("vistoria_designacoes").select("pedido_id, avaliador_id, designado_em").is("resposta", null);
  // E682: o prazo para o avaliador responder é o que ELE declarou (padrão 24 h).
  const { data: prazos } = await admin.from("avaliadores_credenciamento").select("id, prazo_resposta_horas");
  const horasDe = new Map(((prazos ?? []) as { id: string; prazo_resposta_horas: number | null }[]).map((x) => [x.id, x.prazo_resposta_horas ?? undefined]));
  for (const d of (abertas ?? []) as { pedido_id: string; avaliador_id: string; designado_em: string }[]) {
    if (!designacaoVencida(d.designado_em, agora, horasDe.get(d.avaliador_id))) continue;
    const { data: p } = await admin.from("vistoria_pedidos").select("status, avaliador_id, owner_id, property_id, proposta_em, proposta_aceita_em, escolhido_em, teste").eq("id", d.pedido_id).maybeSingle();
    if (p?.status !== "designado" || p.avaliador_id !== d.avaliador_id) continue;
    // E1101: a designação só vence pelo relógio de RESPOSTA (a mesma fonte das telas). Com a proposta enviada ele parou:
    // um pedido com proposta viva nunca volta ao dono como "sem resposta", mesmo com a designação incoerente.
    const relogioDaResposta = relogioDoPedido(
      {
        status: p.status,
        resposta: null,
        designadoEm: d.designado_em,
        propostaEm: (p.proposta_em as string | null) ?? null,
        propostaAceitaEm: (p.proposta_aceita_em as string | null) ?? null,
        prazoRespostaHoras: horasDe.get(d.avaliador_id),
        precisaDoAceite: precisaDoAceiteDoDono({ teste: p.teste === true, escolhidoEm: (p.escolhido_em as string | null) ?? null }),
      },
      agora,
    );
    if (relogioDaResposta?.vez !== "avaliador" || !relogioDaResposta.vencido) continue;
    await devolverAoDono(admin, d.pedido_id, d.avaliador_id, "expirada", agora);
    // E1160 (1): o silêncio do avaliador tem o seu próprio aviso (antes era o genérico, que mandava aceitar a proposta).
    await avisar(admin, p.owner_id, "vistoria_sem_resposta_dono", rotaDono(p.property_id), { pedidoId: d.pedido_id, propertyId: p.property_id });
    expiradas++;
  }
  // E682: proposta que o dono não aceitou no prazo dele (72 h) volta a ele para escolher de novo — sem rodízio.
  const { data: propostas } = await admin.from("vistoria_pedidos").select("id, avaliador_id, owner_id, property_id, proposta_em, escolhido_em, teste, avaliadores_credenciamento(parceiros(user_id))").eq("status", "designado").not("proposta_em", "is", null).is("proposta_aceita_em", null);
  for (const q of (propostas ?? []) as unknown as { id: string; avaliador_id: string | null; owner_id: string; property_id: string; proposta_em: string; escolhido_em: string | null; teste: boolean | null; avaliadores_credenciamento: { parceiros: { user_id: string } | null } | null }[]) {
    if (!q.avaliador_id || !propostaVencida(q.proposta_em, agora)) continue;
    // E1101: as 72 h são do dono que precisa aceitar. A avaliação de teste do credenciamento não tem aceite: não vence aqui.
    if (!precisaDoAceiteDoDono({ teste: q.teste === true, escolhidoEm: q.escolhido_em })) continue;
    // E1142: o registo diz o que aconteceu — a designação com a proposta enviada fica "expirada" (antes ficava "aceita").
    // Vem antes de devolver: depois disso o pedido já não guarda a proposta.
    await registrarPropostaExpirada(admin, q.id, q.avaliador_id, fimDoPrazoDeAceite(q.proposta_em) ?? agora.toISOString());
    await devolverAoDono(admin, q.id, q.avaliador_id, "expirada", agora);
    // E1144: o dono recebe o e-mail próprio da expiração (antes era o genérico "novidade na escolha do avaliador").
    await avisar(admin, q.owner_id, "vistoria_proposta_expirada_dono", rotaDono(q.property_id), { pedidoId: q.id, propertyId: q.property_id });
    // E1142 (decisão do Daniel, ORDEM-DUET-622): o avaliador também é avisado — ele contava com uma resposta que não vem.
    await avisar(admin, q.avaliadores_credenciamento?.parceiros?.user_id, "vistoria_proposta_expirada", ROTA_AVALIADOR, { pedidoId: q.id, propertyId: q.property_id });
    expiradas++;
  }
  // Pedidos sem nenhum avaliador para o dono escolher: tenta de novo (alguém pode ter sido credenciado).
  // E1177: e os pedidos em que a lista só tem o avaliador da avaliação anterior — o dono pode estar à espera de outro.
  const { data: parados } = await admin.from("vistoria_pedidos").select("id").eq("status", "pedido").or(`aguardando_avaliador.eq.true,motivo_da_espera.eq.${SO_O_ANTERIOR}`);
  for (const p of (parados ?? []) as { id: string }[]) {
    if (await abrirEscolha(admin, p.id, agora)) reprocessados++;
  }
  const hoje = hojeEmBrasilia(agora);
  const { data: agendados } = await admin
    .from("vistoria_pedidos")
    .select("id, property_id, owner_id, morador_id, agendado_para, lembrete_d1_em, avaliadores_credenciamento(parceiros(user_id))")
    .eq("status", "agendado")
    .is("lembrete_d1_em", null);
  for (const v of (agendados ?? []) as unknown as { id: string; property_id: string; owner_id: string; morador_id: string | null; agendado_para: string | null; avaliadores_credenciamento: { parceiros: { user_id: string } | null } | null }[]) {
    if (!v.agendado_para || !visitaAmanha(v.agendado_para, hoje)) continue;
    const { data: marcou } = await admin.from("vistoria_pedidos").update({ lembrete_d1_em: agora.toISOString() }).eq("id", v.id).is("lembrete_d1_em", null).select("id");
    if (!marcou?.length) continue;
    // E1160 (5): o corpo sabe quem lê — a regra do reagendamento é das duas partes; o morador lê o texto dele.
    await avisar(admin, v.owner_id, "vistoria_lembrete", rotaDono(v.property_id), { pedidoId: v.id, propertyId: v.property_id, papel: "dono" });
    await avisar(admin, v.avaliadores_credenciamento?.parceiros?.user_id, "vistoria_lembrete", ROTA_AVALIADOR, { pedidoId: v.id, propertyId: v.property_id, papel: "avaliador" });
    await avisar(admin, v.morador_id, "vistoria_lembrete", rotaMorador(v.id), { pedidoId: v.id, propertyId: v.property_id, papel: "morador" });
    lembretes++;
  }
  const { data: emitidos } = await admin.from("vistoria_pedidos").select("id, avaliador_id, teste").eq("status", "laudo_emitido").not("avaliador_id", "is", null);
  for (const e of (emitidos ?? []) as { id: string; avaliador_id: string; teste: boolean }[]) {
    if (e.teste || !sorteadoParaAuditoria(e.id)) continue;
    const { error } = await admin.from("vistoria_auditoria").insert({ pedido_id: e.id, avaliador_id: e.avaliador_id });
    if (!error) sorteadas++;
  }
  return { expiradas, lembretes, sorteadas, reprocessados };
}

/**
 * E30: credenciamentos com a avaliação de teste FEITA (pedido de teste designado a eles, laudo emitido). É o registro
 * que libera a ativação e o passo 5 do checklist.
 */
export async function comTesteConcluido(admin: Admin, avaliadorIds: string[]): Promise<Set<string>> {
  if (!avaliadorIds.length) return new Set();
  const { data, error } = await admin
    .from("vistoria_pedidos")
    .select("avaliador_id")
    .eq("teste", true)
    .eq("status", STATUS_TESTE_CONCLUIDO)
    .in("avaliador_id", avaliadorIds);
  if (error) {
    console.error("[vistoria] teste concluído:", error.message);
    return new Set();
  }
  return new Set(((data ?? []) as { avaliador_id: string }[]).map((r) => r.avaliador_id));
}
