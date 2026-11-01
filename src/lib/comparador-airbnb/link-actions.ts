"use server";

/*
  E399-C, pacote 1 — o link do anúncio no Airbnb, no servidor. O dono cola o link; aqui sai SÓ o número do anúncio
  (lerLinkAirbnb) e ele vai para a tabela fechada preco_justo_airbnb (0279), depois de conferir que quem pede é o dono.
  Em seguida roda a trava antifraude (cidade e quartos) pela fonte em uso — hoje a simulada, sem rede.
  Com a chave PRECO_JUSTO_COMPARADOR desligada, nada é lido nem gravado.
*/
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRECO_JUSTO_COMPARADOR } from "@/lib/flags";
import { lerLinkAirbnb } from "@/lib/comparador-airbnb/link-airbnb";
import { conferirAnuncio, type Conferencia, type Divergencia } from "@/lib/comparador-airbnb/antifraude";
import { fonteAtual } from "@/lib/comparador-airbnb/fonte";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRO = "Não foi possível salvar o link agora. Tente de novo.";

export interface MeuLinkAirbnb {
  /** Número do anúncio guardado (o dono vê o próprio; nunca vai a público). */
  airbnbId: string | null;
  conferencia: Conferencia | null;
  divergencias: Divergencia[];
}

type Resultado = { ok: true; link: MeuLinkAirbnb } | { ok: false; erro: string };

/** O imóvel do dono logado (cidade e quartos para a conferência); null se não for dele. */
async function imovelDoDono(propertyId: string) {
  if (!UUID_RE.test(String(propertyId ?? ""))) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await admin.from("properties").select("id, city, bedrooms").eq("id", propertyId).eq("owner_id", user.id).maybeSingle();
  if (error) throw new Error(ERRO);
  return data ? { admin, imovel: data as { id: string; city: string | null; bedrooms: number | null } } : null;
}

export async function meuLinkAirbnb(propertyId: string): Promise<MeuLinkAirbnb | null> {
  if (!PRECO_JUSTO_COMPARADOR) return null;
  const dono = await imovelDoDono(propertyId);
  if (!dono) return null;
  const { data, error } = await dono.admin.from("preco_justo_airbnb").select("airbnb_id, conferencia, divergencias").eq("property_id", propertyId).maybeSingle();
  if (error) throw new Error("Não foi possível ler o link do Airbnb.");
  return {
    airbnbId: (data?.airbnb_id as string | undefined) ?? null,
    conferencia: (data?.conferencia as Conferencia | undefined) ?? null,
    divergencias: ((data?.divergencias as Divergencia[] | null) ?? []).filter((d) => d === "cidade" || d === "quartos"),
  };
}

/** Salva (ou tira, com texto vazio) o link do anúncio no Airbnb e roda a conferência antifraude. */
export async function salvarLinkAirbnb(propertyId: string, texto: string): Promise<Resultado> {
  if (!PRECO_JUSTO_COMPARADOR) return { ok: false, erro: "Recurso ainda não disponível." };
  const link = lerLinkAirbnb(String(texto ?? "").slice(0, 500));
  const dono = await imovelDoDono(propertyId).catch(() => null);
  if (!dono) return { ok: false, erro: ERRO };
  const { admin, imovel } = dono;
  if (!link.ok && link.vazio) {
    const { error } = await admin.from("preco_justo_airbnb").delete().eq("property_id", propertyId);
    if (error) return { ok: false, erro: ERRO };
    return { ok: true, link: { airbnbId: null, conferencia: null, divergencias: [] } };
  }
  if (!link.ok) return { ok: false, erro: link.erro };

  const fonte = fonteAtual();
  const referencia = { cidade: imovel.city, quartos: imovel.bedrooms };
  const conf = await fonte
    .detalhesDoAnuncio(link.id, referencia)
    .then((d) => conferirAnuncio(referencia, d))
    .catch(() => null);
  const agora = new Date().toISOString();
  const conferencia: Conferencia = conf ? (conf.confere ? "confere" : "diverge") : "pendente";
  const divergencias = conf?.divergencias ?? [];
  const { error } = await admin.from("preco_justo_airbnb").upsert(
    {
      property_id: propertyId,
      airbnb_id: link.id,
      informado_em: agora,
      conferencia,
      divergencias,
      conferido_em: conf ? agora : null,
      fonte: fonte.nome,
      atualizado_em: agora,
    },
    { onConflict: "property_id" },
  );
  if (error) return { ok: false, erro: ERRO };
  return { ok: true, link: { airbnbId: link.id, conferencia, divergencias } };
}
