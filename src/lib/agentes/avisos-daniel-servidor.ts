import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { emProducao } from "@/lib/integracoes";
import { SITE_URL } from "@/lib/site";
import { inicioDoDiaBrasilia } from "@/lib/agentes/central";
import { MAX_TENTATIVAS, processarAvisos, type Aviso, type Deps, type Resultado } from "@/lib/agentes/avisos-daniel";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Dependências REAIS: só a tabela avisos_daniel, com o cliente de serviço (rota protegida pelo CRON_SECRET). */
export function depsAvisos(admin: Admin, segredo: string): Deps {
  const desde = () => inicioDoDiaBrasilia(new Date()).toISOString();
  return {
    destino: () => process.env.AVISO_DANIEL_EMAIL,
    siteUrl: SITE_URL,
    segredo,
    agora: () => new Date(),
    async pendentes() {
      const { data } = await admin
        .from("avisos_daniel")
        .select("id, origem_ronda, assunto, corpo, prioridade, link")
        .is("enviado_em", null)
        .lt("tentativas", MAX_TENTATIVAS)
        .order("criado_em", { ascending: true })
        .limit(50);
      return (data ?? []) as Aviso[];
    },
    async emailsHoje() {
      const { count } = await admin
        .from("avisos_daniel")
        .select("id", { count: "exact", head: true })
        .eq("via", "email")
        .gte("enviado_em", desde());
      return count ?? 0;
    },
    async resumoHoje() {
      const { count } = await admin
        .from("avisos_daniel")
        .select("id", { count: "exact", head: true })
        .eq("via", "resumo")
        .gte("enviado_em", desde());
      return (count ?? 0) > 0;
    },
    async reservar(id, via) {
      const { data } = await admin
        .from("avisos_daniel")
        .update({ enviado_em: new Date().toISOString(), via, erro: null })
        .eq("id", id)
        .is("enviado_em", null)
        .select("id");
      return (data?.length ?? 0) === 1;
    },
    async falhou(id, erro, contar) {
      const { data } = await admin.from("avisos_daniel").select("tentativas").eq("id", id).maybeSingle();
      await admin
        .from("avisos_daniel")
        .update({ enviado_em: null, via: null, erro: erro.slice(0, 300), tentativas: (data?.tentativas ?? 0) + (contar ? 1 : 0) })
        .eq("id", id);
    },
    async enviar(m) {
      const r = await sendEmail({ to: m.to, subject: m.subject, html: m.html, text: m.text, from: m.from, replyTo: m.replyTo });
      if (r.error) return { ok: false, erro: r.error };
      if (r.demo && !r.captured && emProducao()) return { ok: false, erro: "RESEND_API_KEY não configurada." };
      return { ok: true };
    },
  };
}

export async function rodarAvisosDaniel(admin: Admin, segredo: string): Promise<Resultado> {
  return processarAvisos(depsAvisos(admin, segredo));
}
