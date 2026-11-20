import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CampoDataHoraFormulario } from "@/components/ui/campo-data";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { LaudoDono } from "@/components/vistoria/laudo-dono";
import { brl } from "@/lib/fiscal/documento";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { textoTaxaServicoParceiros } from "@/config/taxa-servico-parceiros";
import { vistoriaAtiva } from "@/lib/vistoria/chave";
import { ROTAS_NIVEL, TITULO_BLOCO_DONO, blocoDoDonoVisivel, hrefAvaliador, linhaDoTempoPedido, quandoVisitaComFuso, situacaoDono, situacaoPagamento } from "@/lib/vistoria/telas-exibicao";
import { agendarVisita, aceitarProposta, avaliarConduta, confirmarRecebido, escolherAvaliador, pedirAvaliacao, recusarProposta, registrarAusencia } from "@/lib/vistoria/actions";
import { PRAZO_DONO_ACEITAR_HORAS, PRAZO_RESPOSTA_PADRAO_HORAS, faixaDeReferencia, linhaDeTermos } from "@/lib/vistoria/escolha";
import { sugeridosDoPedido } from "@/lib/vistoria/servidor";
import {
  COLUNAS_PRECO,
  CONDUTA_DONO,
  FRASE_PAGA_AVALIACAO,
  INCLUI_SEMPRE,
  ROTULO_CONDUTA,
  ROTULO_PORTE,
  TEXTO_NOVA_AVALIACAO,
  linhaDaTabela,
  pedidoPodeAbrir,
  porteDoImovel,
  precoVigente,
  textoCondicaoRetorno,
  valorDoPedido,
  type LinhaPreco,
} from "@/lib/vistoria/regras";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";

/**
 * "Pedir avaliação do imóvel" em Meus imóveis › imóvel › Nível, ruído e extras (62-B1; desenho do 62-A, Parte 1: as duas
 * rotas lado a lado, a linha do tempo do pedido, a agenda pelas mensagens e o pagamento direto registrado). Com VISTORIA_ATIVA desligada, não aparece nada. E648: a Viva SUGERE os avaliadores e o dono ESCOLHE; o avaliador responde com o próprio valor e prazo e o dono aceita. Com a chave desligada, só o dono de conta de
 * teste vê o bloco, só leitura (massa do QA ao vivo, E235).
 */
