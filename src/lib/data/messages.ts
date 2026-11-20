import { createClient } from "@/lib/supabase/server";
import { ordenarPorAtividade } from "@/lib/mensagens/ordem";
import { linkedinConectados } from "@/lib/linkedin/servidor";
import { vinculosConfirmados } from "@/lib/vinculo/servidor";
import { createAdminClient } from "@/lib/supabase/admin";
import { relacaoAceitaEntreServidor } from "@/lib/data/avatar-url";
import { nomeNaConversa } from "@/lib/perfil/perfil-publico";
import { contratoAssinadoEntrePartes, type ContratoParaAlerta } from "@/lib/seguranca/antigolpe";
import { papelDaConversa, formatarPeriodo, type PapelConversa } from "@/lib/mensagens-filtros";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { urlMidiaParceiro } from "@/lib/data/parceiros-publico";
import { conversasDeContratos, type ContratoParaConversa } from "@/lib/mensagens/conversa-pedida";
import { conversationId } from "@/lib/messages/conversation-id";
import { emergenciaDisponivel } from "@/lib/estadia/emergencia-chegada";
import { hojeEmBrasilia } from "@/lib/checkin";
import { anexoDaMensagem, type AnexoNaBolha } from "@/lib/messages/anexo-tela";

export interface ChatMessage {
  id: string;
  from: "me" | "them";
  text: string;
  /** Prompt 17: mensagem que é o cartão de uma proposta (link para /dashboard/propostas/<id>). */
  propostaId?: string;
  /** E445 (item 4): mensagem minha já lida pelo destinatário ("visto"). */
  visto?: boolean;
  /** E445 (item 5): foto ou PDF anexado (abre só pela rota do servidor, URL assinada para as partes). */
  anexo?: AnexoNaBolha;
  /** E484: quando a mensagem foi enviada (ISO), para a hora na bolha. */
  enviadaEm?: string;
}

export interface Conversation {
  id: string;
  name: string;
  property: string;
  preview: string;
  otherId?: string;
  propertyId?: string;
  /** Chips da caixa (UX6-b, Prompt 32): como proprietário, como morador, parceiros ou falar com a Viva. */
  papel?: PapelConversa;
  /** Contrato entre as duas partes desta conversa, no imóvel (link "Abrir a página da estadia"). */
  contratoId?: string;
  /** Foto de capa do imóvel e período da estadia (quando há contrato). */
  foto?: string;
  periodo?: string;
  /** E664: contrato do morador (eu) com a entrada HOJE, ativo e assinado pelas duas partes — habilita o botão de emergência. */
  emergenciaChegadaContratoId?: string;
  /** Contrato ASSINADO pelas duas partes desta conversa (o alerta antigolpe só vale antes disso). */
  contratoFechado?: boolean;
  /** Conversa de pedido de serviço de parceiro (Prompt 31b): a resposta vai pela rota do pedido. */
  pedidoParceiroId?: string;
  /** 63-B: a outra parte tem o selo "LinkedIn conectado" (só o sim). */
  linkedinConectado?: boolean;
  /** E174-B: domínio do vínculo profissional confirmado da outra parte (só o domínio). */
  vinculoDominio?: string | null;
  /** E445 (item 4): mensagens recebidas ainda não lidas nesta conversa. */
  naoLidas?: number;
  /** E721: a pessoa adiou esta conversa (ISO). Só a visão dela; vence em `adiadaAte` ou quando a outra parte escreve. */
  adiadaEm?: string | null;
  adiadaAte?: string | null;
  messages: ChatMessage[];
}

/** Conversas de exemplo (fallback do modo demonstração). */
export const SAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "Ana Carvalho",
    property: "Apto Santa Mônica",
    // Varredura 01/11: as conversas de exemplo têm o papel (interessados escrevendo ao proprietário) — sem ele, "Todas 2"
    // aparecia com "Como proprietário 0" e "Como morador 0".
    papel: "proprietario",
    preview: "O imóvel está disponível em agosto?",
    messages: [
      { id: "a1", from: "them", text: "Olá! O imóvel está disponível a partir de agosto?" },
      { id: "a2", from: "me", text: "Olá, Ana! Sim, disponível a partir de 1º de agosto." },
      { id: "a3", from: "them", text: "Ótimo. Tem home office? Trabalho remoto." },
    ],
  },
  {
    id: "2",
    name: "Rafael Lima",
    property: "Studio Centro",
    papel: "proprietario",
    preview: "Posso agendar uma visita?",
    messages: [{ id: "b1", from: "them", text: "Bom dia! Posso agendar uma visita esta semana?" }],
  },
];

