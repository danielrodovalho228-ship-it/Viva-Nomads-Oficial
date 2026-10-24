/*
  Prompt 59, Parte B — avisos do prazo de solução da manutenção (matriz: manutencao_prazo). Só do servidor.
  Cada aviso fica no histórico da ordem (service_order_eventos, tipo "aviso", status_para = qual aviso): o cron não repete
  e o morador vê "o proprietário foi avisado em [hora]". Silêncio das 22h às 7h, exceto urgente (segurança).
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { notificacaoLigada } from "@/lib/notifications/preferencias";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { dataHoraBrasilia } from "@/config/atendimento";
import { estadoSolucao, type AvisoSolucao, type OrdemSolucao } from "@/lib/manutencao-solucao";

type Db = SupabaseClient;

const COLUNAS = "id, priority, status, opened_at, provisoria_em, solucao_marcada_em, resolved_at, solucao_confirmada_em, reaberta_em, tenant_id, owner_id, properties(title)";

async function perfil(db: Db, id: string) {
  const { data } = await db.from("profiles").select("email, full_name, notif_email").eq("id", id).maybeSingle();
  return data;
}

/** Avisa o dono (e, no vencido, o morador) e grava o aviso no histórico. Devolve se gravou. */
export async function avisarPrazoManutencao(db: Db, ordemId: string, tipo: AvisoSolucao, agora = new Date()): Promise<boolean> {
  const { data: o } = await db.from("service_orders").select(COLUNAS).eq("id", ordemId).maybeSingle();
  if (!o) return false;
  const ordem: OrdemSolucao = {
    priority: o.priority as OrdemSolucao["priority"],
    openedAt: o.opened_at as string,
    provisoriaEm: o.provisoria_em as string | null,
    solucaoMarcadaEm: o.solucao_marcada_em as string | null,
    resolvedAt: o.resolved_at as string | null,
    status: o.status as string,
  };
  const s = estadoSolucao(ordem, agora);
  const titulo = textoEmail((o.properties as unknown as { title?: string } | null)?.title ?? "seu imóvel", 80);
  const prov = s.provisoria && (s.provisoria.estado === "no_prazo" || s.provisoria.estado === "vencido") ? s.provisoria : null;
  const ate = prov ? `solução provisória até ${dataHoraBrasilia(prov.ate)} (horário de Brasília)` : s.texto;
  const textoDono: Record<AvisoSolucao, string> = {
    abertura: `há um pedido de manutenção em ${titulo}: ${ate}.`,
    antes_do_prazo: `o prazo da manutenção em ${titulo} está perto do fim: ${ate}.`,
    vencido: `o prazo de solução da manutenção em ${titulo} venceu. Se precisar, chame um parceiro de manutenção pela ordem.`,
    reaberta: `o morador reabriu a manutenção em ${titulo}. O prazo original continua: ${s.texto}.`,
  };
  const { error } = await db.from("service_order_eventos").insert({ service_order_id: ordemId, papel: "sistema", tipo: "aviso", status_para: tipo, criado_em: agora.toISOString() });
  if (error) {
    console.error("[avisarPrazoManutencao] histórico", error.code);
    return false;
  }
  // Prompt 44: o silêncio é decidido no notify(); a manutenção urgente é prazo do dia e fura o silêncio.
  const prazoHoje = ordem.priority === "urgente";
  const dono = await perfil(db, o.owner_id as string);
  if (dono?.email && notificacaoLigada(dono.notif_email as boolean | null)) {
    await notify({
      event: "manutencao_prazo",
      email: dono.email as string,
      name: (dono.full_name as string) ?? undefined,
      userId: o.owner_id as string,
      pushUrl: `/dashboard/solicitacoes?ordem=${ordemId}`,
      body: (n) => `Olá${n ? " " + n : ""}, ${textoDono[tipo]}`,
      ctaLabel: tipo === "vencido" ? "Ver a ordem e chamar um parceiro" : "Ver a ordem",
      prazoHoje,
    }).catch(() => null);
  }
  if (tipo === "vencido") {
    const morador = await perfil(db, o.tenant_id as string);
    if (morador?.email && notificacaoLigada(morador.notif_email as boolean | null)) {
      await notify({
        event: "manutencao_prazo",
        email: morador.email as string,
        name: (morador.full_name as string) ?? undefined,
        userId: o.tenant_id as string,
        pushUrl: `/dashboard/solicitacoes?ordem=${ordemId}`,
        body: (n) => `Olá${n ? " " + n : ""}, o prazo de solução da sua manutenção venceu. O proprietário foi avisado em ${dataHoraBrasilia(agora)} (horário de Brasília).`,
        ctaLabel: "Ver a ordem",
        prazoHoje,
      }).catch(() => null);
    }
  }
  return true;
}
