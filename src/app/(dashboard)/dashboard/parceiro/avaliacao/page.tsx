import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { textoTaxaServicoParceiros } from "@/config/taxa-servico-parceiros";
import { brl } from "@/lib/fiscal/documento";
import { agendarVisita, avaliarConduta, marcarRecebido, pedirCredenciamento, registrarAusencia, responderDesignacao } from "@/lib/vistoria/actions";
import { CODIGO_CONDUTA, CONDUTA_AVALIADOR, HORAS_PARA_RESPONDER, ROTULO_CONDUTA, ROTULO_PORTE, type Porte, type StatusCredenciamento } from "@/lib/vistoria/regras";

export const metadata = { title: "Avaliação de imóveis", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";
const SITUACAO: Record<StatusCredenciamento, string> = {
  solicitado: "Pedido recebido: a Viva confere os seus dados e a experiência.",
  em_teste: "Em teste: faça a avaliação de teste que a Viva marcou. Depois da revisão, você passa a ativo.",
  ativo: "Ativo: você entra no rodízio da sua cidade.",
  suspenso: "Suspenso: a Viva vai entrar em contato.",
  descredenciado: "Descredenciado.",
};
const STATUS_PEDIDO: Record<string, string> = { pedido: "Aguardando designação", designado: "Designado a você", agendado: "Visita agendada", realizada: "Visita feita", laudo_emitido: "Laudo emitido", cancelada: "Cancelada", ausencia: "Ausência registrada" };

type Pedido = { id: string; cidade: string; porte: Porte; valor_tabela: number; status: string; ocupado: boolean; agendado_para: string | null; concordancia_em: string | null; designado_em: string | null; recebido_marcado_em: string | null; teste: boolean };

/**
 * Avaliador credenciado (Prompt 62-B1, ESQUELETO funcional; o desenho é do 62-A): pedir o credenciamento e responder
 * às avaliações designadas pela Viva. O avaliador nunca é contratado direto: não há catálogo nem orçamento aqui.
 */
export default async function AvaliacaoParceiroPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) redirect("/dashboard");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=%2Fdashboard%2Fparceiro%2Favaliacao");
  const { data: parc } = await admin.from("parceiros").select("id").eq("user_id", user.id).maybeSingle();
  if (!parc) {
    return (
      <>
        <PageTitle title="Avaliação de imóveis" />
        <Panel>
          <p className="text-sm text-muted">Para ser avaliador credenciado, primeiro ative a sua conta de parceiro.</p>
          <ButtonLink href="/parceiros#h-form" size="sm" className="mt-3">Seja parceiro</ButtonLink>
        </Panel>
      </>
    );
  }
  const { data: cred } = await admin.from("avaliadores_credenciamento").select("id, numero_credenciado, cidade, status").eq("parceiro_id", parc.id).maybeSingle();

  if (!cred) {
    return (
      <>
        <PageTitle title="Avaliação de imóveis" subtitle="Credenciamento de avaliador: a Viva designa as avaliações por rodízio." />
        <Panel title="Pedir credenciamento" data-testid="credenciamento-form">
          <p className="text-sm text-muted">Precisa da identidade verificada, CPF ou CNPJ válido no cadastro de parceiro, experiência comprovada e uma avaliação de teste revisada pela Viva antes da primeira real.</p>
          <FormAcao acao={pedirCredenciamento} className="mt-4 grid gap-3">
            <label className="text-sm">Cidade onde vai avaliar<input name="cidade" required className={campo} /></label>
            <label className="text-sm">Portfólio ou referência (link https)<input name="experienciaLink" type="url" className={campo} /></label>
            <label className="text-sm">Ou envie um arquivo (PDF ou imagem)<input name="experienciaArquivo" type="file" accept="application/pdf,image/*" className={campo} /></label>
            <label className="text-sm">
              Relações com proprietários ou imóveis (e-mails dos proprietários e links dos anúncios com quem você tem vínculo pessoal ou comercial)
              <textarea name="relacoes" rows={3} className={campo} />
            </label>
            <div className="rounded-lg border border-sage-200 p-3 text-sm">
              <p className="font-semibold text-ink">Código de conduta da avaliação (versão {CODIGO_CONDUTA.versao})</p>
              <ul className="mt-1 list-disc pl-4 text-muted">
                {CODIGO_CONDUTA.itens.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <label className="mt-2 flex items-start gap-2">
                <input type="checkbox" name="aceiteConduta" className="mt-1 h-4 w-4 accent-forest" /> Li e aceito o código de conduta.
              </label>
            </div>
            <Button type="submit" size="sm" data-testid="credenciamento-enviar">Pedir credenciamento</Button>
          </FormAcao>
        </Panel>
      </>
    );
  }

  const { data: pedidos } = await admin
    .from("vistoria_pedidos")
    .select("id, cidade, porte, valor_tabela, status, ocupado, agendado_para, concordancia_em, designado_em, recebido_marcado_em, teste")
    .eq("avaliador_id", cred.id)
    .order("criado_em", { ascending: false });
  const { data: designacoes } = await admin.from("vistoria_designacoes").select("pedido_id, resposta").eq("avaliador_id", cred.id);
  const resposta = new Map(((designacoes ?? []) as { pedido_id: string; resposta: string | null }[]).map((d) => [d.pedido_id, d.resposta]));

  return (
    <>
      <PageTitle title="Avaliação de imóveis" subtitle={`Avaliador credenciado nº ${cred.numero_credenciado} · ${cred.cidade}`} />
      <Panel className="mb-6" data-testid="credenciamento-situacao" data-status={cred.status}>
        <p className="text-sm text-ink">{SITUACAO[cred.status as StatusCredenciamento]}</p>
        <p className="mt-2 text-xs text-muted">O proprietário paga a avaliação direto a você, pelo valor da tabela da Viva. {textoTaxaServicoParceiros(PAGAMENTO_PARCEIROS_ATIVO)}</p>
      </Panel>
      <Panel title="Avaliações designadas" data-testid="avaliacoes-designadas">
        {(pedidos ?? []).length === 0 ? (
          <p className="text-sm text-muted">Nenhuma avaliação designada ainda.</p>
        ) : (
          <ul className="grid gap-3">
            {((pedidos ?? []) as Pedido[]).map((p) => {
              const r = resposta.get(p.id) ?? null;
              return (
                <li key={p.id} className="rounded-lg border border-sage-200 p-3 text-sm" data-testid="avaliacao-designada" data-pedido={p.id} data-status={p.status}>
                  <strong className="text-ink">{STATUS_PEDIDO[p.status] ?? p.status}</strong> · {p.cidade} · {ROTULO_PORTE[p.porte]} · {p.teste ? "avaliação de teste" : brl(Number(p.valor_tabela))}
                  {p.ocupado && <span className="block text-muted">Imóvel ocupado: a visita só acontece com a concordância do morador. Não fotografe pertences.</span>}
                  {p.agendado_para && <span className="block text-muted">Visita: {new Date(p.agendado_para).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}{p.ocupado && !p.concordancia_em ? " (aguardando o morador)" : ""}</span>}
                  {p.status === "designado" && r === null && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="w-full text-xs text-muted">Responda em até {HORAS_PARA_RESPONDER} horas; sem resposta, passa ao próximo avaliador.</span>
                      <FormAcao acao={responderDesignacao}><input type="hidden" name="pedidoId" value={p.id} /><input type="hidden" name="resposta" value="aceitar" /><Button type="submit" size="sm" data-testid="designacao-aceitar">Aceitar</Button></FormAcao>
                      <FormAcao acao={responderDesignacao}><input type="hidden" name="pedidoId" value={p.id} /><input type="hidden" name="resposta" value="recusar" /><Button type="submit" variant="secondary" size="sm" data-testid="designacao-recusar">Recusar</Button></FormAcao>
                    </div>
                  )}
                  {["designado", "agendado"].includes(p.status) && r === "aceita" && (
                    <FormAcao acao={agendarVisita} className="mt-2 flex flex-wrap items-end gap-2" testid="agendar-visita">
                      <input type="hidden" name="pedidoId" value={p.id} />
                      <label className="text-sm">Data e hora da visita<input type="datetime-local" name="quando" required className={campo} /></label>
                      <Button type="submit" size="sm">{p.agendado_para ? "Reagendar" : "Agendar"}</Button>
                    </FormAcao>
                  )}
                  {p.status === "agendado" && (
                    <FormAcao acao={registrarAusencia} className="mt-2" testid="ausencia-dono">
                      <input type="hidden" name="pedidoId" value={p.id} />
                      <input type="hidden" name="quem" value="dono" />
                      <Button type="submit" variant="secondary" size="sm">Proprietário ou morador ausente</Button>
                    </FormAcao>
                  )}
                  {["agendado", "realizada", "laudo_emitido"].includes(p.status) && (
                    <ButtonLink href={`/dashboard/parceiro/avaliacao/${p.id}`} size="sm" variant="secondary" className="mt-2" data-testid="abrir-checklist">
                      {p.status === "laudo_emitido" ? "Ver o laudo" : "Abrir o checklist"}
                    </ButtonLink>
                  )}
                  {["realizada", "laudo_emitido"].includes(p.status) && !p.recebido_marcado_em && (
                    <FormAcao acao={marcarRecebido} className="mt-2"><input type="hidden" name="pedidoId" value={p.id} /><Button type="submit" variant="secondary" size="sm">Marcar valor recebido</Button></FormAcao>
                  )}
                  {p.status === "laudo_emitido" && (
                    <FormAcao acao={avaliarConduta} className="mt-2 flex flex-wrap items-end gap-2" testid="conduta-avaliador">
                      <input type="hidden" name="pedidoId" value={p.id} />
                      {CONDUTA_AVALIADOR.map((c) => (
                        <label key={c} className="text-sm">{ROTULO_CONDUTA[c]}<select name={`nota_${c}`} className={campo} defaultValue="5">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                      ))}
                      <input name="comentario" placeholder="Comentário sobre a conduta (opcional)" aria-label="Comentário" className={campo} />
                      <Button type="submit" variant="secondary" size="sm">Avaliar o acesso</Button>
                    </FormAcao>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