interface MsgRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  property_id: string | null;
  body: string;
  created_at: string;
  proposta_id?: string | null;
  parceiro_pedido_id?: string | null;
  /** E445 (0287): quando o destinatário leu. Ausente antes da migração. */
  lido_em?: string | null;
  property: { title: string | null; owner_id: string | null } | null;
}

/**
 * Lista as conversas do usuário logado. Modo demonstração (sem Supabase) mostra
 * exemplos; modo REAL nunca inventa conversas — sem sessão, erro ou banco vazio
 * devolve lista vazia (a página mostra o estado "sem mensagens").
 */
const MSG_MENSAGENS_NAO_CARREGARAM = "Não foi possível carregar as suas mensagens agora.";

/**
 * Auditoria de erros e estados vazios, achado nº 5: com `exigir` (a tela Mensagens), uma falha do banco LANÇA (o painel
 * mostra "Não conseguimos abrir esta tela" com "Tentar de novo") em vez de mostrar "nenhuma conversa". A home, que só
 * conta, segue sem `exigir` (e com .catch).
 */
export async function listConversations(opcoes: { exigir?: boolean } = {}): Promise<Conversation[]> {
  const supabase = await createClient();
  if (!supabase) return SAMPLE_CONVERSATIONS;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const colunas = (comLeitura: boolean) =>
    `id, conversation_id, sender_id, receiver_id, property_id, body, created_at, proposta_id, parceiro_pedido_id,${comLeitura ? " lido_em," : ""}
       property:properties!messages_property_id_fkey ( title, owner_id )`;
  const ler = (comLeitura: boolean) =>
    supabase.from("messages").select(colunas(comLeitura)).or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order("created_at", { ascending: true });
  let { data, error } = await ler(true);
  // E445: antes da 0287 (sem a coluna lido_em), lê como antes — a lista nunca some por causa do "visto".
  if (error && (error.code === "42703" || /lido_em/.test(error.message))) ({ data, error } = await ler(false));
  if (error && opcoes.exigir) throw new Error(MSG_MENSAGENS_NAO_CARREGARAM);

  const byConv = new Map<string, Conversation>();
  // Erro na leitura das mensagens: a lista segue só com as conversas de contrato (nunca inventa conversa).
  for (const m of (error || !data ? [] : data) as unknown as MsgRow[]) {
    const mine = m.sender_id === user.id;
    const otherId = mine ? m.receiver_id : m.sender_id;
    if (!byConv.has(m.conversation_id)) {
      byConv.set(m.conversation_id, {
        id: m.conversation_id,
        name: "Conversa",
        property: m.property?.title ?? "",
        preview: "",
        otherId,
        propertyId: m.property_id ?? undefined,
        papel: papelDaConversa(
          { propertyId: m.property_id ?? undefined, donoDoImovelId: m.property?.owner_id ?? undefined, pedidoParceiroId: m.parceiro_pedido_id },
          user.id
        ),
        ...(m.parceiro_pedido_id ? { pedidoParceiroId: m.parceiro_pedido_id, property: "Pedido de serviço" } : {}),
        messages: [],
      });
    }
    const conv = byConv.get(m.conversation_id)!;
    // Mesmo filtro do envio: mensagem antiga com CPF/RG ou contato nunca aparece crua (nem na prévia da caixa).
    const texto = guardContactInfo(m.body).text;
    conv.messages.push({ id: m.id, from: mine ? "me" : "them", text: texto, enviadaEm: m.created_at, ...(m.proposta_id ? { propostaId: m.proposta_id } : {}), ...(mine && m.lido_em ? { visto: true } : {}) });
    // E445: não lidas da conversa (recebidas sem lido_em; sem a coluna, não conta).
    if (!mine && m.lido_em === null) conv.naoLidas = (conv.naoLidas ?? 0) + 1;
    conv.preview = texto;
  }

  // E445 item 5: os anexos das minhas conversas (RLS "anexos das partes" — só remetente e destinatário). Antes da 0288
  // ou com falha, as mensagens seguem só com o texto ("Anexo: foto enviada").
  if (byConv.size > 0) {
    const { data: anexos } = await supabase
      .from("mensagens_anexos")
      .select("id, message_id, mime")
      .in("conversation_id", [...byConv.keys()]);
    const porMensagem = anexoDaMensagem((anexos ?? []) as { id: string; message_id: string; mime: string }[]);
    if (porMensagem.size > 0)
      for (const c of byConv.values()) for (const m of c.messages) if (porMensagem.has(m.id)) m.anexo = porMensagem.get(m.id);
  }

  // E200: a conversa de cada contrato em que sou parte entra na lista desde a criação, mesmo sem mensagem (antes só
  // aparecia pelo link da estadia, com "Morador" no lugar do nome). Vem antes dos nomes: recebe o nome como as outras.
  const semMensagem = conversasDeContratos([...byConv.keys()], await contratosDaPessoa(supabase, user.id), user.id, conversationId);
  const doContrato: Conversation[] = semMensagem.map((n) => ({
    id: n.id,
    name: "Conversa",
    property: n.contrato.titulo,
    preview: "",
    otherId: n.outroId,
    propertyId: n.contrato.propertyId,
    papel: n.papel,
    contratoId: n.contrato.id,
    messages: [],
  }));

  // E569: a conversa de cada CANDIDATURA em andamento (nova ou aceita) também entra, mesmo sem mensagem — o "Responder
  // pela plataforma" do cartão do interessado abre exatamente ela (antes, candidatura sem mensagem caía em "não está na
  // sua lista"). Mesma regra de id das conversas (morador + dono + imóvel); a que já existe não duplica.
  const daCandidatura: Conversation[] = conversasDeContratos(
    [...byConv.keys(), ...doContrato.map((c) => c.id)],
    await candidaturasDaPessoa(supabase, user.id),
    user.id,
    conversationId,
  ).map((n) => ({
    id: n.id,
    name: "Conversa",
    property: n.contrato.titulo,
    preview: "",
    otherId: n.outroId,
    propertyId: n.contrato.propertyId,
    papel: n.papel,
    messages: [],
  }));

  // Nome do outro lado (prompt 6, mesma regra do cartão do candidato): o proprietário vê
  // "Candidato(a)" até aceitar e o nome completo depois (E427); o inquilino vê o nome curto do
  // proprietário até o aceite e o nome completo depois. Nome completo e aceite vêm do servidor (service role); sem ele, o
  // proprietário continua vendo "Candidato(a)". Suporte segue com o primeiro nome (RPC 0057).
  const conversas = [...doContrato, ...daCandidatura, ...byConv.values()];
  const outros = [...new Set(conversas.map((c) => c.otherId).filter(Boolean))] as string[];
  if (outros.length > 0) {
    const { data: nomes } = await supabase.rpc("primeiros_nomes", { ids: outros });
    const primeiro = new Map(
      ((nomes ?? []) as { id: string; primeiro_nome: string | null }[]).map((n) => [n.id, n.primeiro_nome])
    );
    const completo = new Map<string, string | null>();
    const aceito = new Map<string, boolean>();
    const aceitoPeloDono = new Map<string, boolean>();
    const admin = createAdminClient();
    if (admin) {
      const { data: perfis } = await admin.from("profiles").select("id, full_name").in("id", outros);
      for (const p of (perfis ?? []) as { id: string; full_name: string | null }[]) completo.set(p.id, p.full_name);
      const comLinkedin = await linkedinConectados(outros, admin);
      for (const c of conversas) if (c.otherId && comLinkedin.has(c.otherId)) c.linkedinConectado = true;
      const comVinculo = await vinculosConfirmados(outros, admin);
      for (const c of conversas) if (c.otherId && comVinculo.has(c.otherId)) c.vinculoDominio = comVinculo.get(c.otherId)!;
      const candidatos = [...new Set(conversas.filter((c) => c.papel === "proprietario" && c.otherId).map((c) => c.otherId!))];
      await Promise.all(candidatos.map(async (id) => aceito.set(id, await relacaoAceitaEntreServidor(user.id, id))));
      // E427: o morador vê o nome completo do proprietário depois do aceite (antes, o nome curto público).
      const donos = [...new Set(conversas.filter((c) => c.papel === "inquilino" && c.otherId).map((c) => c.otherId!))];
      await Promise.all(donos.map(async (id) => aceitoPeloDono.set(id, await relacaoAceitaEntreServidor(id, user.id))));
    }
    for (const conv of conversas) {
      const id = conv.otherId ?? "";
      conv.name = nomeNaConversa({
        // Conversa de pedido de serviço (Parceiros): o nome curto da outra parte, como na conversa do morador.
        papel: conv.papel === "parceiros" ? "inquilino" : (conv.papel ?? "suporte"),
        nomeCompleto: completo.get(id) ?? null,
        aceito: conv.papel === "inquilino" ? aceitoPeloDono.get(id) === true : aceito.get(id) === true,
        primeiroNome: primeiro.get(id) ?? null,
      });
    }
  }
  await enriquecer(supabase, conversas, user.id);
  // E721: as conversas que a pessoa adiou (RLS 0336: só as próprias). Antes da migração ou com falha, nada é adiado.
  const { data: adiadas } = await supabase.from("conversas_adiadas").select("conversation_id, adiada_em, ate").eq("user_id", user.id);
  for (const a of (adiadas ?? []) as { conversation_id: string; adiada_em: string; ate: string }[]) {
    const conv = conversas.find((c) => c.id === a.conversation_id);
    if (conv) Object.assign(conv, { adiadaEm: a.adiada_em, adiadaAte: a.ate });
  }
  // E481: a conversa com a mensagem mais recente primeiro (antes: contrato, candidatura e a ordem da 1ª mensagem).
  return ordenarPorAtividade(conversas);
}

