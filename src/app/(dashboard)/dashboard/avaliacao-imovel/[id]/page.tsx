import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { vistoriaAtiva } from "@/lib/vistoria/chave";
import { concordarVisita } from "@/lib/vistoria/actions";
import { quandoVisita } from "@/lib/vistoria/telas-exibicao";
import { ETIQUETA_BRASILIA } from "@/lib/datas-brasilia";

export const metadata = { title: "Visita de avaliação", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Prompt 62-B1 (desenho do 62-A, Parte 1, item 5; o mesmo cartão aparece na conversa da estadia): o morador do imóvel ocupado concorda com a data da visita de avaliação
 * em 1 toque. Sem a concordância, a visita não acontece. Com VISTORIA_ATIVA desligada, a página não existe.
 */
export default async function ConcordanciaPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await vistoriaAtiva())) notFound();
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=${encodeURIComponent(`/dashboard/avaliacao-imovel/${id}`)}`);
  const { data: p } = await admin.from("vistoria_pedidos").select("id, morador_id, agendado_para, concordancia_em, ocupado, status").eq("id", id).maybeSingle();
  if (!p || p.morador_id !== user.id || !p.ocupado) notFound();
  const quando = p.agendado_para ? quandoVisita(p.agendado_para) : null;
  return (
    <>
      <PageTitle title="Visita de avaliação do imóvel" />
      <Panel data-testid="concordancia">
        <p className="text-sm text-ink">O proprietário pediu a avaliação do imóvel onde você mora. Um avaliador credenciado, designado pela Viva, confere o imóvel pelo checklist da Viva.</p>
        <p className="mt-2 text-sm text-muted">O avaliador não fotografa os seus pertences. A visita só acontece se você concordar com a data.</p>
        {p.concordancia_em ? (
          <p className="mt-4 text-sm font-semibold text-forest" data-testid="concordancia-feita">Você concordou com a visita{quando ? ` em ${quando}, ${ETIQUETA_BRASILIA}` : ""}.</p>
        ) : quando && p.status === "designado" ? (
          <FormAcao acao={concordarVisita} className="mt-4">
            <input type="hidden" name="pedidoId" value={p.id} />
            <Button type="submit" data-testid="concordar-visita">Concordo com a visita em {quando}</Button>
          </FormAcao>
        ) : (
          <p className="mt-4 text-sm text-muted">Ainda não há data proposta.</p>
        )}
        {quando && !p.concordancia_em && <p className="mt-2 text-xs text-muted">Horário de Brasília.</p>}
        {!p.concordancia_em && quando && (
          <Link href="/dashboard/mensagens" className="mt-3 inline-block text-sm font-semibold text-forest underline underline-offset-2" data-testid="outro-horario">
            Prefiro outro horário
          </Link>
        )}
        <p className="mt-3 text-xs text-muted">A data nova é combinada pelas mensagens da Viva.</p>
      </Panel>
    </>
  );
}
