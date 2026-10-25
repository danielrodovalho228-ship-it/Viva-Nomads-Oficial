import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sinaisDosAnuncios } from "@/lib/data/ranking";
import { notaQualidade } from "@/lib/ranking/ordem";
import { nivelDoMeuImovel } from "@/lib/data/nivel-actions";
import { ROTULO_AREA, ROTULO_NIVEL, rotuloItem, type Area } from "@/config/niveis";
import {
  DIAS_PERIODO,
  acoesDaNota,
  contar,
  conversao,
  janelas,
  linhaDoTempo,
  medianaDoGrupo,
  metricas,
  parecidos,
  taxaResposta,
  type AcaoDaNota,
  type Evento,
  type Marca,
  type Metrica,
  type SemanaLinha,
} from "@/lib/anuncio/desempenho";

/*
  Prompt 54 — os dados do painel de desempenho (SERVER-ONLY). Só o dono do anúncio. Eventos (0067) lidos pelo serviço
  depois de conferir o dono; contas de teste e o próprio dono ficam fora da conta. Grupo de comparação só com imóveis
  publicados de contas reais.
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS = ["ver_anuncio", "favoritar", "enviar_candidatura"];

export interface PainelDesempenho {
  id: string;
  titulo: string;
  status: string;
  metricas: Metrica[];
  /** Quantos imóveis parecidos entraram na comparação (< 5 = sem comparação). */
  parecidos: number;
  linha: SemanaLinha[];
  acoes: AcaoDaNota[];
  /** O que falta para o próximo nível (59.1), por área — fato, sem número de ganho. */
  faltaNivel: { proximo: string | null; itens: string[] };
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Linha = { id: string; owner_id: string; title: string | null; status: string; city: string | null; address: string | null; bedrooms: number | null; lat: number | null; lng: number | null };

async function contasDeTeste(admin: Admin, ids: string[]): Promise<Set<string>> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return new Set();
  const { data } = await admin.from("profiles").select("id").in("id", unicos).eq("is_teste", true);
  return new Set(((data ?? []) as { id: string }[]).map((p) => p.id));
}