type Supa = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/**
 * Foto de capa (do imóvel; na conversa de pedido, a do parceiro), datas do contrato entre as DUAS partes da conversa
 * ("13/11 – 15/02") e o id dele para o link da página da estadia. Best-effort: se falhar, a conversa fica sem eles.
 */
async function enriquecer(supabase: Supa, conversas: Conversation[], eu: string) {
  const ids = [...new Set(conversas.map((c) => c.propertyId).filter(Boolean))] as string[];
  const pedidos = [...new Set(conversas.map((c) => c.pedidoParceiroId).filter(Boolean))] as string[];
  try {
    const [{ data: fotos }, { data: contratos }, { data: parceiros }] = await Promise.all([
      ids.length
        ? supabase.from("property_photos").select("property_id, url, sort_order").in("property_id", ids).order("sort_order")
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase
            .from("contratos")
            .select("id, property_id, tenant_id, status, created_at, assinado_proprietario_em, assinado_inquilino_em, contrato_blocos(inicio, fim)")
            .in("property_id", ids)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      pedidos.length
        ? supabase.from("parceiro_pedidos").select("id, parceiro:parceiros(avatar_path)").in("id", pedidos)
        : Promise.resolve({ data: [] }),
    ]);
    const capa = new Map<string, string>();
    for (const f of (fotos ?? []) as { property_id: string; url: string }[]) {
      if (!capa.has(f.property_id)) capa.set(f.property_id, f.url);
    }
    const fotoParceiro = new Map<string, string>();
    for (const p of (parceiros ?? []) as unknown as { id: string; parceiro: { avatar_path: string | null } | null }[]) {
      const url = urlMidiaParceiro(p.parceiro?.avatar_path ?? null);
      if (url) fotoParceiro.set(p.id, url);
    }
    type LinhaContrato = ContratoParaAlerta & { id: string; contrato_blocos: { inicio: string; fim: string }[] | null };
    const lista = (contratos ?? []) as unknown as LinhaContrato[];
    for (const c of conversas) {
      if (c.pedidoParceiroId) {
        c.foto = fotoParceiro.get(c.pedidoParceiroId) ?? (c.propertyId ? capa.get(c.propertyId) : undefined);
        continue;
      }
      if (!c.propertyId) continue;
      c.foto = capa.get(c.propertyId);
      // O contrato desta conversa: no imóvel, com o morador sendo eu ou a outra parte (o mais recente).
      const doPar = lista.find((ct) => ct.property_id === c.propertyId && (ct.tenant_id === eu || ct.tenant_id === c.otherId));
      const bl = doPar?.contrato_blocos ?? [];
      c.periodo = bl.length ? formatarPeriodo(bl.map((b) => b.inicio).sort()[0], bl.map((b) => b.fim).sort().at(-1)) || undefined : undefined;
      if (doPar) c.contratoId = doPar.id;
      if (doPar && emergenciaDisponivel({
        souMorador: doPar.tenant_id === eu,
        status: (doPar as unknown as { status?: string }).status,
        assinadoPelasDuas: !!doPar.assinado_proprietario_em && !!doPar.assinado_inquilino_em,
        entrada: bl.map((b) => b.inicio).sort()[0],
        hoje: hojeEmBrasilia(new Date()),
      })) c.emergenciaChegadaContratoId = doPar.id;
      c.contratoFechado = contratoAssinadoEntrePartes(lista, { propertyId: c.propertyId, eu, outroId: c.otherId });
    }
  } catch {
    /* sem foto/período: a conversa continua utilizável */
  }
}

