import { notFound, redirect } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { SeletorArquivo } from "@/components/ui/seletor-arquivo";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { SeloAssinatura } from "@/components/vistoria/selo-assinatura";
import { FormAcao } from "@/components/vistoria/form-acao";
import { ChecklistAvaliador } from "@/components/vistoria/checklist-avaliador";
import { VisitaEmAndamento } from "@/components/avaliadores/visita";
import { MedirInternetAvaliacao } from "@/components/vistoria/medir-internet-avaliacao";
import { integracoesSimuladas } from "@/lib/integracoes";
import { PERGUNTAS_RUIDO } from "@/config/niveis";
import { DELIMITACAO_LAUDO, ROTULO_VALOR, itemChecklist, valoresDoItem, type ValorItem } from "@/config/checklist-avaliacao";
import { vistoriaAtiva } from "@/lib/vistoria/chave";
import { ROTULO_RESULTADO, itensSemResposta, resultadoAvaliacao, resumoPorGrupo, type Resultado } from "@/lib/vistoria/laudo";
import { linhaResumoGrupo, prazoDoLaudo } from "@/lib/vistoria/telas-laudo";
import { NIVEIS } from "@/config/niveis";
import { ROTULO_CAMPO_NIVEL, ROTULO_NIVEL_LAUDO, linhaNivelSustentado } from "@/lib/vistoria/nivel-do-laudo";
import { faltasDoRoteiro, msgRoteiroIncompleto, roteiroDaVisita, tituloDaVisita, visitaEmAndamento } from "@/lib/vistoria/visita-avaliador";
import { DESCRICAO_NIVEL_LAUDO, ROTULO_ASSINAR_LAUDO, SUBTITULO_LAUDO, TITULO_LAUDO, linhaChecklist, linhaFotos } from "@/lib/vistoria/laudo-avaliador";
import { BOTAO_ASSINAR_LAUDO, CARTAO_NIVEL_LAUDO, LINHA_RESUMO_LAUDO, MARCA_NIVEL_LAUDO, MARCA_RESUMO_LAUDO, RESUMO_LAUDO, TEXTO_NIVEL_LAUDO, TITULO_NIVEL_LAUDO } from "@/lib/conta/visual-mockup";
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
    admin.from("vistoria_laudos").select("id, numero, versao, resultado, ressalvas, graves, prazo_ressalva_ate, corrigido_em, ressalva_vencida_em, contestado_em, assinado_em, assinatura_hash, nivel_sustentado").eq("pedido_versao_id", p.id).order("versao", { ascending: false }).limit(1),
    admin.from("vistoria_checklist_fotos").select("item_chave, comodo, path, criado_em").eq("pedido_id", p.id).order("criado_em"),
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
    assinado_em: string | null;
    assinatura_hash: string | null;
    nivel_sustentado: string | null;
  } | null;
  const emVisita = ["agendado", "realizada"].includes(p.status as string);
  const ruido = (p.ruido_respostas ?? null) as Record<string, boolean> | null;
  const fotosLista = (fotos ?? []) as { item_chave: string | null; comodo: string | null; path: string }[];
  // Revisão antes de emitir (item 9): o mesmo cálculo do laudo, sobre as respostas salvas.
  const respostasSalvas = Object.fromEntries(Object.entries(iniciais).map(([k, v]) => [k, v.valor]));
  const observacoes = new Map(Object.entries(iniciais).map(([k, v]) => [k, v.observacao]));
  const previsto = resultadoAvaliacao(respostasSalvas);
  const resumo = resumoPorGrupo(respostasSalvas);
  const visitaEm = (p.visita_concluida_em as string | null) ?? (p.agendado_para as string | null);
  const prazo = p.status === "realizada" && visitaEm ? prazoDoLaudo(visitaEm, new Date()) : null;

  // E1079 (fatia 5): na etapa do laudo (visita concluída, laudo por assinar) a tela é a do desenho — "Laudo da avaliação",
  // os níveis em cartões, o resumo e "Assinar laudo" — e este bloco vem ANTES do checklist. Durante a visita, vem depois.
  const naEtapaDoLaudo = p.status === "realizada";
  // E1079 (fatia 4): durante a visita (agendada, por concluir) a tela abre com o bloco do desenho — a foto do imóvel, o
  // roteiro marcado pelas fotos de cômodo já enviadas e a grade "Fotos do imóvel". As miniaturas saem por URL assinada de
  // 10 minutos (o caminho no bucket não vai para a tela); a capa é a 1ª foto do anúncio. Se uma leitura falhar, o bloco
  // aparece sem a imagem — nunca derruba a visita.
  const agendada = p.status === "agendado";
  // ORDEM-DUET-431/435: "em andamento" só a partir do dia marcado; antes, "Visita agendada". O roteiro TRAVA a conclusão.
  const emAndamento = visitaEmAndamento(p.status as string, p.agendado_para as string | null, new Date());
  const roteiro = roteiroDaVisita(fotosLista.map((f) => f.comodo));
  const faltasRoteiro = agendada ? faltasDoRoteiro(roteiro) : [];
  const fotosDeComodo = agendada ? fotosLista.filter((f) => f.comodo) : [];
  const assinadas = fotosDeComodo.length ? ((await admin.storage.from("avaliacao-imovel").createSignedUrls(fotosDeComodo.map((f) => f.path), 600)).data ?? []) : [];
  const miniaturas = fotosDeComodo.flatMap((f, i) => (assinadas[i]?.signedUrl ? [{ url: assinadas[i].signedUrl, comodo: f.comodo as string }] : []));
  const { data: capas } = agendada ? await admin.from("property_photos").select("url").eq("property_id", p.property_id).order("sort_order", { ascending: true }).limit(1) : { data: null };
  const capaUrl = ((capas ?? [])[0] as { url: string } | undefined)?.url;
  const tipoRotulo = p.tipo === "verificacao" ? "Verificação aberta pela Viva" : p.tipo === "contestacao" ? "2ª avaliação (contestação)" : undefined;
  const resumoLaudo = [linhaFotos(fotosLista.length), linhaChecklist(itensSemResposta(respostasSalvas).length)];
  const fecho = (
      <Panel title={p.status === "agendado" ? "Concluir a visita" : undefined} className="mb-6" data-testid="avaliacao-concluir" data-status={p.status}>
        {p.status === "agendado" ? (
          <FormAcao acao={concluirVisita} testid="concluir-visita">
            <input type="hidden" name="pedidoId" value={p.id} />
            <p className="text-sm text-muted">Conclua quando todos os passos estiverem respondidos. Depois, revise e envie o laudo em até 48 horas úteis.</p>
            {faltasRoteiro.length > 0 && (
              <p className="mt-2 text-sm text-ink" role="status" data-testid="concluir-faltas">{msgRoteiroIncompleto(faltasRoteiro)}</p>
            )}
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
              <p className="text-sm text-muted">Ao enviar, o laudo VIS é emitido e assinado por você, com este resultado. Confira antes: depois de emitido, só a reverificação ou a contestação mudam o laudo.</p>
              <SeletorNivelLaudo obrigatorio />
              <ul className={`mt-4 ${RESUMO_LAUDO}`} data-testid="laudo-resumo">
                {resumoLaudo.map((l) => (
                  <li key={l.texto} className={LINHA_RESUMO_LAUDO} data-ok={l.ok ? "sim" : "nao"}>
                    <span className={MARCA_RESUMO_LAUDO[l.ok ? "ok" : "falta"]} aria-hidden>
                      {l.ok ? <Check className="h-4 w-4" strokeWidth={3} /> : <Minus className="h-4 w-4" strokeWidth={3} />}
                    </span>
                    {l.texto}
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex items-start gap-2 text-sm text-ink" data-testid="assino-laudo">
                <input type="checkbox" name="assino" required className="mt-1 h-4 w-4 accent-forest" />
                <span>Assino este laudo como avaliador e respondo pelo que consta nele. A Viva forneceu o modelo e guarda o registro (número e hash); o conteúdo é meu.</span>
              </label>
              <Button type="submit" className={`mt-4 ${BOTAO_ASSINAR_LAUDO}`}>{ROTULO_ASSINAR_LAUDO}</Button>
            </FormAcao>
          </>
        )}
      </Panel>
  );

  return (
    <>
      <PageTitle title={agendada ? tituloDaVisita(emAndamento) : naEtapaDoLaudo ? TITULO_LAUDO : "Checklist da avaliação"} subtitle={naEtapaDoLaudo ? [tipoRotulo, SUBTITULO_LAUDO].filter(Boolean).join(" · ") : tipoRotulo} />
      <ButtonLink href="/dashboard/parceiro/avaliacao" variant="ghost" size="sm" className="mb-4">Voltar às avaliações</ButtonLink>
      {p.ocupado && <p className="mb-4 text-sm text-ink">Imóvel ocupado: a visita só acontece com o morador de acordo. Não fotografe pertences nem pessoas.</p>}

      {emVisita && (
        <>
          {agendada && <VisitaEmAndamento capaUrl={capaUrl} roteiro={roteiro} fotos={miniaturas} />}
          {naEtapaDoLaudo && fecho}
          {/* Item 8: os 9 grupos em passos; a internet e o ruído são medidos no próprio passo. */}
          <Panel id="itens" title="Itens" className="mb-6 scroll-mt-16">
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

          <Panel id="enviar-foto" title="Fotos dos cômodos" className="mb-6 scroll-mt-16" data-testid="avaliacao-fotos">
            <p className="text-sm text-muted">Uma foto por cômodo. A foto de item não conforme sai no próprio item, acima. Sem pessoas e sem pertences; a localização da foto é apagada no envio.</p>
            <p className="mt-1 text-xs text-muted" data-testid="avaliacao-fotos-contagem">{fotosLista.length} foto(s) enviada(s).</p>
            <FormAcao acao={enviarFotoAvaliacao} className="mt-3 grid gap-2" testid="avaliacao-foto-form">
              <input type="hidden" name="pedidoId" value={p.id} />
              <label className="text-sm">Cômodo<input name="comodo" placeholder="Ex.: quarto principal" required className={campo} /></label>
              <div className="grid gap-1 text-sm"><p>Foto</p><SeletorArquivo name="foto" accept="image/jpeg,image/png,image/webp" capture="environment" required rotulo="Tirar ou escolher foto" ariaLabel="Foto" /></div>
              <Button type="submit" size="sm" variant="secondary" className="justify-self-start">Enviar foto</Button>
            </FormAcao>
          </Panel>

          {!naEtapaDoLaudo && fecho}
        </>
      )}

      {laudo && (
        <Panel title={`Laudo ${laudo.numero}${laudo.versao > 1 ? ` v${laudo.versao}` : ""}`} data-testid="avaliador-laudo" data-resultado={laudo.resultado}>
          <p className="text-sm text-ink">Resultado: {ROTULO_RESULTADO[laudo.resultado]}</p>
          {/* E1092: o nível que o avaliador escolheu e assinou — a mesma linha do PDF e o mesmo valor que o dono vê. */}
          {linhaNivelSustentado(laudo.nivel_sustentado) && (
            <p className="text-sm font-semibold text-ink" data-testid="avaliador-laudo-nivel">{linhaNivelSustentado(laudo.nivel_sustentado)}</p>
          )}
          <a href={`/api/vistoria/laudo/${laudo.id}`} className="mt-1 inline-block text-sm underline">Baixar o PDF</a>
          <SeloAssinatura laudo={{ numero: laudo.numero, versao: laudo.versao, assinadoEm: laudo.assinado_em, assinaturaHash: laudo.assinatura_hash }} quem="avaliador" />
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
              <SeletorNivelLaudo obrigatorio padrao={laudo.nivel_sustentado} comRotulo />
              <label className="flex items-start gap-2 text-sm text-ink" data-testid="assino-laudo">
                    <input type="checkbox" name="assino" required className="mt-1 h-4 w-4 accent-forest" />
                    <span>Assino este laudo como avaliador e respondo pelo que consta nele. A Viva forneceu o modelo e guarda o registro (número e hash); o conteúdo é meu.</span>
                  </label>
                  <Button type="submit" size="sm">Confirmar a reverificação</Button>
            </FormAcao>
          )}
        </Panel>
      )}
    </>
  );
}

