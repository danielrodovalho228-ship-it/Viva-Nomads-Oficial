"use server";

/*
  DETECTA-B — ações do passo Comodidades (cadastro e edição): analisar as fotos novas da galeria, listar as sugestões,
  confirmar ou descartar. Chave DETECCAO_FOTOS_ATIVO desligada: devolve { ligada: false } ANTES de qualquer leitura,
  e nada sai para o modelo. Só fotos da galeria do anúncio (property_photos, pasta do dono).
  FOTO-NA-HORA-B: a foto da galeria NUNCA vira prova. Confirmar item de nível → a sugestão fica 'confirmada_sem_foto'
  ("Confirmada, falta a foto", não conta) e a tela abre a câmera do item; o item só conta quando a foto feita na hora
  chega por salvarItemNivel com o token (que fecha a sugestão como 'aceita'). Comodidade → a tela marca e o salvar do
  anúncio grava. Sugestão sozinha não conta.
*/
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { deteccaoAtiva } from "@/lib/fotos/deteccao-chave";
import { detectarNaFoto } from "@/lib/fotos/deteccao-modelo";
import { analisarFotosNovas } from "@/lib/fotos/deteccao-fluxo";
import {
  LIMITE_FOTOS_DIA_ANUNCIO,
  LIMITE_FOTOS_DIA_DONO,
  MODELO_DETECCAO,
  caminhoDaGaleria,
  chaveDeteccao,
  respostaLab,
  sugestoesParaConfirmar,
  type StatusSugestao,
  type SugestaoVisivel,
  type TipoDeteccao,
} from "@/lib/fotos/deteccao";
import { SUGESTAO_SEM_FOTO, provaAntigaVencida } from "@/lib/niveis/prova-camera";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "property-photos";

export interface SugestaoFoto {
  id: string;
  chave: string;
  tipo: TipoDeteccao;
  /** 'confirmada_sem_foto': o dono confirmou o item de nível; falta a foto da câmera (não conta). */
  status: StatusSugestao;
  rotulo: string;
  confianca: number;
  fotoUrl: string;
}

export interface EstadoDeteccao {
  ligada: boolean;
  sugestoes: SugestaoFoto[];
  /** Fotos da galeria com pessoa (não servem de prova). */
  comPessoa: number;
  restantes: number;
  limite: boolean;
}

export type ResultadoDeteccaoAcao = { ok: true; mensagem: string; comodidade?: string; /** Item de nível: a tela abre a câmera dele. */ fotografar?: string } | { ok: false; erro: string };

const DESLIGADA: EstadoDeteccao = { ligada: false, sugestoes: [], comPessoa: 0, restantes: 0, limite: false };

async function donoDoAnuncio(propertyId: string) {
  if (!UUID.test(propertyId ?? "")) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
  return data?.owner_id === user.id ? { uid: user.id, admin } : null;
}
type Dono = NonNullable<Awaited<ReturnType<typeof donoDoAnuncio>>>;