export async function BlocoAvaliacaoDono({ propertyId }: { propertyId: string }) {
  const chaveAtiva = await vistoriaAtiva();
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = chaveAtiva ? { data: null } : await admin.from("profiles").select("is_teste").eq("id", user.id).maybeSingle();
  const visivel = blocoDoDonoVisivel(chaveAtiva, (perfil as { is_teste?: boolean | null } | null)?.is_teste);
  if (!visivel) return null;
  const { data: im } = await admin.from("properties").select("id, owner_id, status, city, bedrooms").eq("id", propertyId).maybeSingle();
  if (!im || im.owner_id !== user.id) return null;
  const agora = new Date();
  const porte = porteDoImovel(im.bedrooms as number);
  const [{ data: tabela }, { data: pedidos }, { data: ultimoLaudo }] = await Promise.all([
    admin.from("vistoria_precos").select(COLUNAS_PRECO).eq("cidade", im.city ?? ""),
    admin
      .from("vistoria_pedidos")
      .select("id, status, aguardando_avaliador, agendado_para, ocupado, concordancia_em, recebido_marcado_em, recebido_confirmado_em, valor_proposto, prazo_proposto_dias, proposta_em, proposta_aceita_em, teste, avaliadores_credenciamento(numero_credenciado, prazo_resposta_horas)")
      .eq("property_id", propertyId)
      .order("criado_em", { ascending: false })
      .limit(1),
    admin.from("vistoria_laudos").select("resultado, emitido_em, ressalva_vencida_em").eq("property_id", propertyId).order("emitido_em", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const linhas: LinhaPreco[] = ((tabela ?? []) as Parameters<typeof linhaDaTabela>[0][]).map(linhaDaTabela);
  const preco = precoVigente(linhas, im.city ?? "", porte, agora);
  // Adendo 62-B1: depois de "reprovado" ou de ressalva vencida é NOVA AVALIAÇÃO; a condição de retorno só aparece se existir.
  const desdeNova = ultimoLaudo?.resultado === "reprovado" ? (ultimoLaudo.emitido_em as string) : ((ultimoLaudo?.ressalva_vencida_em as string | null | undefined) ?? null);
  const cobranca = preco ? valorDoPedido(desdeNova ? "nova_avaliacao" : "inicial", preco, desdeNova, agora) : null;
  const condicao = textoCondicaoRetorno(cobranca?.retorno ?? null);
  const { data: bloq } = await admin.from("vistoria_bloqueios").select("id").eq("property_id", propertyId).is("resolvido_em", null).limit(1);
  const pode = pedidoPodeAbrir({ chaveAtiva: visivel === "ativa", anuncioPublicado: im.status === "active" || !!bloq?.length, preco });
  const atual = ((pedidos ?? [])[0] ?? null) as unknown as {
    id: string;
    status: string;
    aguardando_avaliador: boolean;
    agendado_para: string | null;
    ocupado: boolean;
    concordancia_em: string | null;
    recebido_marcado_em: string | null;
    recebido_confirmado_em: string | null;
    valor_proposto: number | string | null;
    prazo_proposto_dias: number | null;
    proposta_em: string | null;
    proposta_aceita_em: string | null;
    teste: boolean;
    avaliadores_credenciamento: { numero_credenciado: string; prazo_resposta_horas: number | null } | null;
  } | null;
  // E648: quem o dono pode escolher (sugeridos pela Viva). Uma leitura que falha mostra o aviso, nunca "ninguém".
  let sugeridos: { id: string; numero: string; nome: string; termos: string }[] | null = [];
  if (atual?.status === "pedido" && !atual.aguardando_avaliador && visivel === "ativa") {
    try {
      const lista = (await sugeridosDoPedido(admin, atual.id, agora)) ?? [];
      const { data: dados, error: erroDados } = lista.length ? await admin.from("avaliadores_credenciamento").select("id, numero_credenciado, preco_proprio, prazo_entrega_dias, prazo_resposta_horas, parceiros(nome_publico)").in("id", lista.map((a) => a.id)) : { data: [], error: null };
      if (erroDados) throw new Error(erroDados.message);
      const porId = new Map(((dados ?? []) as unknown as { id: string; numero_credenciado: string; preco_proprio: number | string | null; prazo_entrega_dias: number | null; prazo_resposta_horas: number | null; parceiros: { nome_publico: string | null } | null }[]).map((d) => [d.id, d]));
      // E682: reputação = conduta PUBLICADA (a função pública conta só as avaliações já publicadas, às cegas).
      const { data: publicos, error: erroPublicos } = await admin.rpc("avaliadores_publicos");
      if (erroPublicos) throw new Error(erroPublicos.message);
      const conduta = new Map(((publicos ?? []) as { numero_credenciado: string; nota_conduta: number | string | null; avaliacoes_feitas: number }[]).map((x) => [x.numero_credenciado, x]));
      sugeridos = lista.map((a) => {
        const d = porId.get(a.id);
        const pub = conduta.get(d?.numero_credenciado ?? "");
        const nota = pub?.nota_conduta != null ? Number(pub.nota_conduta) : null;
        return {
          id: a.id,
          numero: d?.numero_credenciado ?? "",
          nome: d?.parceiros?.nome_publico ?? "Avaliador",
          termos: linhaDeTermos({
            notaConduta: nota,
            avaliacoesConduta: nota != null ? Math.max(1, Number(pub?.avaliacoes_feitas ?? 0)) : 0,
          }),
        };
      });
    } catch {
      sugeridos = null;
    }
  }
  const faixa = atual && preco ? faixaDeReferencia(Number(preco.valor)) : null;
  const propostaForaDaFaixa = atual?.valor_proposto != null && faixa ? Number(atual.valor_proposto) < faixa.min || Number(atual.valor_proposto) > faixa.max : false;
  // Prompt 62-B2: com o laudo emitido, o pedido fecha e "Pedir nova avaliação" volta (o laudo aparece acima).
  const aberto = atual && ["pedido", "designado", "agendado", "realizada"].includes(atual.status);

  return (
    <section id="avaliacao" className="mt-8 scroll-mt-24">
      <Panel title={TITULO_BLOCO_DONO} data-testid="avaliacao-dono">
        {visivel === "so_leitura_teste" && (
          <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted" data-testid="avaliacao-modo-teste">
            Conta de teste: a avaliação ainda não está aberta ao público. Este bloco é só para conferência (as ações não rodam).
          </p>
        )}
        <LaudoDono admin={admin} propertyId={propertyId} ownerId={user.id} />
        {atual?.status === "laudo_emitido" && (
          <div className="mb-4 text-sm" data-testid="avaliacao-dono-pedido" data-status={atual.status}>
            {atual.recebido_marcado_em && !atual.recebido_confirmado_em && (
              <FormAcao acao={confirmarRecebido} className="mt-2">
                <input type="hidden" name="pedidoId" value={atual.id} />
                <Button type="submit" variant="secondary" size="sm">Confirmar que paguei o avaliador</Button>
              </FormAcao>
            )}
            <FormAcao acao={avaliarConduta} className="mt-3 flex flex-wrap items-end gap-2" testid="conduta-dono">
              <input type="hidden" name="pedidoId" value={atual.id} />
              {CONDUTA_DONO.map((c) => (
                <label key={c} className="text-sm">{ROTULO_CONDUTA[c]}<select name={`nota_${c}`} className={campo} defaultValue="5">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              ))}
              <input name="comentario" placeholder="Comentário sobre a conduta na visita (opcional)" aria-label="Comentário" className={campo} />
              <Button type="submit" variant="secondary" size="sm">Avaliar a conduta</Button>
            </FormAcao>
          </div>
        )}
        {aberto && atual ? (
          <div className="grid gap-4 text-sm" data-testid="avaliacao-dono-pedido" data-status={atual.status}>
            {situacaoDono({ status: atual.status, aguardandoAvaliador: atual.aguardando_avaliador, ocupado: atual.ocupado, concordanciaEm: atual.concordancia_em, agendadoPara: atual.agendado_para }) && (
              <p className="text-ink" data-testid="avaliacao-situacao">
                {situacaoDono({ status: atual.status, aguardandoAvaliador: atual.aguardando_avaliador, ocupado: atual.ocupado, concordanciaEm: atual.concordancia_em, agendadoPara: atual.agendado_para })}
              </p>
            )}
            {atual.avaliadores_credenciamento && (
              <p className="text-ink" data-testid="avaliador-designado">
                Avaliador escolhido por você: nº{" "}
                <Link href={hrefAvaliador(atual.avaliadores_credenciamento.numero_credenciado)} className="underline" data-testid="avaliador-designado-link">
                  {atual.avaliadores_credenciamento.numero_credenciado}
                </Link>
              </p>
            )}
            {atual.status === "pedido" && !atual.aguardando_avaliador && (
              <div className="rounded-lg border border-line p-3" data-testid="avaliacao-escolha">
                <p className="font-semibold text-ink">Escolha o avaliador</p>
                {faixa && (
                  <p className="mt-1 text-muted" data-testid="avaliacao-faixa">
                    Referência da cidade: {brl(faixa.referencia)} (faixa de {brl(faixa.min)} a {brl(faixa.max)}). Cada avaliador define o próprio valor e prazo e você aceita ou escolhe outro.
                  </p>
                )}
                {sugeridos === null ? (
                  <p className="mt-2 text-red-700" role="alert" data-testid="avaliacao-escolha-falhou">Não foi possível carregar os avaliadores agora. Atualize a página para tentar de novo.</p>
                ) : sugeridos.length === 0 ? (
                  <p className="mt-2 text-muted" data-testid="avaliacao-escolha-vazia">Nenhum avaliador disponível agora. A Viva avisa quando houver.</p>
                ) : (
                  <ul className="mt-2 grid gap-2">
                    {sugeridos.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2" data-testid="avaliacao-sugerido">
                        <span className="text-ink">
                          {a.nome} · nº{" "}
                          <Link href={hrefAvaliador(a.numero)} className="underline">
                            {a.numero}
                          </Link>
                          <span className="block text-xs text-muted" data-testid="avaliacao-sugerido-termos">{a.termos}</span>
                        </span>
                        <FormAcao acao={escolherAvaliador} testid="escolher-avaliador">
                          <input type="hidden" name="pedidoId" value={atual.id} />
                          <input type="hidden" name="avaliadorId" value={a.id} />
                          <Button type="submit" variant="secondary" size="sm">Escolher este avaliador</Button>
                        </FormAcao>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {atual.status === "designado" && !atual.proposta_em && (
              <p className="text-muted" data-testid="avaliacao-aguarda-proposta">O avaliador tem {atual.avaliadores_credenciamento?.prazo_resposta_horas ?? PRAZO_RESPOSTA_PADRAO_HORAS} horas para responder com o valor e o prazo dele. Sem resposta, você escolhe outro.</p>
            )}
            {atual.status === "designado" && atual.proposta_em && !atual.proposta_aceita_em && (
              <div className="rounded-lg border border-line p-3" data-testid="avaliacao-proposta">
                <p className="font-semibold text-ink">
                  Proposta do avaliador: {brl(Number(atual.valor_proposto))} · laudo em {atual.prazo_proposto_dias} {atual.prazo_proposto_dias === 1 ? "dia" : "dias"}
                </p>
                <p className="mt-1 text-muted" data-testid="avaliacao-proposta-prazo">Aceite em até {PRAZO_DONO_ACEITAR_HORAS} horas depois da proposta; passado o prazo, você escolhe outro avaliador.</p>
                {propostaForaDaFaixa && faixa && (
                  <p className="mt-1 text-muted" data-testid="avaliacao-proposta-fora">Fora da faixa de referência da cidade ({brl(faixa.min)} a {brl(faixa.max)}). Você decide.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <FormAcao acao={aceitarProposta} testid="aceitar-proposta">
                    <input type="hidden" name="pedidoId" value={atual.id} />
                    <Button type="submit" variant="secondary" size="sm">Aceitar valor e prazo</Button>
                  </FormAcao>
                  <FormAcao acao={recusarProposta} testid="recusar-proposta">
                    <input type="hidden" name="pedidoId" value={atual.id} />
                    <Button type="submit" variant="secondary" size="sm">Escolher outro avaliador</Button>
                  </FormAcao>
                </div>
              </div>
            )}
            {atual.status === "designado" && atual.proposta_aceita_em && (
              <p className="text-ink" data-testid="avaliacao-proposta-aceita">
                Combinado com o avaliador: {brl(Number(atual.valor_proposto))} · laudo em {atual.prazo_proposto_dias} {atual.prazo_proposto_dias === 1 ? "dia" : "dias"}.
              </p>
            )}
            <ol className="grid gap-2" data-testid="avaliacao-linha-tempo">
              {linhaDoTempoPedido({ status: atual.status, numero: atual.avaliadores_credenciamento?.numero_credenciado, agendadoPara: atual.agendado_para, aguardandoAvaliador: atual.aguardando_avaliador }).map((e) => (
                <li key={e.chave} className="flex items-start gap-2" data-testid={`etapa-${e.chave}`} data-estado={e.estado}>
                  {e.estado === "feito" ? <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden /> : <Circle className={`mt-1 h-4 w-4 shrink-0 ${e.estado === "atual" ? "fill-forest text-forest" : "text-line"}`} aria-hidden />}
                  <span className={e.estado === "futuro" ? "text-muted" : "font-semibold text-ink"}>{e.rotulo}</span>
                </li>
              ))}
            </ol>
            {atual.agendado_para && (
              <p className="text-muted" data-testid="avaliacao-visita">
                Visita: {quandoVisitaComFuso(atual.agendado_para)}
                {atual.ocupado && !atual.concordancia_em ? " · aguardando a concordância do morador" : ""}
              </p>
            )}
            <p className="text-muted">
              Combine a agenda pelas{" "}
              <Link href="/dashboard/mensagens" className="font-semibold text-forest underline underline-offset-2" data-testid="avaliacao-mensagens">
                mensagens da Viva
              </Link>
              .
            </p>
            {["designado", "agendado"].includes(atual.status) && atual.avaliadores_credenciamento && (atual.proposta_aceita_em || atual.teste) && (
              <FormAcao acao={agendarVisita} className="flex flex-wrap items-end gap-2" testid="dono-agendar">
                <input type="hidden" name="pedidoId" value={atual.id} />
                <label className="text-sm">Data e hora da visita<CampoDataHoraFormulario name="quando" required className={campo} /></label>
                <Button type="submit" variant="secondary" size="sm">{atual.agendado_para ? "Reagendar" : "Propor data"}</Button>
                {atual.agendado_para && <span className="w-full text-xs text-muted">Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso.</span>}
              </FormAcao>
            )}
            {atual.status === "agendado" && (
              <FormAcao acao={registrarAusencia} testid="ausencia-avaliador">
                <input type="hidden" name="pedidoId" value={atual.id} />
                <input type="hidden" name="quem" value="avaliador" />
                <Button type="submit" variant="secondary" size="sm">O avaliador não veio</Button>
              </FormAcao>
            )}
            <div className="rounded-lg border border-line p-3" data-testid="avaliacao-pagamento">
              <p className="text-ink">{situacaoPagamento({ recebidoMarcadoEm: atual.recebido_marcado_em, recebidoConfirmadoEm: atual.recebido_confirmado_em })}</p>
              <p className="mt-1 text-xs text-muted">{textoTaxaServicoParceiros(PAGAMENTO_PARCEIROS_ATIVO)}</p>
              {atual.recebido_marcado_em && !atual.recebido_confirmado_em && (
                <FormAcao acao={confirmarRecebido} className="mt-2">
                  <input type="hidden" name="pedidoId" value={atual.id} />
                  <Button type="submit" variant="secondary" size="sm">Confirmar que paguei o avaliador</Button>
                </FormAcao>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 text-sm sm:grid-cols-2" data-testid="avaliacao-dono-pedir">
            <div className="rounded-xl border border-line p-4" data-testid="rota-foto">
              <h3 className="font-semibold text-ink">{ROTAS_NIVEL[0].titulo}</h3>
              <p className="mt-1 text-muted">{ROTAS_NIVEL[0].texto}</p>
              <a href="#nivel-itens" className="mt-2 inline-block font-semibold text-forest underline underline-offset-2">Ver os itens</a>
            </div>
            <div id="rota-avaliacao" className="rounded-xl border border-line p-4" data-testid="rota-avaliacao">
              <h3 className="font-semibold text-ink">{ROTAS_NIVEL[1].titulo}</h3>
              <p className="mt-1 text-muted">{ROTAS_NIVEL[1].texto}</p>
              <p className="mt-2 text-ink">Porte do anúncio: {ROTULO_PORTE[porte]}</p>
              {preco ? (
                <>
                  {desdeNova && <p className="mt-2 text-ink" data-testid="avaliacao-nova">{TEXTO_NOVA_AVALIACAO}</p>}
                  <p className="mt-1 font-semibold text-ink" data-testid="avaliacao-valor">
                    {desdeNova ? "Referência da nova avaliação" : "Referência da avaliação"}: {brl(cobranca?.valor ?? preco.valor)}
                    {condicao ? ` (tabela: ${brl(preco.valor)})` : ""}
                  </p>
                  {condicao && <p className="mt-1 text-muted" data-testid="avaliacao-retorno">{condicao}</p>}
                  <ul className="mt-2 list-disc pl-4 text-muted" data-testid="avaliacao-inclui">
                    {INCLUI_SEMPRE.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                    {preco.incluiTexto && <li>{preco.incluiTexto}</li>}
                  </ul>
                  <p className="mt-1 text-muted" data-testid="avaliacao-valor-proprio">Você escolhe o avaliador; ele define o próprio valor e prazo. Você só aceita depois de ver a proposta.</p>
                  <p className="mt-2 font-semibold text-ink" data-testid="frase-paga">{FRASE_PAGA_AVALIACAO}</p>
                  <p className="mt-1 text-xs text-muted">Você paga direto ao avaliador; a Viva registra. {textoTaxaServicoParceiros(PAGAMENTO_PARCEIROS_ATIVO)}</p>
                </>
              ) : null}
              {pode.ok ? (
                <FormAcao acao={pedirAvaliacao} className="mt-3" testid="pedir-avaliacao">
                  <input type="hidden" name="propertyId" value={propertyId} />
                  <Button type="submit" size="sm">{atual?.status === "laudo_emitido" ? "Pedir nova avaliação" : "Pedir avaliação do imóvel"}</Button>
                </FormAcao>
              ) : (
                <p className="mt-3 text-muted" data-testid="avaliacao-indisponivel">{pode.motivo}</p>
              )}
            </div>
          </div>
        )}
      </Panel>
    </section>
  );
}
