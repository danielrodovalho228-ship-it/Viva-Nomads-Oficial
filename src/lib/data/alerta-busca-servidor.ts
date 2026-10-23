/**
 * Alerta de busca salva (ordem cb9a09e9) — SERVER-ONLY (sem "use server": é
 * chamado pelas ações de publicar e pelo cron diário).
 *
 *  • Imóvel PUBLICADO → compara com as buscas salvas (alerta ligado) e registra
 *    o par busca×imóvel em `alertas_busca_envios` (chave única: não repete).
 *  • No máximo 1 e-mail por busca por dia (`consumirLimite`): o primeiro sai
 *    na hora; o que chegar depois fica pendente e vai no resumo do cron.
 *  • Respeita `profiles.notif_email` e `buscas_salvas.alerta_ativo`.
 *  • Sem dado do proprietário no e-mail; só cidade/bairro (região aproximada).
 */
import { totalMesDaLinha } from "@/lib/precos";
import { chaveDoDestino, destinoDaUrl, type DestinoBusca } from "@/lib/busca/destino-busca";
import { resolverDestino, temposAte } from "@/lib/data/tempos";
import type { ModoRota } from "@/lib/rotas/tempo";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProperty } from "@/lib/data/properties";
import { recebeAvisoComum } from "@/lib/notifications/preferencias";
import { notify } from "@/lib/notifications";
import { consumirLimite, DIA } from "@/lib/limites";
import { SITE_URL } from "@/lib/site";
import {
  ALERTAS_POR_BUSCA_POR_DIA,
  assinarDesligarAlerta,
  imovelBateComBusca,
  type MinutosAte,
  montarAlerta,
  type ImovelNoAlerta,
} from "@/lib/busca/alerta-busca";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
interface BuscaLinha {
  id: string;
  usuario_id: string;
  parametros: string;
}

export function urlDesligarAlerta(buscaId: string): string | null {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return null;
  return `${SITE_URL}/alerta-busca/desligar?b=${encodeURIComponent(buscaId)}&t=${encodeURIComponent(assinarDesligarAlerta(buscaId, segredo))}`;
}

/** Envia o e-mail da busca com os imóveis pendentes (se o limite do dia deixar) e marca como enviados. */
async function enviarDaBusca(admin: Admin, busca: BuscaLinha, imoveis: ImovelNoAlerta[]): Promise<"enviado" | "limite" | "sem_email" | "vazio"> {
  if (imoveis.length === 0) return "vazio";
  const { data: perfil } = await admin.from("profiles").select("email, full_name, notif_email, pausada_em").eq("id", busca.usuario_id).maybeSingle();
  // Prompt 51 F1: conta pausada não recebe alerta de busca.
  if (!perfil?.email || !recebeAvisoComum(perfil as { notif_email: boolean | null; pausada_em: string | null })) {
    // Sem e-mail ou avisos desligados: não envia e descarta o pendente (não acumula nem reaparece depois).
    await admin.from("alertas_busca_envios").update({ enviado_em: new Date().toISOString() }).eq("busca_id", busca.id).is("enviado_em", null);
    return "sem_email";
  }
  if (!(await consumirLimite(`alerta-busca:${busca.id}`, ALERTAS_POR_BUSCA_POR_DIA, DIA))) return "limite";
  const msg = montarAlerta({
    buscaParametros: busca.parametros,
    imoveis,
    siteUrl: SITE_URL,
    desligarUrl: urlDesligarAlerta(busca.id),
    buscasUrl: `${SITE_URL}/dashboard/buscas`,
  });
  await notify({
    event: "saved_search_match",
    email: perfil.email as string,
    name: (perfil.full_name as string) ?? undefined,
    pushUrl: "/dashboard/buscas",
    subject: msg.subject,
    detailsHtml: msg.html,
    detailsText: msg.text,
  });
  await admin
    .from("alertas_busca_envios")
    .update({ enviado_em: new Date().toISOString() })
    .eq("busca_id", busca.id)
    .in("imovel_id", imoveis.map((i) => i.id))
    .is("enviado_em", null);
  return "enviado";
}

async function pendentes(admin: Admin, buscaId: string): Promise<ImovelNoAlerta[]> {
  const { data: envios } = await admin.from("alertas_busca_envios").select("imovel_id").eq("busca_id", buscaId).is("enviado_em", null).limit(50);
  const ids = (envios ?? []).map((e) => e.imovel_id as string);
  if (ids.length === 0) return [];
  const { data } = await admin
    .from("properties")
    .select("id, title, city, neighborhood, monthly_price, bedrooms, condo_fee, utilities_mode, utilities_estimate, min_period_days, available_from")
    .in("id", ids)
    .eq("status", "active");
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: (r.title as string) || "Imóvel mobiliado",
    city: (r.city as string) ?? "",
    neighborhood: (r.neighborhood as string) ?? "",
    monthlyPrice: Number(r.monthly_price) || 0,
    bedrooms: Number(r.bedrooms) || 0,
    totalMes: totalMesDaLinha(r),
    minPeriodDays: Number(r.min_period_days) || undefined,
    availableFrom: (r.available_from as string | null) ?? null,
  }));
}

