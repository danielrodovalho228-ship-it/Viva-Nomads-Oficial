import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { HREF_APROVACOES } from "@/lib/admin/agentes-abas";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { conferirLinkAprovacao, consumirLinkAprovacao, lerLinkAprovacao, MENSAGEM_LINK, type BancoLinks } from "@/lib/agentes/link-aprovacao";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Link de aprovação", robots: { index: false, follow: false } };

/**
 * Link de aprovação de USO ÚNICO (ordem 12a8086d, item 4). O link do aviso do Moacir (e-mail/push) chega aqui.
 * Não aprova nada: confere assinatura e prazo (72 h), marca o link como usado e abre a aba Aprovações,
 * onde a decisão continua pedindo o segundo toque e login recente.
 * O layout de /admin já barra quem não é admin, mas layout e página rodam em paralelo: por isso a página
 * confere sessão + papel admin + duas etapas ANTES de consumir. Sem isso, um leitor de links do e-mail
 * (sem login) gastaria o link do Daniel.
 */
export default async function LinkAprovarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Sem login, sem papel admin ou sem as duas etapas: o layout redireciona ou responde 404; o link segue intacto.
  if (!user || !(await ehAdmin(supabase, user.id))) return null;

  const link = lerLinkAprovacao(await searchParams);
  const conferencia = conferirLinkAprovacao(link, new Date(), process.env.CRON_SECRET ?? "");
  let resultado: keyof typeof MENSAGEM_LINK = conferencia === "valido" ? "erro" : conferencia;

  if (conferencia === "valido" && link) {
    const servico = createAdminClient();
    if (servico) {
      const banco: BancoLinks = {
        async inserir(assinatura, expiraEm) {
          const { error } = await servico.from("aprovacoes_links_usados").insert({ assinatura, expira_em: expiraEm });
          return { codigo: error ? (error.code ?? "erro") : null };
        },
        async limparVencidos() {
          await servico.from("aprovacoes_links_usados").delete().lt("expira_em", new Date().toISOString());
        },
      };
      const consumo = await consumirLinkAprovacao(banco, link);
      if (consumo === "ok") redirect(HREF_APROVACOES);
      resultado = consumo;
    }
  }

  return (
    <div data-testid="link-aprovacao">
      <PageTitle title="Link de aprovação" subtitle="Os links dos avisos abrem a tela uma vez só e valem 72 h." />
      <Panel>
        <p className="text-sm text-ink" role="status" data-testid="link-aprovacao-motivo" data-motivo={resultado}>
          {MENSAGEM_LINK[resultado]}
        </p>
        <ButtonLink href={HREF_APROVACOES} className="mt-4" data-testid="link-aprovacao-central">
          Abrir Aprovações
        </ButtonLink>
      </Panel>
    </div>
  );
}