export async function painelDesempenho(propertyId: string, agora: Date = new Date()): Promise<PainelDesempenho | null> {
  if (!UUID.test(propertyId)) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: im } = await admin.from("properties").select("id, owner_id, title, status, city, address, bedrooms, lat, lng").eq("id", propertyId).maybeSingle();
  const alvo = im as Linha | null;
  if (!alvo || alvo.owner_id !== user.id) return null;

  const j = janelas(agora);
  const desde = new Date(j.anterior[0]).toISOString();
  const desdeLinha = new Date(agora.getTime() - 8 * 7 * 86_400_000).toISOString();
  const desdeMaisCedo = desde < desdeLinha ? desde : desdeLinha;

  const [{ data: evs }, { data: publicacoes }, { data: medicoes }, { data: nivelLinha }, sinais, nivel] = await Promise.all([
    admin.from("eventos").select("tipo, criado_em, usuario_id").eq("imovel_id", propertyId).in("tipo", TIPOS).gte("criado_em", desdeMaisCedo).limit(20000),
    admin.from("eventos").select("criado_em").eq("imovel_id", propertyId).eq("tipo", "publicar_anuncio").gte("criado_em", desdeLinha),
    admin.from("internet_medicoes").select("medido_em").eq("property_id", propertyId).gte("medido_em", desdeLinha),
    admin.from("imovel_nivel").select("nivel, calculado_em").eq("property_id", propertyId).maybeSingle(),
    sinaisDosAnuncios([propertyId], admin).catch(() => []),
    nivelDoMeuImovel(propertyId).catch(() => null),
  ]);
  const eventos = (evs ?? []) as Evento[];
  const fora = { donoId: user.id, contasTeste: await contasDeTeste(admin, eventos.map((e) => e.usuario_id ?? "")) };
  const atual = contar(eventos, j.atual, fora);
  const anterior = contar(eventos, j.anterior, fora);
  const s = sinais[0];
  const resposta = s ? taxaResposta(s.conversas, s.conversasRespondidas) : null;

  // Parecidos: publicados, mesma cidade e quartos, de contas reais; depois bairro ou 2 km (regra pura).
  let medianas: Partial<Record<Metrica["chave"], number | null>> = {};
  let nParecidos = 0;
  if (alvo.city) {
    const { data: candidatos } = await admin
      .from("properties")
      .select("id, owner_id, title, status, city, address, bedrooms, lat, lng")
      .eq("status", "active")
      .ilike("city", alvo.city)
      .eq("bedrooms", alvo.bedrooms ?? 0)
      .neq("id", propertyId)
      .limit(300);
    const linhas = (candidatos ?? []) as Linha[];
    const donosTeste = await contasDeTeste(admin, linhas.map((l) => l.owner_id));
    const conv = (l: Linha) => ({ id: l.id, cidade: l.city, bairro: l.address, quartos: l.bedrooms ?? 0, lat: l.lat, lng: l.lng });
    const grupo = parecidos(conv(alvo), linhas.filter((l) => !donosTeste.has(l.owner_id)).map((l) => ({ ...conv(l), dono: l.owner_id })));
    nParecidos = grupo.length;
    if (grupo.length) {
      const { data: evsGrupo } = await admin
        .from("eventos")
        .select("imovel_id, tipo, criado_em, usuario_id")
        .in("imovel_id", grupo.map((g) => g.id))
        .in("tipo", TIPOS)
        .gte("criado_em", new Date(j.atual[0]).toISOString())
        .limit(50000);
      const todos = (evsGrupo ?? []) as (Evento & { imovel_id: string })[];
      const testeGrupo = await contasDeTeste(admin, todos.map((e) => e.usuario_id ?? ""));
      const porImovel = grupo.map((g) => contar(todos.filter((e) => e.imovel_id === g.id), j.atual, { donoId: g.dono, contasTeste: testeGrupo }));
      medianas = {
        visualizacoes: medianaDoGrupo(porImovel.map((c) => c.visualizacoes)),
        favoritos: medianaDoGrupo(porImovel.map((c) => c.favoritos)),
        candidaturas: medianaDoGrupo(porImovel.map((c) => c.candidaturas)),
        conversao: medianaDoGrupo(porImovel.map((c) => conversao(c)).filter((v): v is number => v != null)),
      };
    }
  }

  const marcas: Marca[] = [
    ...((publicacoes ?? []) as { criado_em: string }[]).map((p) => ({ em: p.criado_em, texto: "Anúncio publicado" })),
    ...((medicoes ?? []) as { medido_em: string }[]).map((m) => ({ em: m.medido_em, texto: "Internet medida" })),
  ];
  const nl = nivelLinha as { nivel: string; calculado_em: string } | null;
  if (nl && nl.calculado_em >= desdeLinha) marcas.push({ em: nl.calculado_em, texto: `Nível: ${nl.nivel in ROTULO_NIVEL ? ROTULO_NIVEL[nl.nivel as keyof typeof ROTULO_NIVEL] : "em adequação"}` });

  const falta = nivel?.resultado.faltaParaProximo ?? {};
  const itens = (Object.entries(falta) as [Area, string[]][]).flatMap(([area, chaves]) => chaves.map((c) => `${ROTULO_AREA[area]}: ${rotuloItem(c)}`));
  const atualNivel = nivel?.resultado.nivel ?? null;
  const proximo = atualNivel === "premium" ? null : atualNivel === "conforto" ? "Premium" : atualNivel === "essencial" ? "Conforto" : "Essencial";

  return {
    id: alvo.id,
    titulo: alvo.title || "Anúncio",
    status: alvo.status,
    metricas: metricas({ atual, anterior, resposta, medianas }),
    parecidos: nParecidos,
    linha: linhaDoTempo(eventos, marcas, agora, fora),
    acoes: s ? acoesDaNota(notaQualidade(s, agora).motivos).slice(0, 5) : [],
    faltaNivel: { proximo: itens.length ? proximo : null, itens },
  };
}

export { DIAS_PERIODO };

/**
 * PROP-3 (E113): Visualizações do Início do dono = a soma, nos imóveis dele, da MESMA conta do painel de desempenho
 * (contar() na janela atual, sem o dono e sem contas de teste). Antes o Início mostrava "0" fixo.
 */
export async function visualizacoesDoDono(agora: Date = new Date()): Promise<number | null> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: ims } = await admin.from("properties").select("id").eq("owner_id", user.id);
  const ids = ((ims ?? []) as { id: string }[]).map((i) => i.id);
  if (!ids.length) return 0;
  const j = janelas(agora);
  const { data: evs } = await admin
    .from("eventos")
    .select("tipo, criado_em, usuario_id")
    .in("imovel_id", ids)
    .eq("tipo", "ver_anuncio")
    .gte("criado_em", new Date(j.atual[0]).toISOString())
    .limit(20000);
  const eventos = (evs ?? []) as Evento[];
  const fora = { donoId: user.id, contasTeste: await contasDeTeste(admin, eventos.map((e) => e.usuario_id ?? "")) };
  return contar(eventos, j.atual, fora).visualizacoes;
}
