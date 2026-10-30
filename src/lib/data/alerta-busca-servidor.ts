/**
 * Alerta de busca salva (ordem cb9a09e9) — SERVER-ONLY (sem "use server": é
 * chamado pelas ações de publicar e pelo cron diário).
 *
 *  • Imóvel PUBLICADO → compara com as buscas salvas (alerta ligado) e registra
 *    o par busca×imóvel em `alertas_busca_envios` (chave única: não repete).
 *  • E264-B: o e-mail é o dos proativos — cartão do imóvel, UM por pessoa e imóvel (duas buscas que acham o mesmo
 *    imóvel dão um cartão só), no máximo 1 e-mail de sugestões por dia e 3 por semana por pessoa; o que não cabe
 *    sai agrupado no próximo envio. Respeita notif_email, conta pausada, `alerta_ativo` e a categoria desligada.
 *  • Sem dado do proprietário no e-mail; só bairro e cidade (região aproximada).
 */
import { chaveDoDestino, destinoDaUrl, type DestinoBusca } from "@/lib/busca/destino-busca";
import { resolverDestino, temposAte } from "@/lib/data/tempos";
import type { ModoRota } from "@/lib/rotas/tempo";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProperty } from "@/lib/data/properties";
import { despacharProativos, despacharTodosProativos, enfileirarProativo } from "@/lib/notifications/proativos-servidor";
import { imovelBateComBusca, type MinutosAte } from "@/lib/busca/alerta-busca";

interface BuscaLinha {
  id: string;
  usuario_id: string;
  parametros: string;
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
  const pessoas = new Set<string>();
  for (const busca of combinam) {
    try {
      // Chave única (busca, imóvel): reenviar a publicação não duplica o aviso.
      const { error } = await admin.from("alertas_busca_envios").insert({ busca_id: busca.id, imovel_id: imovelId });
      if (error) continue;
      // A fila é por (pessoa, imóvel): duas buscas da mesma pessoa que acham este imóvel dão um cartão só.
      await enfileirarProativo(admin, { usuarioId: busca.usuario_id, evento: "saved_search_match", refId: imovelId, extra: { busca_id: busca.id } });
      pessoas.add(busca.usuario_id);
    } catch (e) {
      console.error("[avisarBuscasDoImovel] falha:", e);
    }
  }
  let enviados = 0;
  for (const u of pessoas) if ((await despacharProativos(admin, u)) === "enviado") enviados++;
  return { combinam: combinam.length, enviados };
}

/**
 * Disparo diário (cron): o que ficou pendente em alertas_busca_envios (inclusive o de antes da fila) entra na fila dos
 * proativos, e a fila é despachada — um e-mail no máximo por pessoa, agrupado, dentro do teto.
 */
export async function enviarResumosAlertaBusca(): Promise<{ buscas: number; enviados: number }> {
  const admin = createAdminClient();
  if (!admin) return { buscas: 0, enviados: 0 };
  const { data: linhas } = await admin.from("alertas_busca_envios").select("busca_id, imovel_id").is("enviado_em", null).limit(1000);
  const pend = (linhas ?? []) as { busca_id: string; imovel_id: string }[];
  const ids = [...new Set(pend.map((l) => l.busca_id))];
  if (ids.length) {
    const { data: bs } = await admin.from("buscas_salvas").select("id, usuario_id, alerta_ativo").in("id", ids);
    const busca = new Map(((bs ?? []) as { id: string; usuario_id: string; alerta_ativo: boolean | null }[]).map((b) => [b.id, b]));
    for (const l of pend) {
      const b = busca.get(l.busca_id);
      if (!b || b.alerta_ativo === false) {
        // Alerta desligado depois: a pendência vira "descartada" (enviado_em preenchido) para não acumular.
        await admin.from("alertas_busca_envios").update({ enviado_em: new Date().toISOString() }).eq("busca_id", l.busca_id).eq("imovel_id", l.imovel_id).is("enviado_em", null);
        continue;
      }
      await enfileirarProativo(admin, { usuarioId: b.usuario_id, evento: "saved_search_match", refId: l.imovel_id, extra: { busca_id: l.busca_id } });
    }
  }
  const r = await despacharTodosProativos();
  return { buscas: ids.length, enviados: r.enviados };
}