/**
 * E200: os contratos em que a pessoa é parte (morador ou dono do imóvel), para a conversa de cada um estar na lista
 * mesmo sem mensagem. A leitura vai pela sessão (RLS); nada de cliente de serviço. Best-effort: falhou, lista sem elas.
 */
/**
 * E569: candidaturas em andamento (nova ou aceita) em que sou o dono ou o morador, no formato das conversas de contrato
 * (o id da candidatura vai em `id`; a conversa NÃO leva contratoId). Falha: nenhuma (a lista segue com as outras).
 */
async function candidaturasDaPessoa(supabase: Supa, userId: string): Promise<ContratoParaConversa[]> {
  try {
    const { data } = await supabase
      .from("leads")
      .select("id, owner_id, tenant_id, property_id, property:properties ( title )")
      .or(`owner_id.eq.${userId},tenant_id.eq.${userId}`)
      .in("status", ["new", "accepted"])
      .order("created_at", { ascending: false })
      .limit(200);
    type Linha = { id: string; owner_id: string; tenant_id: string; property_id: string | null; property: { title: string | null } | null };
    return ((data ?? []) as unknown as Linha[])
      .filter((l) => !!l.property_id && !!l.owner_id && !!l.tenant_id)
      .map((l) => ({ id: l.id, tenantId: l.tenant_id, ownerId: l.owner_id, propertyId: l.property_id as string, titulo: l.property?.title ?? "Imóvel" }));
  } catch {
    return [];
  }
}

