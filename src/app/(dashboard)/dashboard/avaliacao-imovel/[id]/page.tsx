import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { vistoriaAtivaParaOMorador } from "@/lib/vistoria/chave";
import { concordarVisita, recusarDataDaVisita } from "@/lib/vistoria/actions";
import { ROTULO_NAO_CONCORDO, TEXTO_RECUSA_PARA_O_MORADOR, concordanciaRecusada } from "@/lib/vistoria/concordancia";
import { conversationId } from "@/lib/messages/conversation-id";
import { urlDaConversa } from "@/lib/notifications/url-conversa";
import { quandoVisita } from "@/lib/vistoria/telas-exibicao";
import { ETIQUETA_BRASILIA } from "@/lib/datas-brasilia";

export const metadata = { title: "Visita de avaliação", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Prompt 62-B1 (desenho do 62-A, Parte 1, item 5; o mesmo cartão aparece na conversa da estadia): o morador do imóvel ocupado concorda com a data da visita de avaliação
 * em 1 toque. Sem a concordância, a visita não acontece. Com VISTORIA_ATIVA desligada, a página não existe.
 * E1171 (ORDEM-DUET-746): a chave é a do PEDIDO, não a da conta do morador — no piloto quem está na lista é o dono. A
 * ordem é: login (o link do aviso tem de sobreviver à sessão fechada), o pedido é deste morador, e só então a chave.
 * E1173 (ORDENS-DUET 751 e 753): ele também pode dizer "Não concordo com esta data" — fica registado, e o dono e o
 * avaliador são avisados. "Prefiro outro horário" abre a conversa dele com o dono.
 */
export default async function ConcordanciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=${encodeURIComponent(`/dashboard/avaliacao-imovel/${id}`)}`);
  const { data: p } = await admin.from("vistoria_pedidos").select("id, property_id, owner_id, morador_id, agendado_para, concordancia_em, concordancia_pedida_em, ocupado, status").eq("id", id).maybeSingle();
  if (!p || p.morador_id !== user.id || !p.ocupado) notFound();
  if (!(await vistoriaAtivaParaOMorador(admin, p.owner_id))) notFound();
  const quando = p.agendado_para ? quandoVisita(p.agendado_para) : null;
  const recusou = concordanciaRecusada({ status: p.status, ocupado: p.ocupado, agendadoPara: p.agendado_para, concordanciaPedidaEm: p.concordancia_pedida_em, concordanciaEm: p.concordancia_em });
  const conversaComODono = p.owner_id && p.property_id ? urlDaConversa(conversationId(user.id, p.owner_id, p.property_id)) : "/dashboard/mensagens";
  return (
    <>
      <PageTitle title="Visita de avaliação do imóvel" />
      <Panel data-testid="concordancia">
        <p className="text-sm text-ink">O proprietário pediu a avaliação do imóvel onde você mora. Um avaliador credenciado, escolhido por ele, confere o imóvel pelo checklist da Viva.</p>
        <p className="mt-2 text-sm text-muted">O avaliador não fotografa os seus pertences. A visita só acontece se você concordar com a data.</p>
        {p.concordancia_em ? (
          <p className="mt-4 text-sm font-semibold text-forest" data-testid="concordancia-feita">Você concordou com a visita{quando ? ` em ${quando}, ${ETIQUETA_BRASILIA}` : ""}.</p>
        ) : quando && p.status === "designado" ? (
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <FormAcao acao={concordarVisita}>
              <input type="hidden" name="pedidoId" value={p.id} />
              <Button type="submit" data-testid="concordar-visita">Concordo com a visita em {quando}</Button>
            </FormAcao>
            <FormAcao acao={recusarDataDaVisita}>
              <input type="hidden" name="pedidoId" value={p.id} />
              <Button type="submit" variant="secondary" data-testid="nao-concordar-visita">{ROTULO_NAO_CONCORDO}</Button>
            </FormAcao>
          </div>
        ) : recusou ? (
          <p className="mt-4 text-sm font-semibold text-ink" data-testid="concordancia-recusada">{TEXTO_RECUSA_PARA_O_MORADOR}</p>
        ) : (
          <p className="mt-4 text-sm text-muted">Ainda não há data proposta.</p>
        )}
        {quando && !p.concordancia_em && <p className="mt-2 text-xs text-muted">Horário de Brasília.</p>}
        {!p.concordancia_em && quando && (
          <Link href={conversaComODono} className="mt-3 inline-block text-sm font-semibold text-forest underline underline-offset-2" data-testid="outro-horario">
            Prefiro outro horário
          </Link>
        )}
        <p className="mt-3 text-xs text-muted">A data nova é combinada pelas mensagens da Viva.</p>
      </Panel>
    </>
  );
}
