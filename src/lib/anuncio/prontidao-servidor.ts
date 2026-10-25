import { situacaoLimite } from "@/lib/anuncio/pausa";
import { planoDoProprietario } from "@/lib/data/plano-efetivo";
import { itensFaltantes } from "@/lib/conforto/regras";
import { tipoEntradaBloqueia } from "@/lib/anuncio/chegada-e-pedido";
import { ehChacara, faltaChacara, normalizarChacara } from "@/lib/anuncio/chacara";
import { temInternet, tipoInternetDoAnuncio } from "@/lib/anuncio/internet-imovel";
import { rotuloItem } from "@/config/niveis";
import { provaAntigaNoPrazo, type OrigemFoto } from "@/lib/niveis/prova-camera";
import { fatosDaLinha, prontidaoAnuncio, type FatosAnuncio, type LinhaAnuncio, type Prontidao, type StatusDocumento } from "./prontidao";

/**
 * Prontidão dos anúncios de UM dono, lida do banco — a mesma regra pura de
 * lib/anuncio/prontidao.ts. Usada em Meus imóveis, Visão geral, no servidor do
 * Publicar e na ferramenta da Viva. Só do servidor.
 */

// Cliente Supabase do servidor (da pessoa, com RLS, ou o admin). Tipado frouxo de propósito.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any;

const COLUNAS =
  "id, status, title, address, city, bathrooms, area_m2, min_period_days, monthly_price, garantias_aceitas, ownership_type, sublease_authorized, description, ready_to_live_badge, video_url, video_arquivo";

