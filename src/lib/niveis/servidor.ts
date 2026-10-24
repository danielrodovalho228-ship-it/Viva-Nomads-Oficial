import "server-only";
/*
  Adendo 59.1 — nível do imóvel no servidor: junta as entradas do banco, calcula pelo elo mais fraco (regras puras) e
  grava em imovel_nivel (a busca, a nota e a exibição leem daqui). Recalcula a cada mudança que importa: declaração
  ou foto de item, análise da foto, medição, ruído, pendência aberta/corrigida/decidida e confirmação do mínimo.
  Caiu de nível? O dono é avisado na hora, com o que corrigir. Nada financeiro (D7).
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHAVE_RUIDO_CONFERENCIA, ROTULO_AREA, ROTULO_NIVEL, ROTULO_RUIDO, ROTULO_RUIDO_CONFERENCIA, rotuloItem, type ClasseRuido, type NivelOuAdequacao } from "@/config/niveis";
import { classeRuido, itensDaConferencia, nivelDoImovel, pendenciaBloqueia, type EntradaNivel, type ItemDeclarado, type MedidaPonto, type ResultadoNivel, type RespostasRuido, type StatusFoto } from "./regras";
import { avisarNivel } from "./avisos";
import { validadeLaudo } from "@/lib/vistoria/laudo";
import { imovelComStrike } from "@/lib/vistoria/strikes";

type Admin = SupabaseClient;

const ORDEM: Record<NivelOuAdequacao, number> = { em_adequacao: -1, essencial: 0, conforto: 1, premium: 2 };

export async function entradaDoNivel(admin: Admin, propertyId: string, agora = new Date()): Promise<EntradaNivel> {
  const [decl, itens, medidas, ruido, pend] = await Promise.all([
    admin.from("conforto_declaracoes").select("chave, confirmado, versao_lista").eq("property_id", propertyId),
    admin.from("nivel_itens").select("chave, declarado, foto_path, foto_status, foto_origem, refazer_ate").eq("property_id", propertyId),
    admin
      .from("internet_medicoes")
      .select("ponto, validada, valido_ate, medido_em, download_mbps, upload_mbps, latencia_ms")
      .eq("property_id", propertyId)
      .eq("papel", "dono")
      .not("ponto", "is", null)
      .order("medido_em", { ascending: false })
      .limit(50),
    admin.from("imovel_ruido").select("via_intensa, noturno_obra_100m, aviao_ferrovia, isolamento_acustico").eq("property_id", propertyId).maybeSingle(),
    admin.from("conforto_pendencias").select("chave, status").eq("property_id", propertyId),
  ]);
  return {
    declaracoesConforto: (decl.data ?? []) as { chave: string; confirmado: boolean; versao_lista: number | null }[],
    itens: ((itens.data ?? []) as { chave: string; declarado: boolean; foto_path: string | null; foto_status: StatusFoto; foto_origem?: "camera" | "arquivo" | null; refazer_ate?: string | null }[]).map(
      (i): ItemDeclarado => ({ chave: i.chave, declarado: i.declarado, fotoPath: i.foto_path, fotoStatus: i.foto_status, fotoOrigem: i.foto_origem ?? null, refazerAte: i.refazer_ate ?? null }),
    ),
    medidas: ((medidas.data ?? []) as { ponto: MedidaPonto["ponto"]; validada: boolean; valido_ate: string; medido_em: string; download_mbps: number; upload_mbps: number; latencia_ms: number }[]).map(
      (m): MedidaPonto => ({ ponto: m.ponto, validada: m.validada, validoAte: m.valido_ate, medidoEm: m.medido_em, downloadMbps: Number(m.download_mbps), uploadMbps: Number(m.upload_mbps), latenciaMs: Number(m.latencia_ms) }),
    ),
    ruido: (ruido.data as RespostasRuido | null) ?? null,
    bloqueadas: ((pend.data ?? []) as { chave: string; status: string }[]).filter((p) => pendenciaBloqueia(p.status)).map((p) => p.chave),
    agora,
  };
}

export async function nivelGravado(admin: Admin, propertyId: string): Promise<NivelOuAdequacao | null> {
  const { data } = await admin.from("imovel_nivel").select("nivel").eq("property_id", propertyId).maybeSingle();
  return (data?.nivel as NivelOuAdequacao | undefined) ?? null;
}

/**
 * Recalcula e grava. Se o nível caiu, avisa o dono com as áreas que caíram e o que falta (o "o que corrigir").
 * Nunca lança: um erro aqui não pode quebrar a ação que o chamou.
 */
/**
 * Prompt 62-B2: o laudo de avaliação VÁLIDO (12 meses da emissão) prevalece sobre a autodeclaração e as fotos.
 * "· vistoriado" só com laudo aprovado (ou ressalva corrigida), dentro de 12 meses e sem strike no imóvel.
 */
