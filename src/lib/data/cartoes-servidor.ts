import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/site";
import { urlMidiaParceiro } from "@/lib/data/parceiros-publico";
import {
  camposCartaoParceiro,
  chaveDosCartoes,
  codigoValido,
  gerarCodigo,
  gerarCurto,
  legendaParceiro,
  legendaWhatsapp,
  lerCookieRefParceiro,
  urlDoCartao,
  urlDoCartaoParceiro,
  type CamposCartaoParceiro,
  type MeioCartao,
  type MetricaCartao,
  type TipoCartao,
  type TipoCartaoImovel,
} from "@/lib/cartoes/compartilhar";

/**
 * Cartões compartilháveis (Fase 1) — só do servidor, com o cliente de serviço. A assinatura do QR usa uma chave
 * derivada do segredo do servidor (o mesmo das outras assinaturas do app); nenhuma variável nova.
 */
export function chaveServidor(): Buffer {
  return chaveDosCartoes(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

/** Produção = o domínio público; o laboratório (localhost) só fora de produção. */
export function emProducao(): boolean {
  return process.env.VERCEL_ENV === "production" || (process.env.NODE_ENV === "production" && !/localhost|127\.0\.0\.1/.test(SITE_URL));
}

/** Código ativo da conta; cria um se não houver (colisão de código → tenta de novo). */
export async function codigoDaConta(admin: SupabaseClient, usuarioId: string): Promise<string> {
  const { data } = await admin.from("codigos_compartilhamento").select("codigo").eq("usuario_id", usuarioId).is("revogado_em", null).maybeSingle();
  if (data?.codigo && codigoValido(data.codigo as string)) return data.codigo as string;
  for (let i = 0; i < 5; i++) {
    const codigo = gerarCodigo();
    const { error } = await admin.from("codigos_compartilhamento").insert({ codigo, usuario_id: usuarioId });
    if (!error) return codigo;
    // Outro pedido criou o código ao mesmo tempo (índice de 1 ativo por conta): usa o dele.
    const { data: outro } = await admin.from("codigos_compartilhamento").select("codigo").eq("usuario_id", usuarioId).is("revogado_em", null).maybeSingle();
    if (outro?.codigo) return outro.codigo as string;
  }
  throw new Error("Não foi possível criar o código de compartilhamento.");
}

/** Revoga o código ativo (o QR antigo deixa de atribuir) e devolve o novo. */
export async function trocarCodigo(admin: SupabaseClient, usuarioId: string): Promise<string> {
  await admin.from("codigos_compartilhamento").update({ revogado_em: new Date().toISOString() }).eq("usuario_id", usuarioId).is("revogado_em", null);
  return codigoDaConta(admin, usuarioId);
}

/** O código está ativo? Devolve o dono (para não atribuir a visita da própria pessoa). */
export async function codigoAtivo(admin: SupabaseClient, codigo: string): Promise<{ usuarioId: string } | null> {
  if (!codigoValido(codigo)) return null;
  const { data } = await admin.from("codigos_compartilhamento").select("usuario_id").eq("codigo", codigo).is("revogado_em", null).maybeSingle();
  return data ? { usuarioId: data.usuario_id as string } : null;
}

/** Grava uma métrica dos cartões em `eventos` (nunca derruba o fluxo). */
export async function registrarMetrica(
  admin: SupabaseClient,
  tipo: MetricaCartao,
  o: { cartaoTipo: TipoCartao; imovelId?: string | null; parceiroId?: string | null; usuarioId?: string | null; meio?: string },
): Promise<void> {
  try {
    await admin.from("eventos").insert({
      tipo,
      cartao_tipo: o.cartaoTipo,
      imovel_id: o.imovelId ?? null,
      // Cartão do parceiro (0192): de qual parceiro é a métrica; o QR dele usa utm_source=cartao.
      ...(o.parceiroId ? { parceiro_id: o.parceiroId } : {}),
      usuario_id: o.usuarioId ?? null,
      origem_source: o.cartaoTipo === "partnercard" ? "cartao" : "share_card",
      origem_medium: o.meio ?? null,
      origem_campaign: o.cartaoTipo,
      plataforma: "web",
    });
  } catch {
    /* métrica é best-effort */
  }
}

export interface CartaoLinha {
  id: string;
  tipo: TipoCartao;
  usuario_id: string;
  /** Cartões de imóvel (poststay/ownercard); nulo no cartão do parceiro. */
  property_id: string | null;
  contrato_id: string | null;
  /** Só no cartão do parceiro (partnercard). */
  parceiro_id: string | null;
  curto: string;
  mostrar_nome: boolean;
}

const COLUNAS_CARTAO = "id, tipo, usuario_id, property_id, contrato_id, parceiro_id, curto, mostrar_nome";

/** Cartão do alvo (cria na 1ª vez e conta cards_generated uma vez só). */
export async function garantirCartao(admin: SupabaseClient, o: { tipo: TipoCartaoImovel; usuarioId: string; propertyId: string; contratoId?: string | null }): Promise<CartaoLinha | null> {
  const achar = async () => {
    let q = admin.from("cartoes_compartilhaveis").select(COLUNAS_CARTAO).eq("tipo", o.tipo).eq("usuario_id", o.usuarioId).eq("property_id", o.propertyId);
    q = o.contratoId ? q.eq("contrato_id", o.contratoId) : q.is("contrato_id", null);
    return ((await q.maybeSingle()).data as CartaoLinha | null) ?? null;
  };
  const existente = await achar();
  if (existente) return existente;
  await codigoDaConta(admin, o.usuarioId);
  for (let i = 0; i < 5; i++) {
    const { data, error } = await admin
      .from("cartoes_compartilhaveis")
      .insert({ tipo: o.tipo, usuario_id: o.usuarioId, property_id: o.propertyId, contrato_id: o.contratoId ?? null, curto: gerarCurto() })
      .select(COLUNAS_CARTAO)
      .single();
    if (!error && data) {
      await registrarMetrica(admin, "cards_generated", { cartaoTipo: o.tipo, imovelId: o.propertyId, usuarioId: o.usuarioId });
      return data as CartaoLinha;
    }
    const outro = await achar(); // criado ao mesmo tempo por outro pedido
    if (outro) return outro;
  }
  return null;
}

/** Cartão do parceiro (um por parceiro; cria na 1ª vez e conta cards_generated uma vez só). */
export async function garantirCartaoParceiro(admin: SupabaseClient, o: { usuarioId: string; parceiroId: string }): Promise<CartaoLinha | null> {
  const achar = async () =>
    ((
      await admin.from("cartoes_compartilhaveis").select(COLUNAS_CARTAO).eq("tipo", "partnercard").eq("usuario_id", o.usuarioId).eq("parceiro_id", o.parceiroId).maybeSingle()
    ).data as CartaoLinha | null) ?? null;
  const existente = await achar();
  if (existente) return existente;
  await codigoDaConta(admin, o.usuarioId);
  for (let i = 0; i < 5; i++) {
    const { data, error } = await admin
      .from("cartoes_compartilhaveis")
      .insert({ tipo: "partnercard", usuario_id: o.usuarioId, parceiro_id: o.parceiroId, property_id: null, contrato_id: null, curto: gerarCurto() })
      .select(COLUNAS_CARTAO)
      .single();
    if (!error && data) {
      await registrarMetrica(admin, "cards_generated", { cartaoTipo: "partnercard", parceiroId: o.parceiroId, usuarioId: o.usuarioId });
      return data as CartaoLinha;
    }
    const outro = await achar();
    if (outro) return outro;
  }
  return null;
}

export async function cartaoPeloCurto(admin: SupabaseClient, curto: string): Promise<CartaoLinha | null> {
  const { data } = await admin.from("cartoes_compartilhaveis").select(COLUNAS_CARTAO).eq("curto", curto).maybeSingle();
  return (data as CartaoLinha | null) ?? null;
}

/** URL assinada (QR ou link) com o código ATIVO da conta: trocar o código troca o QR de todos os cartões. */
export async function urlAssinada(admin: SupabaseClient, c: Pick<CartaoLinha, "usuario_id" | "property_id" | "tipo"> & { parceiro_id?: string | null }, meio: MeioCartao): Promise<string> {
  const ref = await codigoDaConta(admin, c.usuario_id);
  if (c.tipo === "partnercard") {
    const { data } = await admin.from("parceiros").select("slug").eq("id", c.parceiro_id ?? "").maybeSingle();
    if (!data?.slug || !c.parceiro_id) throw new Error("Parceiro do cartão não encontrado.");
    return urlDoCartaoParceiro({ base: SITE_URL, producao: emProducao(), chave: chaveServidor(), ref, parceiroId: c.parceiro_id, slug: data.slug as string, meio });
  }
  return urlDoCartao({ base: SITE_URL, producao: emProducao(), chave: chaveServidor(), ref, listingId: c.property_id ?? "", tipo: c.tipo, meio });
}

export interface DadosDoCartao {
  tipo: TipoCartaoImovel;
  titulo: string;
  bairro: string;
  cidade: string;
  valorMensal: number | null;
  minDias: number | null;
  fotoUrl: string | null;
  inicioEstadia: string | null;
  nomeCompleto: string | null;
  mostrarNome: boolean;
}

/** Só os campos aprovados do cartão (nada de endereço exato, contato ou dado do contrato além do mês/ano). */
export async function dadosDoCartao(admin: SupabaseClient, c: CartaoLinha): Promise<DadosDoCartao | null> {
  if (c.tipo === "partnercard" || !c.property_id) return null; // o cartão do parceiro usa dadosDoCartaoParceiro
  const [{ data: p }, { data: foto }, bloco, perfil] = await Promise.all([
    admin.from("properties").select("title, address, city, monthly_price, min_period_days").eq("id", c.property_id).maybeSingle(),
    admin.from("property_photos").select("url").eq("property_id", c.property_id).order("sort_order", { ascending: true }).limit(1).maybeSingle(),
    c.contrato_id
      ? admin.from("contrato_blocos").select("inicio").eq("contrato_id", c.contrato_id).order("numero_bloco", { ascending: true }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    c.tipo === "poststay" && c.mostrar_nome ? admin.from("profiles").select("full_name").eq("id", c.usuario_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!p) return null;
  return {
    tipo: c.tipo as TipoCartaoImovel,
    titulo: String(p.title ?? "Imóvel mobiliado"),
    bairro: String(p.address ?? ""),
    cidade: String(p.city ?? ""),
    valorMensal: p.monthly_price == null ? null : Number(p.monthly_price),
    minDias: p.min_period_days == null ? null : Number(p.min_period_days),
    fotoUrl: (foto?.url as string | undefined) ?? null,
    inicioEstadia: ((bloco as { data: { inicio?: string } | null }).data?.inicio as string | undefined) ?? null,
    nomeCompleto: ((perfil as { data: { full_name?: string } | null }).data?.full_name as string | undefined) ?? null,
    mostrarNome: c.mostrar_nome,
  };
}

/**
 * Cartão do parceiro: SÓ a página pública (a view parceiros_publicos, que já não tem documento, telefone, CEP,
 * recebimento nem contato) e só publicada. Os campos desenhados saem de camposCartaoParceiro.
 */
export async function dadosDoCartaoParceiro(admin: SupabaseClient, c: CartaoLinha): Promise<{ campos: CamposCartaoParceiro; slug: string; teste: boolean } | null> {
  if (c.tipo !== "partnercard" || !c.parceiro_id) return null;
  const { data: p } = await admin
    .from("parceiros_publicos")
    .select("id, slug, nome_publico, categorias, cidades, avatar_path, banner_path, nota_media, avaliacoes_qtd, teste")
    .eq("id", c.parceiro_id)
    .maybeSingle();
  if (!p) return null;
  const campos = camposCartaoParceiro(
    {
      nomePublico: String(p.nome_publico ?? ""),
      categorias: (p.categorias as string[] | null) ?? [],
      cidades: (p.cidades as string[] | null) ?? [],
      notaMedia: p.nota_media == null ? null : Number(p.nota_media),
      avaliacoesQtd: Number(p.avaliacoes_qtd ?? 0),
      fotoUrl: urlMidiaParceiro((p.avatar_path as string | null) ?? (p.banner_path as string | null)),
    },
    c.mostrar_nome,
  );
  return { campos, slug: String(p.slug), teste: p.teste === true };
}

/** Tudo o que a tela de compartilhar precisa: imagens, link curto e a legenda do WhatsApp. */
export async function pacoteDeCompartilhar(admin: SupabaseClient, c: CartaoLinha) {
  const link = `${SITE_URL}/c/${c.curto}`;
  let legenda: string;
  if (c.tipo === "partnercard") {
    const dp = await dadosDoCartaoParceiro(admin, c);
    legenda = legendaParceiro({ categoria: dp?.campos.categoria ?? "Serviço", cidade: dp?.campos.cidades.split(" · ")[0] ?? "", link });
  } else {
    const d = await dadosDoCartao(admin, c);
    legenda = legendaWhatsapp({ tipo: c.tipo, cidade: d?.cidade ?? "", bairro: d?.bairro, link });
  }
  return {
    curto: c.curto,
    tipo: c.tipo,
    mostrarNome: c.mostrar_nome,
    link,
    imagemRetrato: `/cartoes/${c.curto}/imagem?formato=retrato`,
    imagemQuadrado: `/cartoes/${c.curto}/imagem?formato=quadrado`,
    legenda,
  };
}
export type PacoteDeCompartilhar = Awaited<ReturnType<typeof pacoteDeCompartilhar>>;

/**
 * Candidatura que veio de um cartão: guarda o código e o tipo no lead (pelo cliente de serviço — o inquilino não
 * escreve atribuição). Só com o cookie da visita assinada, do MESMO imóvel, código ativo e de outra conta.
 */
export async function atribuirLead(admin: SupabaseClient, o: { propertyId: string; tenantId: string; cookieValor: string | null | undefined }): Promise<boolean> {
  const { lerCookieRef } = await import("@/lib/cartoes/compartilhar");
  const c = lerCookieRef(o.cookieValor);
  if (!c || c.listingId !== o.propertyId) return false;
  const dono = await codigoAtivo(admin, c.ref);
  if (!dono || dono.usuarioId === o.tenantId) return false;
  const { error } = await admin
    .from("leads")
    .update({ ref_codigo: c.ref, ref_tipo: c.tipo })
    .eq("property_id", o.propertyId)
    .eq("tenant_id", o.tenantId)
    .is("ref_codigo", null);
  return !error;
}

/**
 * Pedido de serviço que veio do cartão do parceiro (para o 31b gravar em parceiro_pedidos.ref_codigo/ref_tipo):
 * só com o cookie da visita assinada à página DESTE parceiro, código ativo da conta do parceiro e cliente que não
 * é o próprio parceiro. O gatilho da 0192 conta ref_partner_requests uma vez por pedido.
 */
export async function atribuicaoDoPedidoParceiro(
  admin: SupabaseClient,
  o: { parceiroId: string; clienteId: string; cookieValor: string | null | undefined },
): Promise<{ ref_codigo: string; ref_tipo: "partnercard" } | null> {
  const c = lerCookieRefParceiro(o.cookieValor);
  if (!c || c.parceiroId !== o.parceiroId) return null;
  const dono = await codigoAtivo(admin, c.ref);
  if (!dono || dono.usuarioId === o.clienteId) return null;
  const { data: p } = await admin.from("parceiros").select("user_id").eq("id", o.parceiroId).maybeSingle();
  if (!p || p.user_id !== dono.usuarioId) return null;
  return { ref_codigo: c.ref, ref_tipo: "partnercard" };
}

/**
 * Rede diária (cron de automações): o cartão-postal nasce sozinho depois da saída (contratos que terminaram nos
 * últimos 30 dias) e todo anúncio publicado tem o seu cartão (inclusive os publicados antes desta versão).
 */
export async function gerarCartoesAutomaticos(admin: SupabaseClient, hoje: string): Promise<{ postais: number; anuncios: number }> {
  const { estadiaTerminou } = await import("@/lib/cartoes/compartilhar");
  const limite = new Date(Date.parse(`${hoje}T12:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  let postais = 0;
  let anuncios = 0;
  const { data: contratos } = await admin
    .from("contratos")
    .select("id, tenant_id, property_id, status, assinado_proprietario_em, assinado_inquilino_em, contrato_blocos(fim)")
    .not("assinado_proprietario_em", "is", null)
    .not("assinado_inquilino_em", "is", null)
    .neq("status", "cancelado")
    .limit(1000);
  for (const c of contratos ?? []) {
    const fim = ((c.contrato_blocos ?? []) as { fim: string | null }[]).map((b) => b.fim).filter((f): f is string => !!f).sort().at(-1) ?? null;
    if (fim && fim < limite) continue;
    const ok = estadiaTerminou({ status: String(c.status), assinadoProprietarioEm: c.assinado_proprietario_em as string, assinadoInquilinoEm: c.assinado_inquilino_em as string, fimUltimoBloco: fim }, hoje);
    if (ok && (await garantirCartao(admin, { tipo: "poststay", usuarioId: c.tenant_id as string, propertyId: c.property_id as string, contratoId: c.id as string }))) postais++;
  }
  const { data: ativos } = await admin.from("properties").select("id, owner_id").eq("status", "active").limit(2000);
  const { data: comCartao } = await admin.from("cartoes_compartilhaveis").select("property_id").eq("tipo", "ownercard").limit(5000);
  const ja = new Set((comCartao ?? []).map((r) => r.property_id as string));
  for (const p of ativos ?? []) {
    if (ja.has(p.id as string) || !p.owner_id) continue;
    if (await garantirCartao(admin, { tipo: "ownercard", usuarioId: p.owner_id as string, propertyId: p.id as string })) anuncios++;
  }
  return { postais, anuncios };
}
