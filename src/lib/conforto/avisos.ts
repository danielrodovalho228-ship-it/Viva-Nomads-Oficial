/*
  Prompt 59 — avisos do padrão mínimo de conforto (matriz: conforto_prazo e conforto_pendencia). Só do servidor.
  Textos curtos e concretos; nada de valores (D7).
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { notificacaoLigada } from "@/lib/notifications/preferencias";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { ehChaveConforto, itemConforto } from "@/config/conforto-minimo";
import { dataHoraBrasilia } from "@/config/atendimento";
import { AVISO_SELO_CONFORTO, procedentes12m, seloPeloConforto, type AcaoPendencia, type PendenciaConforto } from "./regras";

type Db = SupabaseClient;

async function avisar(db: Db, userId: string | null | undefined, p: { event: "conforto_prazo" | "conforto_pendencia"; pushUrl: string; texto: string; cta: string }) {
  if (!userId) return;
  const { data: perfil } = await db.from("profiles").select("email, full_name, notif_email").eq("id", userId).maybeSingle();
  if (!perfil?.email || !notificacaoLigada(perfil.notif_email as boolean | null)) return;
  await notify({
    event: p.event,
    email: perfil.email as string,
    name: (perfil.full_name as string) ?? undefined,
    userId,
    pushUrl: p.pushUrl,
    body: (n) => `Olá${n ? " " + n : ""}, ${p.texto}`,
    ctaLabel: p.cta,
  }).catch(() => null);
}

const rotulo = (chave: string) => (ehChaveConforto(chave) ? itemConforto(chave).rotulo : chave);

/** Lembrete do prazo de adequação (15 e 3 dias) ou "saiu da busca" (D4). */
export async function avisarConfortoPrazo(db: Db, propertyId: string, tipo: 15 | 3 | "pausado", prazoAte: string): Promise<void> {
  const { data: p } = await db.from("properties").select("owner_id, title").eq("id", propertyId).maybeSingle();
  if (!p) return;
  const titulo = textoEmail((p.title as string) ?? "seu anúncio", 80);
  const data = new Date(prazoAte).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const texto =
    tipo === "pausado"
      ? `o anúncio ${titulo} saiu da busca porque o padrão mínimo de conforto não foi confirmado. Confirme os itens e ele volta na hora.`
      : `confirme o padrão mínimo de conforto de ${titulo} até ${data}. Faltam ${tipo} dias; depois disso o anúncio sai da busca até a confirmação.`;
  await avisar(db, p.owner_id as string, { event: "conforto_prazo", pushUrl: `/dashboard/imoveis/${propertyId}/conforto`, texto, cta: "Confirmar o padrão mínimo" });
}

/** Aviso de cada passo da pendência: aberta (dono), corrigida (morador), reaberta/contestada/decidida. */
export async function avisarPendenciaConforto(db: Db, pendenciaId: string, acao: AcaoPendencia | "aberta"): Promise<void> {
  const { data: p } = await db
    .from("conforto_pendencias")
    .select("id, property_id, contrato_id, chave, status, aberta_em, prazo_ate, decidido_em, properties(owner_id, title), contratos(tenant_id)")
    .eq("id", pendenciaId)
    .maybeSingle();
  if (!p) return;
  const prop = p.properties as unknown as { owner_id?: string; title?: string } | null;
  const dono = prop?.owner_id;
  const morador = (p.contratos as unknown as { tenant_id?: string } | null)?.tenant_id;
  const item = rotulo(p.chave as string);
  const titulo = textoEmail(prop?.title ?? "imóvel", 80);
  const dono_url = `/dashboard/contratos/${p.contrato_id}#pendencias-conforto`;
  const morador_url = `/dashboard/locacoes/${p.contrato_id}#pendencias-conforto`;
  const prazo = dataHoraBrasilia(new Date(p.prazo_ate as string));
  if (acao === "aberta" || acao === "reabrir") {
    const texto = acao === "aberta"
      ? `o morador marcou "${item}" como não confere na entrada de ${titulo}. Corrija até ${prazo} (horário de Brasília) ou conteste pela plataforma.`
      : `o morador reabriu a pendência "${item}" de ${titulo}. O prazo continua: até ${prazo} (horário de Brasília).`;
    await avisar(db, dono, { event: "conforto_pendencia", pushUrl: dono_url, texto, cta: "Ver a pendência" });
  } else if (acao === "corrigir") {
    await avisar(db, morador, {
      event: "conforto_pendencia",
      pushUrl: morador_url,
      texto: `o proprietário marcou "${item}" como corrigido. Confirme ou reabra em até 48 horas; sem resposta, conta como corrigido.`,
      cta: "Confirmar ou reabrir",
    });
  } else if (acao === "decidir") {
    const procedente = p.status === "procedente";
    await avisar(db, morador, {
      event: "conforto_pendencia",
      pushUrl: morador_url,
      texto: `o atendimento da Viva decidiu a contestação sobre "${item}": ${procedente ? "a pendência é procedente" : "o item estava conforme"}.`,
      cta: "Ver a decisão",
    });
    let extra = "";
    if (procedente && dono) {
      // Aviso prévio do selo (1ª procedente em 12 meses): "mais uma em 12 meses tira o selo".
      const { data: todas } = await db.from("conforto_pendencias").select("status, aberta_em, prazo_ate, decidido_em, chave").eq("property_id", p.property_id as string);
      if (seloPeloConforto(procedentes12m((todas ?? []) as PendenciaConforto[], new Date())) === "aviso") extra = ` ${AVISO_SELO_CONFORTO}`;
    }
    await avisar(db, dono, {
      event: "conforto_pendencia",
      pushUrl: dono_url,
      texto: `o atendimento da Viva decidiu a contestação sobre "${item}": ${procedente ? "a pendência é procedente." : "o item estava conforme."}${extra}`,
      cta: "Ver a decisão",
    });
  }
}
