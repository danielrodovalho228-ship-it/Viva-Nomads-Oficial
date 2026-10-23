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
import { DELIMITACAO_LAUDO, ROTULO_VALOR, itemChecklist, valoresDoItem, type ValorItem } from "@/config/checklist-avaliacao";
import { vistoriaAtiva } from "@/lib/vistoria/chave";
import { ROTULO_RESULTADO, resultadoAvaliacao, resumoPorGrupo, type Resultado } from "@/lib/vistoria/laudo";
import { linhaResumoGrupo, prazoDoLaudo } from "@/lib/vistoria/telas-laudo";
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
    .select("id, property_id, status, tipo, ocupado, agendado_para, visita_concluida_em, ruido_respostas, avaliadores_credenciamento(parceiros(user_id))")
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
  // Revisão antes de emitir (item 9): o mesmo cálculo do laudo, sobre as respostas salvas.
  const respostasSalvas = Object.fromEntries(Object.entries(iniciais).map(([k, v]) => [k, v.valor]));
  const observacoes = new Map(Object.entries(iniciais).map(([k, v]) => [k, v.observacao]));
  const previsto = resultadoAvaliacao(respostasSalvas);
  const resumo = resumoPorGrupo(respostasSalvas);
  const visitaEm = (p.visita_concluida_em as string | null) ?? (p.agendado_para as string | null);
  const prazo = p.status === "realizada" && visitaEm ? prazoDoLaudo(visitaEm, new Date()) : null;

  return (
    <>
      <PageTitle title="Checklist da avaliação" subtitle={p.tipo === "verificacao" ? "Verificação aberta pela Viva" : p.tipo === "contestacao" ? "2ª avaliação (contestação)" : undefined} />
      <ButtonLink href="/dashboard/parceiro/avaliacao" variant="ghost" size="sm" className="mb-4">Voltar às avaliações</ButtonLink>
      {p.ocupado && <p className="mb-4 text-sm text-ink">Imóvel ocupado: a visita só acontece com o morador de acordo. Não fotografe pertences nem pessoas.</p>}

      {emVisita && (
        <>
          {/* Item 8: os 9 grupos em passos; a internet e o ruído são medidos no próprio passo. */}
          <Panel title="Itens" className="mb-6">
            <ChecklistAvaliador
              pedidoId={p.id}
              iniciais={iniciais}
              extras={{
                internet: (
                  <div data-testid="passo-internet-medir">
                    <p className="mb-2 text-sm font-semibold text-ink">Internet medida agora, no lugar</p>
                    <MedirInternetAvaliacao pedidoId={p.id} simulado={integracoesSimuladas()} />
                  </div>
                ),
                ruido: (
                  <div data-testid="avaliacao-ruido">
                    <FormAcao acao={salvarRuidoVisita} className="grid gap-3" testid="avaliacao-ruido-form">
                      <input type="hidden" name="pedidoId" value={p.id} />
                      {PERGUNTAS_RUIDO.map((q) => (
                        <fieldset key={q.chave} className="text-sm">
                          <legend className="text-ink">{q.texto}</legend>
                          <div className="mt-1 flex gap-4">
                            <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name={q.chave} value="sim" defaultChecked={ruido?.[q.chave] === true} required className="h-4 w-4 accent-forest" /> Sim</label>
                            <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name={q.chave} value="nao" defaultChecked={ruido ? ruido[q.chave] === false : false} className="h-4 w-4 accent-forest" /> Não</label>
                          </div>
                        </fieldset>
                      ))}
                      <Button type="submit" size="sm" variant="secondary" className="justify-self-start">Salvar ruído</Button>
                    </FormAcao>
                    <FormAcao acao={registrarMedicao} className="mt-4 flex flex-wrap items-end gap-2" testid="avaliacao-dba-form">
                      <input type="hidden" name="pedidoId" value={p.id} />
                      <input type="hidden" name="tipo" value="ruido_dba" />
                      <label className="min-w-0 flex-1 text-sm">dB(A) medido (apoio interno, nunca publicado)<input name="dba" inputMode="decimal" className={campo} /></label>
                      <Button type="submit" size="sm" variant="secondary">Guardar dB(A)</Button>
                    </FormAcao>
                  </div>
                ),
              }}
            />
          </Panel>

          <Panel title="Fotos dos cômodos" className="mb-6" data-testid="avaliacao-fotos">
            <p className="text-sm text-muted">Uma foto por cômodo. A foto de item não conforme sai no próprio item, acima. Sem pessoas e sem pertences; a localização da foto é apagada no envio.</p>
            <p className="mt-1 text-xs text-muted" data-testid="avaliacao-fotos-contagem">{fotosLista.length} foto(s) enviada(s).</p>
            <FormAcao acao={enviarFotoAvaliacao} className="mt-3 grid gap-2" testid="avaliacao-foto-form">
              <input type="hidden" name="pedidoId" value={p.id} />
              <label className="text-sm">Cômodo<input name="comodo" placeholder="Ex.: quarto principal" required className={campo} /></label>
              <label className="text-sm">Foto<input type="file" name="foto" accept="image/jpeg,image/png,image/webp" capture="environment" required className={campo} /></label>
              <Button type="submit" size="sm" variant="secondary" className="justify-self-start">Enviar foto</Button>
            </FormAcao>
          </Panel>

          <Panel title={p.status === "agendado" ? "Concluir a visita" : "Revisar e enviar o laudo"} className="mb-6" data-testid="avaliacao-concluir" data-status={p.status}>
            {p.status === "agendado" ? (
              <FormAcao acao={concluirVisita} testid="concluir-visita">
                <input type="hidden" name="pedidoId" value={p.id} />
                <p className="text-sm text-muted">Conclua quando todos os passos estiverem respondidos. Depois, revise e envie o laudo em até 48 horas úteis.</p>
                <Button type="submit" size="sm" className="mt-2">Concluir a visita</Button>
              </FormAcao>
            ) : (
              <>
                {/* Item 9: revisão antes de emitir — o resumo por grupo, os não conformes, o resultado e o prazo. */}
                <div data-testid="laudo-revisao" data-resultado={previsto.resultado}>
                  <p className="text-sm text-ink">
                    Resultado pelo checklist: <span className="font-semibold" data-testid="laudo-revisao-resultado">{ROTULO_RESULTADO[previsto.resultado]}</span>
                  </p>
                  {prazo && (
                    <p className={`mt-1 text-sm ${prazo.vencido ? "font-semibold text-red-700" : "text-muted"}`} data-testid="laudo-prazo">
                      {prazo.texto}
                    </p>
                  )}
                  <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2" data-testid="laudo-revisao-grupos">
                    {resumo.map((g) => (
                      <li key={g.grupo} className="flex justify-between gap-3 border-b border-line py-1" data-testid="laudo-revisao-grupo" data-nc={g.naoConformes.length}>
                        <span className="text-ink">{g.rotulo}</span>
                        <span className={g.naoConformes.length ? "text-amber-700" : "text-muted"}>{linhaResumoGrupo(g)}</span>
                      </li>
                    ))}
                  </ul>
                  {previsto.naoConformes.length > 0 && (
                    <div className="mt-3 text-sm" data-testid="laudo-revisao-nc">
                      <p className="font-semibold text-ink">Não conformes</p>
                      <ul className="mt-1 list-disc pl-4 text-ink">
                        {previsto.naoConformes.map((chave) => (
                          <li key={chave}>
                            {itemChecklist(chave)?.rotulo ?? chave}
                            {observacoes.get(chave) ? <span className="text-muted"> · {observacoes.get(chave)}</span> : null}
                            <span className="text-muted"> · {fotosLista.filter((f) => f.item_chave === chave).length} foto(s)</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-muted" data-testid="laudo-delimitacao">{DELIMITACAO_LAUDO}</p>
                </div>
                <FormAcao acao={enviarLaudo} className="mt-4" testid="enviar-laudo">
                  <input type="hidden" name="pedidoId" value={p.id} />
                  <p className="text-sm text-muted">Ao enviar, a plataforma emite o laudo VIS com este resultado. Confira antes: depois de emitido, só a reverificação ou a contestação mudam o laudo.</p>
                  <Button type="submit" size="sm" className="mt-2">Enviar o laudo</Button>
                </FormAcao>
              </>
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
