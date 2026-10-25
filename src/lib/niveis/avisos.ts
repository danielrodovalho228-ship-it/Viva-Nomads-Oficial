/*
  Adendo 59.1 — avisos do nível ao dono (matriz: conforto_pendencia, a mesma das pendências do padrão mínimo).
  Na hora: queda de nível (com o que corrigir) e foto de item recusada pelo atendimento (com o motivo). FOTO-NA-HORA-B:
  prova anterior à regra vencida (nivel_prova_vencida). Só do servidor.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { notificacaoLigada } from "@/lib/notifications/preferencias";
import { textoEmail } from "@/lib/notifications/texto-seguro";

type Db = SupabaseClient;

async function avisarDono(db: Db, propertyId: string, texto: (titulo: string) => string, cta: string, event: "conforto_pendencia" | "nivel_prova_vencida" = "conforto_pendencia"): Promise<void> {
  const { data: p } = await db.from("properties").select("owner_id, title").eq("id", propertyId).maybeSingle();
  if (!p?.owner_id) return;
  const { data: perfil } = await db.from("profiles").select("email, full_name, notif_email").eq("id", p.owner_id).maybeSingle();
  if (!perfil?.email || !notificacaoLigada(perfil.notif_email as boolean | null)) return;
  const titulo = textoEmail((p.title as string) ?? "seu anúncio", 80);
  await notify({
    event,
    email: perfil.email as string,
    name: (perfil.full_name as string) ?? undefined,
    userId: p.owner_id as string,
    pushUrl: `/dashboard/imoveis/${propertyId}/nivel`,
    body: (n) => `Olá${n ? " " + n : ""}, ${texto(titulo)}`,
    ctaLabel: cta,
  }).catch(() => null);
}

export async function avisarNivel(db: Db, propertyId: string, x: { de: string; para: string; corrigir: string[] }): Promise<void> {
  const lista = x.corrigir.slice(0, 6).map((c) => textoEmail(c, 60)).join(", ");
  await avisarDono(
    db,
    propertyId,
    (titulo) => `${titulo} passou de ${x.de} para ${x.para}.${lista ? ` Para voltar, corrija: ${lista}.` : ""} Mande uma foto nova do item corrigido.`,
    "Ver o nível do imóvel",
  );
}

export async function avisarFotoRecusada(db: Db, propertyId: string, item: string, motivo: string): Promise<void> {
  await avisarDono(
    db,
    propertyId,
    (titulo) => `a foto de "${textoEmail(item, 60)}" em ${titulo} não foi aceita: ${textoEmail(motivo, 200)}. Envie outra foto mostrando o item.`,
    "Enviar outra foto",
  );
}

/** FOTO-NA-HORA-B: a prova anterior à regra venceu sem foto da câmera; o item deixou de contar e o nível foi recalculado. */
export async function avisarProvaVencida(db: Db, propertyId: string, itens: string[]): Promise<void> {
  const lista = itens.slice(0, 6).map((c) => textoEmail(c, 60)).join(", ");
  await avisarDono(
    db,
    propertyId,
    (titulo) => `a foto de ${lista} em ${titulo} era anterior à regra e não foi refeita pela câmera no prazo. ${itens.length === 1 ? "O item deixou" : "Os itens deixaram"} de contar e o nível foi recalculado. Fotografe agora pela câmera para voltar a contar.`,
    "Fotografar agora",
    "nivel_prova_vencida",
  );
}
