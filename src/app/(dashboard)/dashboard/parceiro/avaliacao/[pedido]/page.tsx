import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { ChecklistAvaliador } from "@/components/vistoria/checklist-avaliador";
import { MedirInternetAvaliacao } from "@/components/vistoria/medir-internet-avaliacao";
import { integracoesSimuladas } from "@/lib/integracoes";
import { PERGUNTAS_RUIDO } from "@/config/niveis";
import { ITENS_CHECKLIST, ROTULO_VALOR, itemChecklist, valoresDoItem, type ValorItem } from "@/config/checklist-avaliacao";
import { vistoriaAtiva } from "@/lib/vistoria/chave";
import { ROTULO_RESULTADO, type Resultado } from "@/lib/vistoria/laudo";
import { concluirVisita, confirmarCorrecao, enviarFotoAvaliacao, enviarLaudo, registrarMedicao, salvarRuidoVisita } from "@/lib/vistoria/laudo-actions";

export const metadata = { title: "Checklist da avaliação", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";

/**
 * Checklist da avaliação no celular do avaliador designado (Prompt 62-B2, ESQUELETO funcional; o desenho é do 62-A):
 * itens por grupo com critério objetivo, fotos (1 por cômodo + 1 por item não conforme, sem pessoas nem pertences),
 * ruído pelas 4 perguntas, internet medida na hora, concluir a visita e enviar (a plataforma emite o laudo VIS).
 * Depois do laudo: a reverificação da ressalva (uma, incluída).
 */
export default async function ChecklistAvaliacaoPage({ params }: { params: Promise<{ pedido: string }> }) {
  if (!(await vistoriaAtiva())) notFound();
  const { pedido } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=${encodeURIComponent(`/dashboard/parceiro/avaliacao/${pedido}`)}`);
  const { data: p } = await admin
    .from("vistoria_pedidos")
    .select("id, property_id, status, tipo, ocupado, agendado_para, ruido_respostas, avaliadores_credenciamento(parceiros(user_id))")
    .eq("id", pedido)
    .maybeSingle();
  const dono = (p?.avaliadores_credenciamento as unknown as { parceiros: { user_id: string } | null } | null)?.parceiros?.user_id;
  if (!p || dono !== user.id) notFound();

  const [{ data: itens }, { data: laudos }, { data: fotos }] = await Promise.all([
    admin.from("vistoria_checklist").select("chave, valor, observacao").eq("pedido_id", p.id),
    admin.from("vistoria_laudos").select("id, numero, versao, resultado, ressalvas, graves, prazo_ressalva_ate, corrigido_em, ressalva_vencida_em, contestado_em").eq("pedido_versao_id", p.id).order("versao", { ascending: false }).limit(1),
    admin.from("vistoria_checklist_fotos").select("item_chave, comodo, criado_em").eq("pedido_id", p.id).order("criado_em"),
  ]);
  const iniciais = Object.fromEntries(((itens ?? []) as { chave: string; valor: ValorItem; observacao: string | null }[]).map((i) => [i.chave, { valor: i.valor, observacao: i.observacao }]));
  const laudo = ((laudos ?? [])[0] ?? null) as {
    id: string;
    numero: string;
    versao: number;
    resultado: Resultado;
    ressalvas: { chave: string; reverificacao: "foto" | "visita" }[];
    graves: string[];
    prazo_ressalva_ate: string | null;
    corrigido_em: string | null;
    ressalva_vencida_em: string | null;
    contestado_em: string | null;
  } | null;
  const emVisita = ["agendado", "realizada"].includes(p.status as string);
  const ruido = (p.ruido_respostas ?? null) as Record<string, boolean> | null;
  const fotosLista = (fotos ?? []) as { item_chave: string | null; comodo: string | null }[];

  return (
    <>
      <PageTitle title="Checklist da avaliação" subtitle={p.tipo === "verificacao" ? "Verificação aberta pela Viva" : p.tipo === "contestacao" ? "2ª avaliação (contestação)" : undefined} />
      <ButtonLink href="/dashboard/parceiro/avaliacao" variant="ghost" size="sm" className="mb-4">Voltar às avaliações</ButtonLink>
      {p.ocupado && <p className="mb-4 text-sm text-muted">Imóvel ocupado: não fotografe pertences nem pessoas.</p>}

      {emVisita && (
        <>
          <Panel title="Itens" className="mb-6">
            <ChecklistAvaliador pedidoId={p.id} iniciais={iniciais} />
          </Panel>

          <Panel title="Fotos" className="mb-6" data-testid="avaliacao-fotos">
            <p className="text-sm text-muted">Uma foto por cômodo e uma por item não conforme. Sem pessoas e sem pertences do morador; a localização da foto é apagada no envio.</p>
            <p className="mt-1 text-xs text-muted" data-testid="avaliacao-fotos-contagem">{fotosLista.length} foto(s) enviada(s).</p>
            <FormAcao acao={enviarFotoAvaliacao} className="mt-3 grid gap-2" testid="avaliacao-foto-form">
              <input type="hidden" name="pedidoId" value={p.id} />
              <label className="text-sm">Cômodo<input name="comodo" placeholder="Ex.: quarto principal" className={campo} /></label>
              <label className="text-sm">
                Ou item não conforme
                <select name="item" className={campo} defaultValue="">
                  <option value="">Nenhum (foto do cômodo)</option>
                  {ITENS_CHECKLIST.map((i) => (
                    <option key={i.chave} value={i.chave}>{i.rotulo}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">Foto<input type="file" name="foto" accept="image/jpeg,image/png,image/webp" capture="environment" required className={campo} /></label>
              <Button type="submit" size="sm" variant="secondary">Enviar foto</Button>
            </FormAcao>
          </Panel>

          <Panel title="Ruído" className="mb-6" data-testid="avaliacao-ruido">
            <FormAcao acao={salvarRuidoVisita} className="grid gap-2" testid="avaliacao-ruido-form">
              <input type="hidden" name="pedidoId" value={p.id} />
              {PERGUNTAS_RUIDO.map((q) => (
                <fieldset key={q.chave} className="text-sm">
                  <legend className="text-ink">{q.texto}</legend>
                  <label className="mr-4"><input type="radio" name={q.chave} value="sim" defaultChecked={ruido?.[q.chave] === true} required /> Sim</label>
                  <label><input type="radio" name={q.chave} value="nao" defaultChecked={ruido ? ruido[q.chave] === false : false} /> Não</label>
                </fieldset>
              ))}
              <Button type="submit" size="sm" variant="secondary">Salvar ruído</Button>
            </FormAcao>
            <FormAcao acao={registrarMedicao} className="mt-4 flex flex-wrap items-end gap-2" testid="avaliacao-dba-form">
              <input type="hidden" name="pedidoId" value={p.id} />
              <input type="hidden" name="tipo" value="ruido_dba" />
              <label className="text-sm">dB(A) medido (apoio interno, nunca publicado)<input name="dba" inputMode="decimal" className={campo} /></label>
              <Button type="submit" size="sm" variant="secondary">Guardar dB(A)</Button>
            </FormAcao>
          </Panel>

          <Panel title="Internet medida agora" className="mb-6">
            <MedirInternetAvaliacao pedidoId={p.id} simulado={integracoesSimuladas()} />
          </Panel>

          <Panel title="Concluir" className="mb-6" data-testid="avaliacao-concluir" data-status={p.status}>
            {p.status === "agendado" ? (
              <FormAcao acao={concluirVisita} testid="concluir-visita">
                <input type="hidden" name="pedidoId" value={p.id} />
                <Button type="submit" size="sm">Concluir a visita</Button>
              </FormAcao>
            ) : (
              <FormAcao acao={enviarLaudo} testid="enviar-laudo">
                <input type="hidden" name="pedidoId" value={p.id} />
                <p className="text-sm text-muted">A plataforma emite o laudo VIS com o resultado calculado pelo checklist. Prazo: 48 horas úteis da visita.</p>
                <Button type="submit" size="sm" className="mt-2">Enviar o laudo</Button>
              </FormAcao>
            )}
          </Panel>
        </>
      )}

      {laudo && (
        <Panel title={`Laudo ${laudo.numero}${laudo.versao > 1 ? ` v${laudo.versao}` : ""}`} data-testid="avaliador-laudo" data-resultado={laudo.resultado}>
          <p className="text-sm text-ink">Resultado: {ROTULO_RESULTADO[laudo.resultado]}</p>
          <a href={`/api/vistoria/laudo/${laudo.id}`} className="mt-1 inline-block text-sm underline">Baixar o PDF</a>
          {(laudo.ressalvas.length > 0 || laudo.graves.length > 0) && !laudo.corrigido_em && !laudo.ressalva_vencida_em && !laudo.contestado_em && (
            <FormAcao acao={confirmarCorrecao} className="mt-4 grid gap-2" testid="confirmar-correcao">
              <input type="hidden" name="laudoId" value={laudo.id} />
              <p className="text-sm text-muted">Reverificação (uma, incluída): confira a foto enviada pelo proprietário ou a nova visita.</p>
              {[...new Set([...laudo.ressalvas.map((r) => r.chave), ...laudo.graves])].map((chave) => {
                const i = itemChecklist(chave);
                if (!i) return null;
                return (
                  <label key={chave} className="text-sm">
                    {i.rotulo} ({laudo.ressalvas.find((r) => r.chave === chave)?.reverificacao === "visita" ? "nova visita" : "foto"}; {fotosLista.filter((f) => f.item_chave === chave).length} foto(s))
                    <select name={`item_${chave}`} className={campo} defaultValue="" required data-testid={`correcao-${chave}`}>
                      <option value="" disabled>Escolha</option>
                      {valoresDoItem(i).map((v) => (
                        <option key={v} value={v}>{ROTULO_VALOR[v]}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
              <Button type="submit" size="sm">Confirmar a reverificação</Button>
            </FormAcao>
          )}
        </Panel>
      )}
    </>
  );
}
