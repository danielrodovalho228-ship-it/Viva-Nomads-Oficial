import "server-only";
import { BellRing } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIAS_DIAGNOSTICO_PUSH, resumoDoPush, type EnvioPush } from "@/lib/notifications/diagnostico-push";
import { PushTeste } from "@/components/admin/push-teste";

/**
 * "Push" (Prompt 44, item 6): aparelhos com push por plataforma, envios e falhas dos últimos 7 dias, tokens mortos
 * limpos e o push de teste para o próprio admin. Lido com o cliente de serviço; contas de teste ficam de fora.
 */
export async function CartaoPush({ agora = new Date() }: { agora?: Date }) {
  const admin = createAdminClient();
  if (!admin) return null;
  const desde = new Date(agora.getTime() - DIAS_DIAGNOSTICO_PUSH * 86_400_000).toISOString();
  const { data: teste } = await admin.from("profiles").select("id").eq("is_teste", true);
  const idsTeste = ((teste ?? []) as { id: string }[]).map((p) => p.id);
  // Aparelhos por contagem (sem trazer os tokens), já sem as contas de teste.
  const contar = (platform: "android" | "ios" | "web") => {
    let q = admin.from("push_tokens").select("id", { count: "exact", head: true }).eq("platform", platform);
    if (idsTeste.length) q = q.not("user_id", "in", `(${idsTeste.join(",")})`);
    return q.then((x) => x.count ?? 0);
  };
  const [android, ios, web, envios] = await Promise.all([
    contar("android"),
    contar("ios"),
    contar("web"),
    admin.from("push_envios").select("user_id, enviados, falhas, tokens_mortos, criado_em").gte("criado_em", desde).limit(5000),
  ]);
  const semRegistro = !!envios.error;
  const r = resumoDoPush({
    aparelhos: [],
    envios: semRegistro ? [] : ((envios.data ?? []) as EnvioPush[]),
    contasDeTeste: idsTeste,
    agora,
  });
  r.aparelhos = { android, ios, web };
  r.totalAparelhos = android + ios + web;
  return (
    <section className="rounded-xl border border-sage-200 bg-white p-4" data-testid="cartao-push">
      <h2 className="flex items-center gap-2 font-title text-lg font-semibold text-ink">
        <BellRing className="h-5 w-5 text-forest" aria-hidden /> Push
      </h2>
      <p className="mt-1 text-sm text-muted">Aparelhos com notificação ativa e envios dos últimos {DIAS_DIAGNOSTICO_PUSH} dias. Contas de teste não entram.</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
        <div data-testid="cartao-push-aparelhos">
          <dt className="text-muted">Aparelhos</dt>
          <dd className="font-semibold text-ink">{r.totalAparelhos}</dd>
          <dd className="text-xs text-muted">
            Android {r.aparelhos.android} · iPhone {r.aparelhos.ios} · Web {r.aparelhos.web}
          </dd>
        </div>
        <div data-testid="cartao-push-entregues">
          <dt className="text-muted">Entregues</dt>
          <dd className="font-semibold text-ink">{r.entregues}</dd>
          <dd className="text-xs text-muted">em {r.envios} {r.envios === 1 ? "envio" : "envios"}</dd>
        </div>
        <div data-testid="cartao-push-falhas">
          <dt className="text-muted">Falhas</dt>
          <dd className="font-semibold text-ink">{r.falhas}</dd>
          {r.taxaFalha !== null && <dd className="text-xs text-muted">{r.taxaFalha}% do tentado</dd>}
        </div>
        <div data-testid="cartao-push-mortos">
          <dt className="text-muted">Tokens mortos limpos</dt>
          <dd className="font-semibold text-ink">{r.tokensMortos}</dd>
        </div>
      </dl>
      {semRegistro && (
        <p className="mt-3 text-sm text-muted" data-testid="cartao-push-pendente">
          Registro de envios ainda não disponível (migração 0227 pendente).
        </p>
      )}
      <div className="mt-4">
        <PushTeste />
      </div>
    </section>
  );
}
