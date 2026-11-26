import Link from "next/link";
import { CheckCircle2, Circle, ShieldCheck, Star } from "lucide-react";
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
import { ROTAS_NIVEL, ROTULO_CONFIRMAR_PAGAMENTO_AO_AVALIADOR, TEXTO_PAGAMENTO_DIRETO_AO_AVALIADOR, TITULO_BLOCO_DONO, blocoDoDonoVisivel, hrefAvaliador, linhaDoTempoPedido, quandoVisitaComFuso, situacaoDono, situacaoPagamento } from "@/lib/vistoria/telas-exibicao";
import { concordanciaRecusada } from "@/lib/vistoria/concordancia";
import { agendarVisita, aceitarProposta, avaliarConduta, confirmarRecebido, escolherAvaliador, pedirAvaliacao, recusarProposta, registrarAusencia } from "@/lib/vistoria/actions";
import { PRAZO_RESPOSTA_PADRAO_HORAS, faixaDeReferencia, linhaDeTermos } from "@/lib/vistoria/escolha";
import { TEXTO_MESMO_AVALIADOR, textoDaEspera } from "@/lib/vistoria/espera-de-avaliador";
import { nomeDoAvaliador } from "@/lib/vistoria/nome-do-avaliador";
import { prazoCombinadoNaLinhaDoDono } from "@/lib/vistoria/pedido-avaliador";
import { NotaDiasUteis } from "@/components/ui/nota-dias-uteis";
import { prazoLaudo } from "@/lib/vistoria/laudo";
import { dataBRT } from "@/lib/datas-brasilia";
import { CONFIRMACAO_DO_ACEITE, aceitoSemDataDeVisita, prazoDoAceiteTerminou, precisaDoAceiteDoDono, relogioDoPedido, textoDoPrazoDeAceiteParaODono } from "@/lib/vistoria/relogio-do-pedido";
import { identidadesConfirmadas, nomesDasContas, outrosParaTroca, sugeridosDoPedido, tabelaDaCidade } from "@/lib/vistoria/servidor";
import { textoDaTroca } from "@/lib/vistoria/troca-de-avaliador";
import { DepoisDaTroca, TrocaDeAvaliador } from "@/components/vistoria/troca-de-avaliador";
import { ROTULO_ESCOLHER, TEXTO_IDENTIDADE_VERIFICADA, TITULO_ESCOLHA_AVALIADOR, fotoPublicaPermitida, fraseDoValorNaEscolha, reaisCurtos, reputacaoNoCartao, rostoDoAvaliador } from "@/lib/vistoria/vitrine-avaliadores";
import { signAvatarPath } from "@/lib/data/avatar-url";
import {
  CONDUTA_DONO,
  FRASE_PAGA_AVALIACAO,
  INCLUI_SEMPRE,
  ROTULO_AVALIADOR_CREDENCIADO,
  ROTULO_AVALIADOR_EM_TESTE,
  ROTULO_CONDUTA,
  ROTULO_PORTE,
  TEXTO_NOVA_AVALIACAO_NA_TELA,
  pedidoPodeAbrir,
  porteDoImovel,
  precoVigente,
  textoCondicaoRetorno,
  valorDoPedido,
  type LinhaPreco,
  REGRA_DO_REAGENDAMENTO,
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
  const [tabela, { data: pedidos }, { data: ultimoLaudo }] = await Promise.all([
    tabelaDaCidade(admin, im.city), // E1081: a cidade pela chave (sem acento, sem maiúsculas)
    admin
      .from("vistoria_pedidos")
      .select("id, status, aguardando_avaliador, motivo_da_espera, agendado_para, ocupado, concordancia_em, concordancia_pedida_em, recebido_marcado_em, recebido_confirmado_em, valor_proposto, prazo_proposto_dias, prazo_laudo_dias_uteis, visita_concluida_em, proposta_em, proposta_aceita_em, escolhido_em, teste, avaliadores_credenciamento(numero_credenciado, prazo_resposta_horas)")
      .eq("property_id", propertyId)
      .order("criado_em", { ascending: false })
      .limit(1),
    admin.from("vistoria_laudos").select("resultado, emitido_em, ressalva_vencida_em").eq("property_id", propertyId).order("emitido_em", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const linhas: LinhaPreco[] = tabela;
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
    motivo_da_espera: string | null;
    agendado_para: string | null;
    ocupado: boolean;
    concordancia_em: string | null;
    concordancia_pedida_em: string | null;
    recebido_marcado_em: string | null;
    recebido_confirmado_em: string | null;
    valor_proposto: number | string | null;
    prazo_proposto_dias: number | null;
    prazo_laudo_dias_uteis: number | null;
    visita_concluida_em: string | null;
    proposta_em: string | null;
    proposta_aceita_em: string | null;
    escolhido_em: string | null;
    teste: boolean;
    avaliadores_credenciamento: { numero_credenciado: string; prazo_resposta_horas: number | null } | null;
  } | null;
  // E1156: a visita com data firme (agendada ou feita) dá a data do laudo — o prazo combinado conta depois dela.
  const visitaComData = atual && ["agendado", "realizada"].includes(atual.status) ? (atual.visita_concluida_em ?? atual.agendado_para) : null;
  const laudoAteDoPedido = atual?.status === "realizada" && visitaComData ? dataBRT(prazoLaudo(visitaComData, atual.prazo_laudo_dias_uteis)) : null;
  // E1173: o morador disse que não pode na data proposta, e ainda não há data nova.
  const recusouAData = !!atual && concordanciaRecusada({ status: atual.status, ocupado: atual.ocupado, agendadoPara: atual.agendado_para, concordanciaPedidaEm: atual.concordancia_pedida_em, concordanciaEm: atual.concordancia_em });
  // E648: quem o dono pode escolher (sugeridos pela Viva). Uma leitura que falha mostra o aviso, nunca "ninguém".
  let sugeridos: { id: string; numero: string; nome: string; termos: string; reputacao: { novo: boolean; cheias: number; texto: string }; identidadeVerificada: boolean; teste: boolean; fotoUrl: string | null; mesmoDaAnterior: boolean }[] | null = [];
  if (atual?.status === "pedido" && !atual.aguardando_avaliador && visivel === "ativa") {
    try {
      const lista = (await sugeridosDoPedido(admin, atual.id, agora)) ?? [];
      const { data: dados, error: erroDados } = lista.length ? await admin.from("avaliadores_credenciamento").select("id, numero_credenciado, preco_proprio, prazo_entrega_dias, prazo_resposta_horas, parceiros(nome_publico, user_id)").in("id", lista.map((a) => a.id)) : { data: [], error: null };
      if (erroDados) throw new Error(erroDados.message);
      const porId = new Map(((dados ?? []) as unknown as { id: string; numero_credenciado: string; preco_proprio: number | string | null; prazo_entrega_dias: number | null; prazo_resposta_horas: number | null; parceiros: { nome_publico: string | null; user_id: string | null } | null }[]).map((d) => [d.id, d]));
      // E1084: o nome vem da conta (a mesma fonte do perfil e do laudo).
      const nomes = await nomesDasContas(admin, [...porId.values()].map((d) => d.parceiros?.user_id));
      // E682: reputação = conduta PUBLICADA (a função pública conta só as avaliações já publicadas, às cegas).
      const { data: publicos, error: erroPublicos } = await admin.rpc("avaliadores_publicos");
      if (erroPublicos) throw new Error(erroPublicos.message);
      const conduta = new Map(((publicos ?? []) as { numero_credenciado: string; nota_conduta: number | string | null; avaliacoes_feitas: number; teste?: boolean | null }[]).map((x) => [x.numero_credenciado, x]));
      // E1079 (386): a foto é a de perfil da conta; só a conta de teste a mostra (sem o Daniel, conta real = iniciais).
      // A foto nunca é obrigatória: sem a leitura, as iniciais.
      const uids = [...new Set([...porId.values()].map((d) => d.parceiros?.user_id).filter((x): x is string => !!x))];
      const { data: contas } = uids.length ? await admin.from("profiles").select("id, avatar_url, is_teste").in("id", uids) : { data: [] };
      const contaDe = new Map(((contas ?? []) as { id: string; avatar_url: string | null; is_teste: boolean | null }[]).map((c) => [c.id, c]));
      // E1096: "Identidade verificada pela Viva" só com o fato (a identidade confirmada da conta).
      const verificadas = await identidadesConfirmadas(admin, uids, agora);
      sugeridos = await Promise.all(lista.map(async (a) => {
        const d = porId.get(a.id);
        const uid = d?.parceiros?.user_id ?? "";
        const conta = contaDe.get(uid);
        const pub = conduta.get(d?.numero_credenciado ?? "");
        const nota = pub?.nota_conduta != null ? Number(pub.nota_conduta) : null;
        const teste = pub?.teste === true || conta?.is_teste === true;
        return {
          id: a.id,
          numero: d?.numero_credenciado ?? "",
          nome: nomeDoAvaliador(nomes.get(d?.parceiros?.user_id ?? ""), d?.parceiros?.nome_publico),
          termos: linhaDeTermos({
            notaConduta: nota,
            avaliacoesConduta: nota != null ? Math.max(1, Number(pub?.avaliacoes_feitas ?? 0)) : 0,
          }),
          // E1096: as estrelas de conduta do cartão e "Novo na Viva" (a mesma conduta publicada da linha de termos).
          reputacao: reputacaoNoCartao(Number(pub?.avaliacoes_feitas ?? 0), nota),
          identidadeVerificada: verificadas.has(uid),
          teste,
          fotoUrl: uid && fotoPublicaPermitida(teste) ? await signAvatarPath(conta?.avatar_url ?? null, uid) : null,
          // E1177: só está na lista pela exceção da alternância (fez a avaliação anterior e não há outro).
          mesmoDaAnterior: a.mesmoDaAnterior === true,
        };
      }));
    } catch {
      sugeridos = null;
    }
  }
  const faixa = atual && preco ? faixaDeReferencia(Number(preco.valor)) : null;
  // E1100: com a proposta viva, o dono pode trocar de avaliador. Antes de ele clicar, a tela já sabe quantos sobram para
  // escolher (o atual não volta). Só lê com a chave ligada (a ação é do dono real); leitura que falha = null, sem número.
  // E1154: o prazo do aceite sai do mesmo relógio que o avaliador lê (a mesma hora de fim, no mesmo formato).
  const relogioDoAceite = atual
    ? relogioDoPedido(
        { status: atual.status, resposta: undefined, designadoEm: null, propostaEm: atual.proposta_em, propostaAceitaEm: atual.proposta_aceita_em, precisaDoAceite: precisaDoAceiteDoDono({ teste: atual.teste, escolhidoEm: atual.escolhido_em }) },
        agora,
      )
    : null;
  // E1147: passadas as 72 h do dono, e até a rotina devolver o pedido, o bloco diz que o prazo terminou e o botão de
  // aceitar sai (o servidor já recusa o aceite, E1142). "Escolher outro avaliador" fica: a troca não confere o prazo.
  const aceiteTerminou = prazoDoAceiteTerminou(relogioDoAceite);
  let outrosNaTroca: number | null = null;
  if (visivel === "ativa" && atual?.status === "designado" && atual.proposta_em && !atual.proposta_aceita_em) {
    outrosNaTroca = await outrosParaTroca(admin, atual.id, agora).catch(() => null);
  }
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
                <Button type="submit" variant="secondary" size="sm">{ROTULO_CONFIRMAR_PAGAMENTO_AO_AVALIADOR}</Button>
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
            {situacaoDono({ status: atual.status, aguardandoAvaliador: atual.aguardando_avaliador, ocupado: atual.ocupado, concordanciaEm: atual.concordancia_em, agendadoPara: atual.agendado_para, concordanciaPedidaEm: atual.concordancia_pedida_em, laudoAte: laudoAteDoPedido, motivoDaEspera: atual.motivo_da_espera }) && (
              <p className="text-ink" data-testid="avaliacao-situacao">
                {situacaoDono({ status: atual.status, aguardandoAvaliador: atual.aguardando_avaliador, ocupado: atual.ocupado, concordanciaEm: atual.concordancia_em, agendadoPara: atual.agendado_para, concordanciaPedidaEm: atual.concordancia_pedida_em, laudoAte: laudoAteDoPedido, motivoDaEspera: atual.motivo_da_espera })}
              </p>
            )}
            {atual.status === "pedido" && <DepoisDaTroca pedidoId={atual.id} aguardando={atual.aguardando_avaliador} />}
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
                <p className="font-semibold text-ink" data-testid="avaliacao-escolha-titulo">{TITULO_ESCOLHA_AVALIADOR}</p>
                {im.city && <p className="mt-1 text-sm text-muted" data-testid="avaliacao-escolha-cidade">Avaliadores disponíveis em {im.city}</p>}
                {sugeridos === null ? (
                  <p className="mt-2 text-red-700" role="alert" data-testid="avaliacao-escolha-falhou">Não foi possível carregar os avaliadores agora. Atualize a página para tentar de novo.</p>
                ) : sugeridos.length === 0 ? (
                  <>
                    <p className="mt-2 text-muted" data-testid="avaliacao-escolha-vazia">{textoDaEspera(atual.motivo_da_espera)}</p>
                    <NotaDiasUteis de={[textoDaEspera(atual.motivo_da_espera)]} />
                  </>
                ) : (
                  <ul className="mt-3 grid gap-3">
                    {sugeridos.map((a) => {
                      const rosto = rostoDoAvaliador(a.nome, a.fotoUrl, a.teste);
                      return (
                        <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3" data-testid="avaliacao-sugerido">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-champagne text-sm font-semibold text-ink" aria-hidden data-testid="avaliacao-sugerido-rosto">
                            {rosto.tipo === "foto" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={rosto.url} alt="" className="h-12 w-12 rounded-full object-cover" data-testid="avaliacao-sugerido-foto" />
                            ) : (
                              rosto.texto
                            )}
                          </span>
                          <span className="min-w-0 flex-1 text-ink">
                            <span className="block font-semibold">{a.nome}</span>
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-1 text-xs text-ink" data-testid="avaliacao-sugerido-selo">
                              <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden />
                              {a.teste ? ROTULO_AVALIADOR_EM_TESTE : ROTULO_AVALIADOR_CREDENCIADO}
                            </span>
                            <span className="block text-xs text-muted">
                              nº{" "}
                              <Link href={hrefAvaliador(a.numero)} className="underline">
                                {a.numero}
                              </Link>
                            </span>
                            {/* E1096: as estrelas de conduta do mockup; o leitor de tela ouve a linha de termos (E682). */}
                            <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink" data-testid="avaliacao-sugerido-termos">
                              <span className="flex gap-1 text-amber-500" role="img" aria-label={a.termos} data-testid="avaliacao-sugerido-estrelas" data-cheias={a.reputacao.cheias}>
                                {[0, 1, 2, 3, 4].map((i) => (
                                  <Star key={i} className={i < a.reputacao.cheias ? "h-4 w-4 fill-current" : "h-4 w-4 text-muted"} aria-hidden />
                                ))}
                              </span>
                              <span data-testid="avaliacao-sugerido-reputacao" data-novo={a.reputacao.novo ? "sim" : "nao"}>{a.reputacao.texto}</span>
                            </span>
                            {preco && (
                              <span className="mt-1 block text-sm text-ink" data-testid="avaliacao-sugerido-preco">
                                Avaliação: {reaisCurtos(Number(preco.valor))}
                              </span>
                            )}
                            {a.identidadeVerificada && (
                              <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-forest-700" data-testid="avaliacao-sugerido-identidade">
                                <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden />
                                {TEXTO_IDENTIDADE_VERIFICADA}
                              </span>
                            )}
                            {/* E1177: o mesmo avaliador da avaliação anterior — o dono escolhe-o ou espera outro. */}
                            {a.mesmoDaAnterior && (
                              <span className="mt-2 block rounded-lg bg-sage-100 px-2 py-1 text-sm text-ink" role="note" data-testid="avaliacao-sugerido-mesmo">{TEXTO_MESMO_AVALIADOR}</span>
                            )}
                          </span>
                          <FormAcao acao={escolherAvaliador} testid="escolher-avaliador">
                            <input type="hidden" name="pedidoId" value={atual.id} />
                            <input type="hidden" name="avaliadorId" value={a.id} />
                            <Button type="submit" variant="secondary" size="sm" aria-label={`${ROTULO_ESCOLHER} ${a.nome}`}>{ROTULO_ESCOLHER}</Button>
                          </FormAcao>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {/* E1096: a frase do valor fica SOB os cartões (a tabela é referência; o valor de cada um vem depois). */}
                {faixa && (
                  <p className="mt-3 text-muted" data-testid="avaliacao-faixa">
                    {fraseDoValorNaEscolha({ referencia: brl(faixa.referencia), min: brl(faixa.min), max: brl(faixa.max) })}
                  </p>
                )}
              </div>
            )}
            {atual.status === "designado" && !atual.proposta_em && (
              <p className="text-muted" data-testid="avaliacao-aguarda-proposta">O avaliador tem {atual.avaliadores_credenciamento?.prazo_resposta_horas ?? PRAZO_RESPOSTA_PADRAO_HORAS} horas para responder com o valor e o prazo dele. Sem resposta, você escolhe outro.</p>
            )}
            {atual.status === "designado" && atual.proposta_em && !atual.proposta_aceita_em && (
              <div className="rounded-lg border border-line p-3" data-testid="avaliacao-proposta">
                <p className="font-semibold text-ink">
                  Proposta do avaliador: {brl(Number(atual.valor_proposto))} · {prazoCombinadoNaLinhaDoDono(atual, null)}
                </p>
                {/* E1192: só o prazo novo se diz em dias úteis; o pedido anterior à regra ("laudo em 7 dias") fica sem nota. */}
                {atual.prazo_laudo_dias_uteis != null && <NotaDiasUteis />}
                <p className={`mt-1 ${aceiteTerminou ? "text-ink" : "text-muted"}`} data-testid="avaliacao-proposta-prazo" data-terminado={aceiteTerminou ? "1" : "0"}>
                  {textoDoPrazoDeAceiteParaODono(relogioDoAceite)}
                </p>
                {propostaForaDaFaixa && faixa && (
                  <p className="mt-1 text-muted" data-testid="avaliacao-proposta-fora">Fora da faixa de referência da cidade ({brl(faixa.min)} a {brl(faixa.max)}). Você decide.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {!aceiteTerminou && (
                    <FormAcao acao={aceitarProposta} testid="aceitar-proposta">
                      <input type="hidden" name="pedidoId" value={atual.id} />
                      <Button type="submit" variant="secondary" size="sm">Aceitar valor e prazo</Button>
                    </FormAcao>
                  )}
                  {/* E1100: o clique abre a confirmação (o que se perde, e se há outro avaliador); só ela descarta. */}
                  <TrocaDeAvaliador
                    pedidoId={atual.id}
                    acao={recusarProposta}
                    texto={textoDaTroca({ numero: atual.avaliadores_credenciamento?.numero_credenciado ?? null, valor: brl(Number(atual.valor_proposto)), prazoDias: Number(atual.prazo_proposto_dias), prazoPorExtenso: prazoCombinadoNaLinhaDoDono(atual, null), outros: outrosNaTroca, cidade: im.city })}
                  />
                </div>
              </div>
            )}
            {/* E1153: a confirmação do aceite fica na tela enquanto a visita não tem data (antes só existia na resposta
                da ação, que some quando o bloco se redesenha). A mesma frase do lado do avaliador.
                E1173: com a recusa do morador ela sai — a frase de situação já diz o passo (propor outra data). */}
            {aceitoSemDataDeVisita({ status: atual.status, propostaAceitaEm: atual.proposta_aceita_em, agendadoPara: atual.agendado_para }) && !recusouAData && (
              <p className="font-semibold text-ink" data-testid="avaliacao-aceite-confirmado">
                {CONFIRMACAO_DO_ACEITE}
              </p>
            )}
            {/* E1103: o combinado continua à vista depois de a visita ser agendada (antes, a linha sumia no agendamento). */}
            {["designado", "agendado", "realizada"].includes(atual.status) && atual.proposta_aceita_em && atual.valor_proposto != null && (
              <p className="text-ink" data-testid="avaliacao-proposta-aceita">
                Combinado com o avaliador: {brl(Number(atual.valor_proposto))} · {prazoCombinadoNaLinhaDoDono(atual, visitaComData)}.
              </p>
            )}
            {/* E1192: enquanto a visita não tem data, o combinado diz "laudo em até N dias úteis depois da visita" — com a nota. */}
            {["designado", "agendado", "realizada"].includes(atual.status) && atual.proposta_aceita_em && atual.valor_proposto != null && atual.prazo_laudo_dias_uteis != null && !visitaComData && (
              <NotaDiasUteis className="text-sm text-muted" />
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
            {["designado", "agendado"].includes(atual.status) && atual.avaliadores_credenciamento && (atual.proposta_aceita_em || !precisaDoAceiteDoDono({ teste: atual.teste, escolhidoEm: atual.escolhido_em })) && (
              <FormAcao acao={agendarVisita} className="flex flex-wrap items-end gap-2" testid="dono-agendar">
                <input type="hidden" name="pedidoId" value={atual.id} />
                <label className="text-sm">Data e hora da visita<CampoDataHoraFormulario name="quando" required className={campo} /></label>
                <Button type="submit" variant="secondary" size="sm">{atual.agendado_para ? "Reagendar" : "Propor data"}</Button>
                {atual.agendado_para && (
                  <span className="w-full text-xs text-muted" data-testid="avaliacao-regra-reagendar">
                    {REGRA_DO_REAGENDAMENTO}
                  </span>
                )}
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
                  <Button type="submit" variant="secondary" size="sm">{ROTULO_CONFIRMAR_PAGAMENTO_AO_AVALIADOR}</Button>
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
                  {desdeNova && <p className="mt-2 text-ink" data-testid="avaliacao-nova">{TEXTO_NOVA_AVALIACAO_NA_TELA}</p>}
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
                  <p className="mt-1 text-xs text-muted">{TEXTO_PAGAMENTO_DIRETO_AO_AVALIADOR} {textoTaxaServicoParceiros(PAGAMENTO_PARCEIROS_ATIVO)}</p>
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