/**
 * Prompt 37: tempos do imóvel até os DESTINOS CADASTRADOS das buscas salvas com "até N min" (calculados agora se
 * faltarem, com o ponto exato, no servidor). Devolve a consulta usada por imovelBateComBusca.
 */
async function minutosDoImovel(admin: NonNullable<ReturnType<typeof createAdminClient>>, imovelId: string, buscas: BuscaLinha[]): Promise<MinutosAte> {
  const tempos = new Map<string, number | null>();
  const chave = (d: DestinoBusca, modo: ModoRota) => `${chaveDoDestino(d)}|${modo}`;
  for (const b of buscas) {
    const e = destinoDaUrl(new URLSearchParams(b.parametros));
    // Só destino cadastrado: endereço digitado não tem alerta por tempo (nem cálculo por causa do alerta).
    if (!e.destino || !("slug" in e.destino) || !e.ate || tempos.has(chave(e.destino, e.modo))) continue;
    const destino = await resolverDestino({ destino: e.destino.slug }, admin);
    const r = destino ? await temposAte(destino, e.modo, { ids: [imovelId] }, admin) : null;
    tempos.set(chave(e.destino, e.modo), r?.itens[0]?.min ?? null);
  }
  return (d, modo) => tempos.get(chave(d, modo));
}

/** Imóvel acabou de ser PUBLICADO: registra e avisa as buscas salvas que ele atende. Best-effort. */
export async function avisarBuscasDoImovel(imovelId: string): Promise<{ combinam: number; enviados: number }> {
  const admin = createAdminClient();
  if (!admin) return { combinam: 0, enviados: 0 };
  const imovel = await getProperty(imovelId);
  if (!imovel || imovel.status !== "active") return { combinam: 0, enviados: 0 };
  const { data } = await admin.from("buscas_salvas").select("id, usuario_id, parametros").eq("alerta_ativo", true).limit(5000);
  const buscas = (data ?? []) as BuscaLinha[];
  const minutos = await minutosDoImovel(admin, imovelId, buscas);
  const combinam = buscas.filter(
    (b) => b.usuario_id !== imovel.ownerId && imovelBateComBusca(b.parametros, imovel, minutos)
  );
  let enviados = 0;
  for (const busca of combinam) {
    try {
      // Chave única (busca, imóvel): reenviar a publicação não duplica o aviso.
      const { error } = await admin.from("alertas_busca_envios").insert({ busca_id: busca.id, imovel_id: imovelId });
      if (error) continue;
      if ((await enviarDaBusca(admin, busca, await pendentes(admin, busca.id))) === "enviado") enviados++;
    } catch (e) {
      console.error("[avisarBuscasDoImovel] falha:", e);
    }
  }
  return { combinam: combinam.length, enviados };
}

/** Resumo diário (cron): uma mensagem por busca com o que ficou pendente além do limite de 1/dia. */
export async function enviarResumosAlertaBusca(): Promise<{ buscas: number; enviados: number }> {
  const admin = createAdminClient();
  if (!admin) return { buscas: 0, enviados: 0 };
  const { data: linhas } = await admin.from("alertas_busca_envios").select("busca_id").is("enviado_em", null).limit(1000);
  const ids = [...new Set((linhas ?? []).map((l) => l.busca_id as string))];
  let enviados = 0;
  for (const id of ids) {
    try {
      const { data: busca } = await admin.from("buscas_salvas").select("id, usuario_id, parametros, alerta_ativo").eq("id", id).maybeSingle();
      if (!busca || busca.alerta_ativo === false) {
        // Alerta desligado depois: pendências viram "descartadas" (enviado_em preenchido) para não acumular.
        await admin.from("alertas_busca_envios").update({ enviado_em: new Date().toISOString() }).eq("busca_id", id).is("enviado_em", null);
        continue;
      }
      if ((await enviarDaBusca(admin, busca as BuscaLinha, await pendentes(admin, id))) === "enviado") enviados++;
    } catch (e) {
      console.error("[enviarResumosAlertaBusca] falha:", e);
    }
  }
  return { buscas: ids.length, enviados };
}