/** Fatos do banco por imóvel (o editor usa como base e sobrepõe o que está sendo editado). */
export async function fatosDosImoveis(cliente: Cliente, ownerId: string, ids?: string[]): Promise<Map<string, FatosAnuncio>> {
  const mapa = new Map<string, FatosAnuncio>();
  const consulta = (colunas: string) => {
    let q = cliente.from("properties").select(colunas).eq("owner_id", ownerId);
    if (ids && ids.length) q = q.in("id", ids);
    return q;
  };
  // 0091 (autorizacao_anexada) pode ainda não estar aplicada: cai nas colunas antigas.
  // 0116 (sem_cameras_interior) idem: cai para as colunas sem ela (a declaração não barra).
  let { data: props, error } = await consulta(`${COLUNAS}, autorizacao_anexada, sem_cameras_interior`);
  if (error) ({ data: props, error } = await consulta(`${COLUNAS}, autorizacao_anexada`));
  if (error) ({ data: props } = await consulta(COLUNAS));
  const lista = (props ?? []) as (LinhaAnuncio & { id: string; status: string })[];
  if (lista.length === 0) return mapa;
  const idsLista = lista.map((p) => p.id);

  const [{ data: fotos }, { data: docs }, plano, { count: ativos }, conforto, entrada] = await Promise.all([
    cliente.from("property_photos").select("property_id").in("property_id", idsLista),
    cliente.from("qualification_checklists").select("property_id, document_status, created_at").eq("owner_id", ownerId).in("property_id", idsLista).order("created_at", { ascending: false }),
    planoDoProprietario(cliente, ownerId),
    cliente.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "active"),
    // Prompt 59: declarações do padrão mínimo (sem a 0210, erro → não barra aqui; o banco é a trava).
    cliente.from("conforto_declaracoes").select("property_id, chave, confirmado, versao_lista").in("property_id", idsLista),
    // 61-B: tipo de entrada (sem a 0225, erro → não barra). FILTROS-1: a velocidade da internet na mesma leitura.
    cliente.from("properties").select("id, tipo_entrada, internet_mbps").in("id", idsLista),
  ]);
  // TIPO-CHACARA-B: tipo e o grupo do tipo (0235). Leitura à parte: sem a coluna, erro → não barra aqui.
  const tipoLido = await cliente.from("properties").select("id, property_type, detalhes_anuncio").in("id", idsLista);
  const chacaraPor = tipoLido.error
    ? null
    : new Map(
        ((tipoLido.data ?? []) as { id: string; property_type: string | null; detalhes_anuncio: { chacara?: unknown } | null }[])
          .filter((r) => ehChacara(r.property_type))
          .map((r) => [r.id, faltaChacara(normalizarChacara(r.detalhes_anuncio?.chacara))]),
      );
  // E102-B: "Não tem internet" (qualquer tipo com a pergunta) barra pelo padrão mínimo.
  const semInternetPor = new Set(
    tipoLido.error
      ? []
      : ((tipoLido.data ?? []) as { id: string; property_type: string | null; detalhes_anuncio: unknown }[])
          .filter((r) => !temInternet(tipoInternetDoAnuncio(r.property_type, r.detalhes_anuncio)))
          .map((r) => r.id),
  );
  // FOTO-NA-HORA-B: provas de nível anteriores à regra ainda no prazo (sem a 0242, erro → nada aparece).
  const provasLidas = await cliente.from("nivel_itens").select("property_id, chave, foto_path, foto_origem, refazer_ate").in("property_id", idsLista).eq("foto_origem", "arquivo");
  const provasPor = new Map<string, { chave: string; rotulo: string; ate: string }[]>();
  const agora = new Date();
  for (const x of provasLidas.error ? [] : ((provasLidas.data ?? []) as { property_id: string; chave: string; foto_path: string | null; foto_origem: OrigemFoto; refazer_ate: string | null }[])) {
    if (!x.refazer_ate || !provaAntigaNoPrazo({ fotoOrigem: x.foto_origem, refazerAte: x.refazer_ate, fotoPath: x.foto_path }, agora)) continue;
    provasPor.set(x.property_id, [...(provasPor.get(x.property_id) ?? []), { chave: x.chave, rotulo: rotuloItem(x.chave), ate: x.refazer_ate }]);
  }
  const tipoEntradaPor = entrada.error ? null : new Map(((entrada.data ?? []) as { id: string; tipo_entrada: string | null }[]).map((e) => [e.id, e.tipo_entrada]));
  const internetPor = entrada.error ? null : new Map(((entrada.data ?? []) as { id: string; internet_mbps: number | null }[]).map((e) => [e.id, Number(e.internet_mbps) || 0]));
  const declPor = new Map<string, { chave: string; confirmado: boolean; versao_lista?: number | null }[]>();
  const confortoLido = !conforto.error;
  for (const d of (conforto.data ?? []) as { property_id: string; chave: string; confirmado: boolean; versao_lista?: number | null }[]) {
    declPor.set(d.property_id, [...(declPor.get(d.property_id) ?? []), d]);
  }
  const fotosPor = new Map<string, number>();
  for (const f of (fotos ?? []) as { property_id: string }[]) fotosPor.set(f.property_id, (fotosPor.get(f.property_id) ?? 0) + 1);
  const docPor = new Map<string, StatusDocumento>();
  for (const d of (docs ?? []) as { property_id: string; document_status: string | null }[]) {
    if (!docPor.has(d.property_id)) docPor.set(d.property_id, ((d.document_status as StatusDocumento) ?? "none") || "none");
  }
  // 64-B: a MESMA conta do servidor (situacaoLimite). Os publicados não saem do ar acima do limite; quem não está
  // publicado (rascunho ou pausado) precisa de uma vaga, contando os publicados sem ele.
  const sit = situacaoLimite(plano as string, ativos ?? 0);
  for (const p of lista) {
    const limiteOk = p.status === "active" ? true : sit.podePublicarNovo;
    const f = fatosDaLinha(p, fotosPor.get(p.id) ?? 0, docPor.get(p.id) ?? "none", limiteOk, sit.limite, sit.ativos);
    // O padrão mínimo é condição para PASSAR a publicado; o publicado sem ele segue o prazo de adequação (D4).
    if (confortoLido && p.status !== "active") f.confortoFaltam = itensFaltantes(declPor.get(p.id) ?? []).length;
    // 61-B: o tipo de entrada só barra o anúncio NOVO (rascunho); o que já foi publicado segue sem bloqueio retroativo.
    if (tipoEntradaPor && p.status === "draft") f.tipoEntradaOk = !tipoEntradaBloqueia({ tipoEntrada: tipoEntradaPor.get(p.id), jaPublicado: false });
    // FILTROS-1 (E39): o anúncio novo só publica com a velocidade da internet (o publicado sem ela segue no ar).
    if (internetPor && p.status === "draft") f.internetOk = (internetPor.get(p.id) ?? 0) > 0;
    // TIPO-CHACARA-B: chácara/sítio só passa a publicado com acesso, tipo de internet e o ponto marcado no mapa.
    if (chacaraPor?.has(p.id) && p.status !== "active") f.chacaraFaltam = chacaraPor.get(p.id);
    // E102-B: sem internet no imóvel, não passa a publicado; o motivo é a falta de internet, não os Mbps em branco.
    if (semInternetPor.has(p.id) && p.status !== "active") f.semInternet = true;
    if (provasPor.has(p.id)) f.provasParaRefazer = provasPor.get(p.id);
    mapa.set(p.id, f);
  }
  return mapa;
}

export async function prontidaoDosImoveis(cliente: Cliente, ownerId: string, ids?: string[]): Promise<Map<string, Prontidao>> {
  const mapa = new Map<string, Prontidao>();
  for (const [id, f] of await fatosDosImoveis(cliente, ownerId, ids)) mapa.set(id, prontidaoAnuncio(f));
  return mapa;
}

export async function prontidaoDoImovel(cliente: Cliente, ownerId: string, id: string): Promise<Prontidao | null> {
  return (await prontidaoDosImoveis(cliente, ownerId, [id])).get(id) ?? null;
}