async function contratosDaPessoa(supabase: Supa, userId: string): Promise<ContratoParaConversa[]> {
  try {
    const colunas = "id, tenant_id, property_id, properties ( title, owner_id )";
    const { data: meus } = await supabase.from("properties").select("id").eq("owner_id", userId);
    const idsImoveis = ((meus ?? []) as { id: string }[]).map((p) => p.id);
    const [{ data: comoMorador }, { data: comoDono }] = await Promise.all([
      supabase.from("contratos").select(colunas).eq("tenant_id", userId).order("created_at", { ascending: false }),
      idsImoveis.length
        ? supabase.from("contratos").select(colunas).in("property_id", idsImoveis).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    type Linha = { id: string; tenant_id: string; property_id: string; properties: { title: string | null; owner_id: string } | null };
    const vistos = new Set<string>();
    const contratos: ContratoParaConversa[] = [];
    for (const c of [...((comoMorador ?? []) as unknown as Linha[]), ...((comoDono ?? []) as unknown as Linha[])]) {
      if (vistos.has(c.id) || !c.properties?.owner_id) continue;
      vistos.add(c.id);
      contratos.push({ id: c.id, tenantId: c.tenant_id, ownerId: c.properties.owner_id, propertyId: c.property_id, titulo: c.properties.title ?? "Imóvel" });
    }
    return contratos;
  } catch {
    return [];
  }
}