/**
 * E1083 (ORDEM-DUET-397/399): o nível do imóvel é o que o AVALIADOR escolhe no laudo que assina (Essencial, Conforto ou
 * Premium), pelos critérios públicos e com base nas fotos da visita. A plataforma não calcula o nível do laudo.
 */
function SeletorNivelLaudo({ obrigatorio, padrao, comRotulo = false }: { obrigatorio: boolean; padrao?: string | null; comRotulo?: boolean }) {
  const inicial = padrao && (NIVEIS as readonly string[]).includes(padrao) ? padrao : "";
  // E1079 (fatia 5): os três níveis em cartões de escolha, como no desenho. O campo é o mesmo ("nivel", obrigatório).
  return (
    <fieldset className="mt-3" data-testid="laudo-nivel">
      <legend className={comRotulo ? "mb-2 text-sm text-ink" : "sr-only"}>{ROTULO_CAMPO_NIVEL}</legend>
      <div className="grid gap-3">
        {NIVEIS.map((n) => (
          <label key={n} className={CARTAO_NIVEL_LAUDO} data-testid={`laudo-nivel-${n}`}>
            <span className="min-w-0">
              <span className={TITULO_NIVEL_LAUDO}>{ROTULO_NIVEL_LAUDO[n]}</span>
              <span className={TEXTO_NIVEL_LAUDO}>{DESCRICAO_NIVEL_LAUDO[n]}</span>
            </span>
            <input type="radio" name="nivel" value={n} defaultChecked={inicial === n} required={obrigatorio} className="sr-only" />
            <span className={MARCA_NIVEL_LAUDO} aria-hidden>
              <Check className="h-6 w-6" strokeWidth={3} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
