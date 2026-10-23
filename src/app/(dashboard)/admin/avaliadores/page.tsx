import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { VISTORIA_ATIVA, VISTORIA_PARECER_14 } from "@/lib/flags";
import { chaveCidade } from "@/lib/cidades";
import { brl } from "@/lib/fiscal/documento";
import { dataBRT } from "@/lib/datas-brasilia";
import { adminCriarAvaliacaoTeste, adminDecidirCredenciamento, adminResolverFila, adminRevisarAuditoria, adminSalvarPreco } from "@/lib/vistoria/actions";
import { COLUNAS_PRECO, PORTES, ROTULO_PORTE, condicaoRetorno, condicoesParaLigar, linhaDaTabela, tabelaCompleta, textoCondicaoRetorno, type LinhaPreco, type StatusCredenciamento } from "@/lib/vistoria/regras";
import { adminAbrirVerificacao, adminResolverBloqueio } from "@/lib/vistoria/laudo-actions";
import { estadoIdentidade } from "@/lib/identidade/estado-servidor";
import { ROTULO_MOTIVO_VERIFICACAO, type MotivoVerificacao } from "@/lib/vistoria/strikes";
import { ROTULO_RESULTADO, type Resultado } from "@/lib/vistoria/laudo";
import { filaDaCidade } from "@/lib/vistoria/servidor";
import { TITULO_ADMIN, contagemDecisoes, filaDeRodizio, rotuloDecisao } from "@/lib/vistoria/telas-exibicao";