export async function laudoQuePrevalece(admin: Admin, propertyId: string, agora = new Date()): Promise<{ nivel: NivelOuAdequacao; vistoriadoEm: string | null } | null> {
  const { data } = await admin
    .from("vistoria_laudos")
    .select("owner_id, nivel_sustentado, emitido_em, vistoriado_em")
    .eq("property_id", propertyId)
    .order("emitido_em", { ascending: false })
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  const l = data as { owner_id: string; nivel_sustentado: NivelOuAdequacao; emitido_em: string; vistoriado_em: string | null } | null;
  if (!l || agora >= validadeLaudo(l.emitido_em)) return null;
  let vistoriadoEm = l.vistoriado_em && agora < validadeLaudo(l.vistoriado_em) ? l.vistoriado_em : null;
  if (vistoriadoEm) {
    const { data: st } = await admin.from("proprietario_strikes").select("property_id, ordem, criado_em, suspenso_ate, expira_em").eq("property_id", propertyId);
    const strikes = ((st ?? []) as { property_id: string; ordem: 1 | 2 | 3; criado_em: string; suspenso_ate: string | null; expira_em: string }[]).map((x) => ({
      propertyId: x.property_id,
      ordem: x.ordem,
      criadoEm: x.criado_em,
      suspenso: x.suspenso_ate != null,
      expiraEm: x.expira_em,
    }));
    if (imovelComStrike(strikes, propertyId, agora)) vistoriadoEm = null;
  }
  return { nivel: l.nivel_sustentado, vistoriadoEm };
}

export async function recalcularNivel(admin: Admin, propertyId: string, agora = new Date()): Promise<{ antes: NivelOuAdequacao | null; resultado: ResultadoNivel } | null> {
  try {
    const entrada = await entradaDoNivel(admin, propertyId, agora);
    const calculado = nivelDoImovel(entrada);
    const laudo = await laudoQuePrevalece(admin, propertyId, agora);
    const resultado: ResultadoNivel = laudo ? { ...calculado, nivel: laudo.nivel } : calculado;
    const antes = await nivelGravado(admin, propertyId);
    const { error } = await admin.from("imovel_nivel").upsert(
      {
        property_id: propertyId,
        nivel: resultado.nivel,
        por_area: resultado.porArea,
        diferenciais: resultado.diferenciais,
        ruido_classe: entrada.ruido ? classeRuido(entrada.ruido) : null,
        calculado_em: agora.toISOString(),
        nivel_vistoriado_em: laudo?.vistoriadoEm ?? null,
      },
      { onConflict: "property_id" },
    );
    if (error) {
      console.error("[recalcularNivel]", error.code, error.message);
      return null;
    }
    if (antes && ORDEM[resultado.nivel] < ORDEM[antes] && resultado.nivel !== "em_adequacao") {
      const corrigir = entrada.bloqueadas.map(rotuloItem);
      const areas = Object.entries(resultado.faltaParaProximo)
        .filter(([a]) => ORDEM[resultado.porArea[a as keyof typeof resultado.porArea]] < ORDEM[antes])
        .map(([a]) => ROTULO_AREA[a as keyof typeof ROTULO_AREA]);
      await avisarNivel(admin, propertyId, {
        de: ROTULO_NIVEL[antes as keyof typeof ROTULO_NIVEL] ?? antes,
        para: ROTULO_NIVEL[resultado.nivel as keyof typeof ROTULO_NIVEL] ?? resultado.nivel,
        corrigir: corrigir.length ? corrigir : areas,
      }).catch(() => null);
    }
    return { antes, resultado };
  } catch (e) {
    console.error("[recalcularNivel]", e);
    return null;
  }
}

/** Prompt 62-B2: imóveis com "· vistoriado" vigente (laudo válido, sem strike) — um fato a mais na nota. */
export async function vistoriadosDosImoveis(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data } = await db.from("imovel_nivel").select("property_id").in("property_id", ids).not("nivel_vistoriado_em", "is", null);
  return new Set(((data ?? []) as { property_id: string }[]).map((r) => r.property_id));
}

/** Níveis gravados de vários imóveis (busca e nota). */
export async function niveisDosImoveis(db: SupabaseClient, ids: string[]): Promise<Map<string, NivelOuAdequacao>> {
  const m = new Map<string, NivelOuAdequacao>();
  if (!ids.length) return m;
  const { data } = await db.from("imovel_nivel").select("property_id, nivel").in("property_id", ids);
  for (const r of (data ?? []) as { property_id: string; nivel: NivelOuAdequacao }[]) m.set(r.property_id, r.nivel);
  return m;
}

/**
 * Itens a mais na seção "Padrão mínimo" da entrada: os que definem o nível ATUAL do imóvel (provados por foto) e, se o
 * dono respondeu o ruído, a pergunta "o ruído confere com o anunciado?". Mesma lista na tela e na validação.
 */
export async function adicionaisDaConferencia(admin: Admin, propertyId: string | null): Promise<{ chave: string; rotulo: string }[]> {
  if (!propertyId) return [];
  const [nivel, ruido] = await Promise.all([
    nivelGravado(admin, propertyId),
    admin.from("imovel_ruido").select("classe").eq("property_id", propertyId).maybeSingle(),
  ]);
  const itens = itensDaConferencia(nivel ?? "essencial").map((chave) => ({ chave: chave as string, rotulo: rotuloItem(chave) }));
  const classe = ruido.data?.classe as ClasseRuido | undefined;
  return classe ? [...itens, { chave: CHAVE_RUIDO_CONFERENCIA, rotulo: `${ROTULO_RUIDO_CONFERENCIA} (${ROTULO_RUIDO[classe]})` }] : itens;
}