async function galeria(c: Dono, propertyId: string): Promise<string[]> {
  const { data } = await c.admin.from("property_photos").select("url").eq("property_id", propertyId).order("sort_order");
  return ((data ?? []) as { url: string }[]).map((f) => caminhoDaGaleria(f.url, c.uid)).filter((x): x is string => !!x);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function montar(c: Dono, propertyId: string): Promise<Omit<EstadoDeteccao, "restantes" | "limite">> {
  const [fotos, sug, itens, pessoas] = await Promise.all([
    galeria(c, propertyId),
    c.admin.from("deteccao_sugestoes").select("id, chave, tipo, confianca, status, caminho").eq("property_id", propertyId).in("status", ["sugerida", "confirmada_sem_foto"]),
    c.admin.from("nivel_itens").select("chave, declarado, foto_path, foto_status, foto_origem, refazer_ate").eq("property_id", propertyId),
    c.admin.from("deteccao_fotos_analises").select("caminho").eq("property_id", propertyId).eq("pessoa", true),
  ]);
  const naGaleria = new Set(fotos);
  const nivelComFoto = new Set(
    ((itens.data ?? []) as { chave: string; declarado: boolean; foto_path: string | null; foto_status: string | null; foto_origem: "camera" | "arquivo" | null; refazer_ate: string | null }[])
      .filter((i) => i.declarado && i.foto_path && i.foto_status !== "recusada" && !provaAntigaVencida({ fotoOrigem: i.foto_origem, refazerAte: i.refazer_ate }, new Date()))
      .map((i) => i.chave),
  );
  const todas: SugestaoVisivel[] = ((sug.data ?? []) as { id: string; chave: string; tipo: TipoDeteccao; confianca: number | string; status: StatusSugestao; caminho: string }[]).map(
    (s) => ({ ...s, confianca: Number(s.confianca) }),
  );
  const visiveis = sugestoesParaConfirmar(todas, { galeria: naGaleria, nivelComFoto, comodidadesMarcadas: new Set() });
  const comPessoa = new Set(((pessoas.data ?? []) as { caminho: string }[]).map((p) => p.caminho).filter((p) => naGaleria.has(p))).size;
  return {
    ligada: true,
    comPessoa,
    sugestoes: visiveis.map((s) => ({
      id: s.id,
      chave: s.chave,
      tipo: s.tipo,
      status: s.status,
      rotulo: chaveDeteccao(s.chave)?.rotulo ?? s.chave,
      confianca: s.confianca,
      fotoUrl: c.admin.storage.from(BUCKET).getPublicUrl(s.caminho).data.publicUrl,
    })),
  };
}

/** Ao entrar no passo Comodidades: analisa as fotos novas (no máximo uma rodada) e devolve as sugestões. */
export async function analisarFotosDoAnuncio(propertyId: string): Promise<EstadoDeteccao> {
  if (!(await deteccaoAtiva())) return DESLIGADA;
  const c = await donoDoAnuncio(propertyId);
  if (!c) return DESLIGADA;
  const simulado = integracoesSimuladas();
  let rodada = { restantes: 0, limite: false };
  try {
    rodada = await analisarFotosNovas({
      ligada: true,
      fotos: () => galeria(c, propertyId),
      analisadas: async () => {
        const { data } = await c.admin.from("deteccao_fotos_analises").select("caminho, foto_hash").eq("property_id", propertyId);
        const linhas = (data ?? []) as { caminho: string; foto_hash: string }[];
        return { caminhos: new Set(linhas.map((l) => l.caminho)), hashes: new Set(linhas.map((l) => l.foto_hash)) };
      },
      // Laboratório: nada sai do servidor; o "conteúdo" da foto é o próprio caminho (hash estável por foto).
      baixar: async (caminho) => {
        if (simulado) return new TextEncoder().encode(caminho);
        const { data } = await c.admin.storage.from(BUCKET).download(caminho);
        return data ? new Uint8Array(await data.arrayBuffer()) : null;
      },
      hash: sha256,
      limite: async () =>
        (await consumirLimite(`deteccao:anuncio:${propertyId}`, LIMITE_FOTOS_DIA_ANUNCIO, DIA)) &&
        (await consumirLimite(`deteccao:dono:${c.uid}`, LIMITE_FOTOS_DIA_DONO, DIA)),
      modelo: simulado
        ? async (_bytes, indice) => {
            await registrarSimulado("ia", { acao: "deteccao", indice });
            return respostaLab(indice);
          }
        : detectarNaFoto,
      gravar: async (a) => {
        const { error } = await c.admin
          .from("deteccao_fotos_analises")
          .upsert({ property_id: propertyId, caminho: a.caminho, foto_hash: a.hash, pessoa: a.pessoa, valida: a.valida, modelo: simulado ? "lab" : MODELO_DETECCAO }, { onConflict: "property_id,caminho", ignoreDuplicates: true });
        if (error) console.error("[deteccao] análise", error.code, error.message);
        if (!a.linhas.length) return;
        const agora = new Date().toISOString();
        const { error: e2 } = await c.admin.from("deteccao_sugestoes").upsert(
          a.linhas.map((l) => ({
            property_id: propertyId,
            caminho: a.caminho,
            foto_hash: a.hash,
            chave: l.chave,
            tipo: l.tipo,
            confianca: l.confianca,
            status: l.status,
            motivo: l.motivo,
            decidida_em: l.status === "sugerida" ? null : agora,
          })),
          { onConflict: "property_id,foto_hash,chave", ignoreDuplicates: true },
        );
        if (e2) console.error("[deteccao] sugestões", e2.code, e2.message);
      },
    });
  } catch (e) {
    // Nunca derruba a tela: sem análise nova, mostra o que já havia.
    console.error("[deteccao] rodada", e);
  }
  return { ...(await montar(c, propertyId)), restantes: rodada.restantes, limite: rodada.limite };
}

/** Só a lista (depois de confirmar ou descartar). */
export async function listarSugestoesFotos(propertyId: string): Promise<EstadoDeteccao> {
  if (!(await deteccaoAtiva())) return DESLIGADA;
  const c = await donoDoAnuncio(propertyId);
  if (!c) return DESLIGADA;
  return { ...(await montar(c, propertyId)), restantes: 0, limite: false };
}

async function sugestaoDoDono(id: string) {
  if (!UUID.test(id ?? "") || !(await deteccaoAtiva())) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("deteccao_sugestoes").select("id, property_id, caminho, chave, tipo, status").eq("id", id).maybeSingle();
  if (!data) return null;
  const c = await donoDoAnuncio(data.property_id as string);
  return c ? { c, s: data as { id: string; property_id: string; caminho: string; chave: string; tipo: TipoDeteccao; status: StatusSugestao } } : null;
}

/**
 * Confirmar. Item de nível: a foto da galeria NÃO vira prova — a sugestão fica "Confirmada, falta a foto" (não conta) e
 * a tela abre a câmera do item (no computador, o QR para o celular). Comodidade: volta para a tela marcar.
 */
export async function confirmarSugestaoFoto(id: string): Promise<ResultadoDeteccaoAcao> {
  const r = await sugestaoDoDono(id);
  if (!r) return { ok: false, erro: "Sem permissão." };
  const { c, s } = r;
  const def = chaveDeteccao(s.chave);
  if (!def) return { ok: false, erro: "Item inválido." };
  if (s.status === "descartada") return { ok: false, erro: "Esta sugestão já foi descartada." };
  if (s.tipo === "nivel") {
    if (s.status === "sugerida") {
      await c.admin.from("deteccao_sugestoes").update({ status: "confirmada_sem_foto", decidida_em: new Date().toISOString() }).eq("id", s.id).eq("status", "sugerida");
    }
    return { ok: true, mensagem: `${SUGESTAO_SEM_FOTO}: fotografe "${def.rotulo}" agora para o item contar.`, fotografar: s.chave };
  }
  if (s.status === "sugerida") {
    await c.admin.from("deteccao_sugestoes").update({ status: "aceita", decidida_em: new Date().toISOString() }).eq("id", s.id).eq("status", "sugerida");
  }
  return { ok: true, mensagem: `"${def.rotulo}" marcada nas comodidades; ela é gravada junto com o anúncio.`, comodidade: s.chave };
}

/** Descartar: some a sugestão (e as outras da mesma chave neste anúncio). Não mexe no nível nem nas comodidades. */
export async function descartarSugestaoFoto(id: string): Promise<ResultadoDeteccaoAcao> {
  const r = await sugestaoDoDono(id);
  if (!r) return { ok: false, erro: "Sem permissão." };
  const { c, s } = r;
  if (s.status === "aceita") return { ok: false, erro: "Esta sugestão já foi confirmada." };
  await c.admin
    .from("deteccao_sugestoes")
    .update({ status: "descartada", motivo: "dono", decidida_em: new Date().toISOString() })
    .eq("property_id", s.property_id)
    .eq("chave", s.chave)
    .in("status", ["sugerida", "confirmada_sem_foto"]);
  return { ok: true, mensagem: "Sugestão descartada." };
}