export const metadata = { title: "Avaliações do imóvel — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const mascararDocumento = (d: string | null) => (d ? `${"•".repeat(Math.max(0, d.length - 4))}${d.slice(-4)}` : "—");
const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";
const ROTULO_STATUS: Record<StatusCredenciamento, string> = { solicitado: "Solicitado", em_teste: "Em teste", ativo: "Ativo", suspenso: "Suspenso", descredenciado: "Descredenciado" };
const ROTULO_RESPOSTA: Record<string, string> = { recusada: "Recusou", expirada: "Sem resposta em 24 horas", ausencia: "Não foi à visita" };
const PROXIMOS: Record<StatusCredenciamento, StatusCredenciamento[]> = { solicitado: ["em_teste", "descredenciado"], em_teste: ["ativo", "descredenciado"], ativo: ["suspenso", "descredenciado"], suspenso: ["ativo", "descredenciado"], descredenciado: [] };
const ROTULO_FILA: Record<string, string> = { sem_avaliador: "Pedido sem avaliador elegível", avaliacao_teste: "Avaliação de teste a marcar e revisar", suspensao_automatica: "Suspensão automática a rever", proposta_descredenciamento: "Proposta de descredenciamento", laudo_atrasado: "Laudo não enviado em 48 horas úteis", ressalva_vencida: "Ressalva vencida: avaliar abrir verificação", devolucao_vencida: "Devolução da contestação não confirmada em 15 dias", seguranca_grave: "Segurança grave a acompanhar" };
const ROTULO_BLOQUEIO: Record<string, string> = { seguranca_grave: "Segurança grave (fora da busca)", strike_2: "2º strike (republicar só com laudo)", strike_3: "3º strike (todos fora da busca)" };

type Cred = { id: string; cidade: string; numero_credenciado: string; status: StatusCredenciamento; motivo: string | null; experiencia_link: string | null; experiencia_path: string | null; relacoes_descricao: string | null; criado_em: string; user_id: string | null; parceiros: { nome_publico: string } | null; parceiro_solicitacoes: { nome: string; tipo_pessoa: string | null; documento: string | null; email: string | null } | null };

/**
 * Admin → Avaliações do imóvel (62-B1/62-B2/62-B3; desenho do 62-A, Parte 1, item 7 — decisões primeiro). Funciona com a chave
 * VISTORIA_ATIVA desligada para montar a rede antes do lançamento. No topo, os números do que decidir (cada um leva à
 * sua seção); depois as 3 condições da chave, o credenciamento (a decidir primeiro), pedidos sem avaliador, recusas e
 * ausências, a fila de rodízio por cidade e a tabela de preço com histórico. Abaixo, o que o 62-B2 trouxe (verificação,
 * bloqueios, strikes, laudos e auditoria), que o 62-A Parte 2 redesenha.
 */
export default async function AdminAvaliadoresPage() {
  const admin = createAdminClient();
  if (!admin) return <EmptyState icon={ShieldCheck} title="Modo demonstração" text="Sem conexão com o banco." action={null} />;
  const agora = new Date();
  const [{ data: creds }, { data: precos }, { data: fila }, { data: auditoria }, { data: pedidos }, { data: bloqueios }, { data: strikes }, { data: laudos }] = await Promise.all([
    admin.from("avaliadores_credenciamento").select("id, cidade, numero_credenciado, status, motivo, experiencia_link, experiencia_path, relacoes_descricao, criado_em, user_id, parceiros(nome_publico), parceiro_solicitacoes(nome, tipo_pessoa, documento, email)").order("criado_em", { ascending: false }),
    admin.from("vistoria_precos").select(COLUNAS_PRECO).order("vigente_desde", { ascending: false }).limit(200),
    admin.from("vistoria_fila_admin").select("id, tipo, motivo, criado_em, pedido_id, avaliador_id").is("resolvido_em", null).order("criado_em"),
    admin.from("vistoria_auditoria").select("id, pedido_id, sorteado_em, avaliadores_credenciamento(numero_credenciado)").is("resultado", null),
    admin.from("vistoria_pedidos").select("id, cidade, tipo, status, aguardando_avaliador, criado_em, avaliadores_credenciamento(numero_credenciado)").order("criado_em", { ascending: false }).limit(50),
    // Prompt 62-B2: bloqueios abertos, strikes vigentes e laudos recentes.
    admin.from("vistoria_bloqueios").select("id, property_id, motivo, criado_em").is("resolvido_em", null).order("criado_em", { ascending: false }).limit(100),
    admin.from("proprietario_strikes").select("id, owner_id, property_id, ordem, origem, criado_em, suspenso_ate, expira_em").order("criado_em", { ascending: false }).limit(100),
    admin.from("vistoria_laudos").select("id, numero, versao, resultado, property_id, emitido_em").order("emitido_em", { ascending: false }).limit(30),
  ]);
  const lista = (creds ?? []) as unknown as Cred[];
  // Correção 62-B3: a pendência de identidade de cada pedido ainda não decidido (a aprovação para teste exige).
  const identidade = new Map(
    await Promise.all(
      lista.filter((c) => c.status === "solicitado" && c.user_id).map(async (c) => [c.id, (await estadoIdentidade(admin, c.user_id!)).estado === "confirmada"] as const),
    ),
  );
  const trintaDias = new Date(agora.getTime() - 30 * 86_400_000).toISOString();
  const [fila_rodizio, { data: recusas }, { data: perfisTeste }] = await Promise.all([
    filaDaCidade(admin),
    admin.from("vistoria_designacoes").select("id, resposta, respondido_em, avaliador_id, vistoria_pedidos(cidade)").in("resposta", ["recusada", "expirada", "ausencia"]).gte("respondido_em", trintaDias).order("respondido_em", { ascending: false }).limit(50),
    admin.from("profiles").select("id").eq("is_teste", true).limit(200),
  ]);
  const idsTeste = ((perfisTeste ?? []) as { id: string }[]).map((x) => x.id);
  const { data: imoveisTeste } = idsTeste.length ? await admin.from("properties").select("id, title, city").in("owner_id", idsTeste).order("created_at", { ascending: false }).limit(50) : { data: [] };
  const numeroDe = new Map(lista.map((c) => [c.id, c.numero_credenciado]));
  type Ped = { id: string; cidade: string; tipo: string; status: string; aguardando_avaliador: boolean; criado_em: string; avaliadores_credenciamento: { numero_credenciado: string } | null };
  const pedidosLista = (pedidos ?? []) as unknown as Ped[];
  const semAvaliador = pedidosLista.filter((x) => x.aguardando_avaliador && x.status === "pedido");
  const recusasLista = (recusas ?? []) as unknown as { id: string; resposta: string; respondido_em: string; avaliador_id: string; vistoria_pedidos: { cidade: string } | null }[];
  const filaRestante = ((fila ?? []) as { id: string; tipo: string; motivo: string | null; criado_em: string }[]).filter((f) => f.tipo !== "sem_avaliador");
  const aDecidir = lista.filter((c) => c.status === "solicitado" || c.status === "em_teste");
  const naRede = lista.filter((c) => !(c.status === "solicitado" || c.status === "em_teste"));
  const tabela: LinhaPreco[] = ((precos ?? []) as Parameters<typeof linhaDaTabela>[0][]).map(linhaDaTabela);
  const cidades = [...new Map([...lista.map((c) => c.cidade), ...tabela.map((t) => t.cidade)].map((c) => [chaveCidade(c), c])).values()];
  const condicoesPorCidade = cidades.map((cidade) => {
    const ativos = lista.filter((c) => chaveCidade(c.cidade) === chaveCidade(cidade) && c.status === "ativo").length;
    return { cidade, cond: condicoesParaLigar({ tabelaCompleta: tabelaCompleta(tabela, cidade, agora), avaliadoresAtivos: ativos, parecerItem14: VISTORIA_PARECER_14 }) };
  });
  const numeros = contagemDecisoes({ credenciamentos: lista, semAvaliador: semAvaliador.length, recusasAusencias: recusasLista.length, cidadesProntas: condicoesPorCidade.filter((c) => c.cond.every((x) => x.ok)).length, cidades: cidades.length });
  // Tabela: a linha vigente de cada cidade + porte (a mais recente) e o histórico.
  const vigentes = new Set<number>();
  {
    const visto = new Set<string>();
    tabela.forEach((l, i) => {
      const k = `${chaveCidade(l.cidade)}|${l.porte}`;
      if (!visto.has(k)) {
        visto.add(k);
        vigentes.add(i);
      }
    });
  }

  return (
    <>
      <PageTitle title={TITULO_ADMIN} subtitle="Avaliação do imóvel por avaliador credenciado: o que decidir, a rede, o rodízio e a tabela de preço." />
      <Panel title="Para decidir" className="mb-6" data-testid="avaliacoes-decidir">
        <ul className="grid gap-3 sm:grid-cols-4">
          {numeros.map((n) => (
            <li key={n.chave}>
              <Link href={n.ancora} className="block rounded-xl border border-line p-4 hover:border-forest" data-testid={`decidir-numero-${n.chave}`} data-valor={n.valor}>
                <span className="block font-title text-2xl font-semibold text-ink">{n.valor}</span>
                <span className="text-sm text-muted">{n.rotulo}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel id="chave" title={`Chave VISTORIA_ATIVA: ${VISTORIA_ATIVA ? "ligada" : "desligada"}`} className="mb-6 scroll-mt-24" data-testid="avaliadores-chave">
        <p className="text-sm text-muted">Só liga quando as 3 condições estiverem cumpridas na cidade.</p>
        {cidades.length === 0 && <p className="mt-2 text-sm text-muted">Nenhuma cidade com avaliador ou preço ainda.</p>}
        <div className="mt-1 grid gap-4 lg:grid-cols-2">
          {condicoesPorCidade.map(({ cidade, cond }) => (
            <div key={cidade} className="mt-2" data-testid="avaliadores-condicoes" data-cidade={cidade}>
              <h3 className="font-title text-base font-semibold text-ink">{cidade}</h3>
              <ul className="mt-1 grid gap-1 text-sm">
                {cond.map((c) => (
                  <li key={c.id} data-testid={`condicao-${c.id}`} data-ok={c.ok ? "sim" : "nao"}>
                    <span className={c.ok ? "font-semibold text-forest" : "font-semibold text-red-700"}>{c.ok ? "Cumprida" : "Falta"}</span> · {c.rotulo}: <span className="text-muted">{c.detalhe}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <Panel id="credenciamento" title="Credenciamento" className="mb-6 scroll-mt-24" data-testid="avaliadores-credenciamento">
        {lista.length === 0 ? (
          <p className="text-sm text-muted">Nenhum pedido de credenciamento.</p>
        ) : (
          <div className="grid gap-4">
            {[
              { titulo: "A decidir", itens: aDecidir, vazio: "Nada a decidir agora." },
              { titulo: "Na rede", itens: naRede, vazio: "Ninguém na rede ainda." },
            ].map((g) => (
              <div key={g.titulo}>
                <h3 className="text-sm font-semibold text-ink">{g.titulo} ({g.itens.length})</h3>
                {g.itens.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">{g.vazio}</p>
                ) : (
                  <ul className="mt-2 grid gap-3">
                    {g.itens.map((c) => (
                      <li key={c.id} className="rounded-lg border border-line p-3 text-sm" data-testid="credenciamento-item" data-numero={c.numero_credenciado} data-status={c.status}>
                        <strong className="text-ink">
                          {c.numero_credenciado} · {c.parceiros?.nome_publico ?? c.parceiro_solicitacoes?.nome ?? "Parceiro"}
                        </strong>{" "}
                        · {c.cidade} · {ROTULO_STATUS[c.status]}
                        {!c.parceiros && c.parceiro_solicitacoes && (
                          <span className="block text-muted" data-testid="credenciamento-dados-parceiro">
                            Ainda não é parceiro: {c.parceiro_solicitacoes.tipo_pessoa === "pj" ? "CNPJ" : "CPF"} {mascararDocumento(c.parceiro_solicitacoes.documento)}
                            {c.parceiro_solicitacoes.email ? ` · ${c.parceiro_solicitacoes.email}` : ""}. A aprovação para teste ativa a conta de parceiro.
                          </span>
                        )}
                        {c.status === "solicitado" && identidade.get(c.id) === false && (
                          <span className="block font-semibold text-red-700" data-testid="credenciamento-pendencia">Pendência: verificar a identidade (a aprovação para teste espera).</span>
                        )}
                        {c.experiencia_link && (
                          <span className="block text-muted">
                            Experiência:{" "}
                            <a href={c.experiencia_link} target="_blank" rel="noopener noreferrer" className="text-forest underline underline-offset-2">
                              {c.experiencia_link}
                            </a>
                          </span>
                        )}
                        {c.experiencia_path && <span className="block text-muted">Experiência: arquivo enviado (bucket privado)</span>}
                        {c.relacoes_descricao && <span className="block text-muted">Relações declaradas: {c.relacoes_descricao}</span>}
                        {c.motivo && <span className="block text-muted">Motivo: {c.motivo}</span>}
                        <div className="mt-3 grid gap-2">
                          {PROXIMOS[c.status].map((para) => (
                            <FormAcao key={para} acao={adminDecidirCredenciamento} className="flex flex-wrap items-center gap-2" testid={`decidir-${para}`}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="para" value={para} />
                              {(para === "suspenso" || para === "descredenciado") && <input name="motivo" placeholder="Motivo" aria-label="Motivo" className="min-w-0 flex-1 rounded-lg border border-sage-200 px-3 py-2 text-base" />}
                              <Button type="submit" variant="secondary" size="sm">{rotuloDecisao(c.status, para)}</Button>
                            </FormAcao>
                          ))}
                        </div>
                        {c.status === "em_teste" && (
                          <FormAcao acao={adminCriarAvaliacaoTeste} className="mt-3 flex flex-wrap items-end gap-2" testid="avaliacao-teste">
                            <input type="hidden" name="avaliadorId" value={c.id} />
                            <label className="min-w-0 flex-1 text-sm">
                              Imóvel de teste
                              <select name="propertyId" required className={campo} defaultValue="">
                                <option value="" disabled>
                                  {(imoveisTeste ?? []).length ? "Escolha um imóvel de conta de teste" : "Nenhum imóvel de conta de teste"}
                                </option>
                                {((imoveisTeste ?? []) as { id: string; title: string | null; city: string | null }[]).map((im) => (
                                  <option key={im.id} value={im.id}>
                                    {im.title ?? "Imóvel"} · {im.city ?? ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Button type="submit" variant="secondary" size="sm">Marcar avaliação de teste</Button>
                          </FormAcao>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel id="sem-avaliador" title="Pedidos sem avaliador elegível" className="mb-6 scroll-mt-24" data-testid="avaliacoes-sem-avaliador">
        {semAvaliador.length === 0 ? (
          <p className="text-sm text-muted">Todos os pedidos têm avaliador.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {semAvaliador.map((x) => (
              <li key={x.id} data-testid="sem-avaliador-item">
                {x.cidade} · {x.tipo} · desde {dataBRT(x.criado_em)}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel id="recusas" title="Recusas e ausências (30 dias)" className="mb-6 scroll-mt-24" data-testid="avaliacoes-recusas">
        {recusasLista.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma recusa ou ausência nos últimos 30 dias.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {recusasLista.map((r) => (
              <li key={r.id} data-testid="recusa-item" data-resposta={r.resposta}>
                nº {numeroDe.get(r.avaliador_id) ?? "—"} · {ROTULO_RESPOSTA[r.resposta] ?? r.resposta} · {r.vistoria_pedidos?.cidade ?? ""} · {dataBRT(r.respondido_em)}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Fila da equipe" className="mb-6" data-testid="avaliadores-fila">
        {filaRestante.length === 0 ? (
          <p className="text-sm text-muted">Nada pendente.</p>
        ) : (
          <ul className="grid gap-2">
            {filaRestante.map((f) => (
              <li key={f.id} className="rounded-lg border border-line p-3 text-sm" data-testid="fila-item" data-tipo={f.tipo}>
                <strong className="text-ink">{ROTULO_FILA[f.tipo] ?? f.tipo}</strong>
                {f.motivo && <span className="block text-muted">{f.motivo}</span>}
                <FormAcao acao={adminResolverFila} className="mt-2">
                  <input type="hidden" name="id" value={f.id} />
                  <Button type="submit" variant="secondary" size="sm">Marcar como resolvido</Button>
                </FormAcao>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel id="rodizio" title="Fila de rodízio por cidade" className="mb-6 scroll-mt-24" data-testid="avaliacoes-rodizio">
        <p className="text-sm text-muted">Quem está há mais tempo sem designação vem primeiro. Impedimentos ligados ao pedido (serviço ao proprietário, relação declarada) aparecem na hora da designação.</p>
        {cidades.length === 0 && <p className="mt-2 text-sm text-muted">Nenhuma cidade ainda.</p>}
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {cidades.map((cidade) => {
            const ordem = filaDeRodizio(fila_rodizio, cidade, agora);
            return (
              <div key={cidade} data-testid="rodizio-cidade" data-cidade={cidade}>
                <h3 className="font-title text-base font-semibold text-ink">{cidade}</h3>
                {ordem.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">Ninguém na fila.</p>
                ) : (
                  <ol className="mt-1 grid gap-1 text-sm">
                    {ordem.map((o) => (
                      <li key={o.id} data-testid="rodizio-item" data-posicao={o.posicao ?? ""}>
                        {o.posicao ? <span className="font-semibold text-ink">{o.posicao}º</span> : <span className="text-muted">Fora</span>} · nº {numeroDe.get(o.id) ?? "—"}
                        {o.impedimento && <span className="text-muted"> · {o.impedimento}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Abrir verificação" className="mb-6" data-testid="avaliadores-verificacao">
        <p className="text-sm text-muted">Só a Viva abre, com motivo: denúncia procedente sobre o estado, pendência do padrão mínimo procedente ou ressalva vencida. O proprietário paga pela tabela; o rodízio designa.</p>
        <FormAcao acao={adminAbrirVerificacao} className="mt-3 grid gap-3 sm:grid-cols-2" testid="verificacao-form">
          <label className="text-sm">Imóvel (id)<input name="propertyId" required className={campo} /></label>
          <label className="text-sm">
            Motivo
            <select name="motivo" className={campo} defaultValue="denuncia_procedente">
              {(Object.keys(ROTULO_MOTIVO_VERIFICACAO) as MotivoVerificacao[]).map((m) => (
                <option key={m} value={m}>{ROTULO_MOTIVO_VERIFICACAO[m]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">Descrição do motivo<input name="detalhe" required minLength={10} maxLength={500} className={campo} /></label>
          <div className="sm:col-span-2"><Button type="submit" size="sm">Abrir verificação</Button></div>
        </FormAcao>
      </Panel>

      <Panel title="Fora da busca e republicação" className="mb-6" data-testid="avaliadores-bloqueios">
        {(bloqueios ?? []).length === 0 ? (
          <p className="text-sm text-muted">Nenhum anúncio bloqueado pela avaliação.</p>
        ) : (
          <ul className="grid gap-2">
            {((bloqueios ?? []) as { id: string; property_id: string; motivo: string; criado_em: string }[]).map((b) => (
              <li key={b.id} className="rounded-lg border border-sage-200 p-3 text-sm" data-testid="bloqueio-item" data-motivo={b.motivo}>
                {ROTULO_BLOQUEIO[b.motivo] ?? b.motivo} · imóvel {b.property_id.slice(0, 8)} · desde {dataBRT(b.criado_em)}
                <FormAcao acao={adminResolverBloqueio} className="mt-2">
                  <input type="hidden" name="id" value={b.id} />
                  <Button type="submit" variant="secondary" size="sm">Resolver (correção comprovada)</Button>
                </FormAcao>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Strikes" className="mb-6" data-testid="avaliadores-strikes">
        <p className="text-sm text-muted">Só de verificação reprovada ou ressalva vencida de verificação. Contestado fica suspenso; sai aos 12 meses.</p>
        <ul className="mt-2 grid gap-1 text-sm">
          {((strikes ?? []) as { id: string; owner_id: string; property_id: string; ordem: number; origem: string; criado_em: string; suspenso_ate: string | null; expira_em: string }[]).map((x) => (
            <li key={x.id} data-testid="strike-item" data-ordem={x.ordem} data-suspenso={x.suspenso_ate ? "sim" : "nao"}>
              {x.ordem}º · proprietário {x.owner_id.slice(0, 8)} · imóvel {x.property_id.slice(0, 8)} · {x.origem === "ressalva_vencida" ? "ressalva vencida" : "verificação reprovada"} · {dataBRT(x.criado_em)}
              {x.suspenso_ate ? " · suspenso (contestação)" : ` · expira ${dataBRT(x.expira_em)}`}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Laudos recentes" className="mb-6" data-testid="avaliadores-laudos">
        {(laudos ?? []).length === 0 && <p className="text-sm text-muted">Nenhum laudo emitido ainda.</p>}
        <ul className="grid gap-1 text-sm">
          {((laudos ?? []) as { id: string; numero: string; versao: number; resultado: Resultado; property_id: string; emitido_em: string }[]).map((l) => (
            <li key={l.id} data-testid="laudo-admin" data-resultado={l.resultado}>
              <a href={`/api/vistoria/laudo/${l.id}`} className="underline">{l.numero}{l.versao > 1 ? ` v${l.versao}` : ""}</a> · {ROTULO_RESULTADO[l.resultado]} · imóvel {l.property_id.slice(0, 8)} · {dataBRT(l.emitido_em)}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel id="tabela" title="Tabela de preço" className="mb-6 scroll-mt-24" data-testid="avaliadores-precos">
        <p className="text-sm text-muted">Sem valor no código: cada mudança vira uma linha nova (histórico); vale a mais recente. Sem valor na cidade, o pedido não abre.</p>
        <FormAcao acao={adminSalvarPreco} className="mt-3 grid gap-3 sm:grid-cols-2" testid="preco-form">
          <label className="text-sm">Cidade<input name="cidade" required className={campo} /></label>
          <label className="text-sm">
            Porte
            <select name="porte" className={campo} defaultValue="q1_2">
              {PORTES.map((p) => (
                <option key={p} value={p}>{ROTULO_PORTE[p]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">Valor (R$)<input name="valor" inputMode="decimal" required className={campo} /></label>
          <label className="text-sm">O que inclui (opcional)<input name="inclui" className={campo} /></label>
          {/* Adendo 62-B1: só depois da cotação. Os dois vazios = não existe condição de retorno (nenhum texto fala em desconto). */}
          <label className="text-sm">Condição de retorno: prazo em dias (opcional)<input name="retornoDias" inputMode="numeric" className={campo} /></label>
          <label className="text-sm">Condição de retorno: desconto em % (opcional)<input name="retornoPercentual" inputMode="decimal" className={campo} /></label>
          <div className="sm:col-span-2"><Button type="submit" size="sm">Salvar valor</Button></div>
        </FormAcao>
        <ul className="mt-4 grid gap-1 text-sm" data-testid="precos-historico">
          {tabela.map((l, i) => (
            <li key={i} className={vigentes.has(i) ? "text-ink" : "text-muted"} data-vigente={vigentes.has(i) ? "sim" : "nao"}>
              {l.cidade} · {ROTULO_PORTE[l.porte]} · {brl(l.valor)} · desde {dataBRT(l.vigenteDesde)}
              {l.incluiTexto ? ` · ${l.incluiTexto}` : ""}
              {` · ${textoCondicaoRetorno(condicaoRetorno(l)) ?? "sem condição de retorno"}`}
              {vigentes.has(i) ? " · vigente" : " · substituído"}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Auditoria (revisão humana dos laudos sorteados)" className="mb-6" data-testid="avaliadores-auditoria">
        {(auditoria ?? []).length === 0 ? (
          <p className="text-sm text-muted">Nenhum laudo sorteado esperando revisão.</p>
        ) : (
          <ul className="grid gap-2">
            {((auditoria ?? []) as unknown as { id: string; pedido_id: string; avaliadores_credenciamento: { numero_credenciado: string } | null }[]).map((a) => (
              <li key={a.id} className="rounded-lg border border-sage-200 p-3 text-sm">
                Pedido {a.pedido_id.slice(0, 8)} · avaliador {a.avaliadores_credenciamento?.numero_credenciado}
                <FormAcao acao={adminRevisarAuditoria} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <select name="resultado" aria-label="Resultado da revisão" className={campo} defaultValue="confere">
                    <option value="confere">Confere</option>
                    <option value="nao_confere">Não confere</option>
                  </select>
                  <input name="motivo" placeholder="Motivo (obrigatório se não confere)" aria-label="Motivo" className={campo} />
                  <Button type="submit" variant="secondary" size="sm">Registrar revisão</Button>
                </FormAcao>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Pedidos recentes" data-testid="avaliadores-pedidos">
        {pedidosLista.length === 0 && <p className="text-sm text-muted">Nenhum pedido de avaliação ainda.</p>}
        <ul className="grid gap-1 text-sm">
          {((pedidos ?? []) as unknown as { id: string; cidade: string; tipo: string; status: string; aguardando_avaliador: boolean; avaliadores_credenciamento: { numero_credenciado: string } | null }[]).map((p) => (
            <li key={p.id} data-testid="pedido-admin" data-status={p.status}>
              {p.cidade} · {p.tipo} · {p.aguardando_avaliador ? "aguardando avaliador" : p.status}
              {p.avaliadores_credenciamento ? ` · nº ${p.avaliadores_credenciamento.numero_credenciado}` : ""}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
