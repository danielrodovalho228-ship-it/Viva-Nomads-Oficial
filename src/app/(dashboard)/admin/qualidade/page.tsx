import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { dataBRT } from "@/lib/datas-brasilia";
import { contextoDaSaida, painelQualidade } from "@/lib/data/qualidade";
import { adminDefinirCorrecao, adminEstadoDenuncia, adminFecharCorrecao } from "@/lib/saida/acoes";
import { ESTADOS_DENUNCIA, MOTIVOS_DENUNCIA, ROTULO_ESTADO_DENUNCIA, ROTULO_NIVEL_SAIDA, ROTULO_PAPEL_SAIDA, prioridadeDenuncia, rotuloMotivo, type EstadoDenuncia, type NivelSaida, type PapelSaida } from "@/lib/saida/regras";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin/qualidade"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";
const motivo = (papel: PapelSaida, m: string) => (m === "sem_resposta" ? "Sem resposta" : rotuloMotivo(papel, m));
const motivoDenuncia = (m: string) => MOTIVOS_DENUNCIA.find((x) => x.chave === m)?.rotulo ?? m;
const ROTULO_CONTEXTO = { chamados: "Chamados da pessoa", pagamentos: "Contratos e pedidos de parceiro da pessoa", anuncio: "Anúncio" } as const;

/**
 * Admin → Qualidade (Prompt 51, fase 1), "decisões primeiro": no topo, o que espera a equipe (Correção sem dono ou
 * prazo, denúncia P1 em aberto); depois os 8 quebradores com o sinal precoce, as saídas da semana e a métrica de ouro.
 * Contas de teste fora.
 */
export default async function AdminQualidadePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const saidaAberta = typeof sp.saida === "string" ? sp.saida : null;
  const [p, ctx] = await Promise.all([painelQualidade().catch(() => null), saidaAberta ? contextoDaSaida(saidaAberta).catch(() => null) : Promise.resolve(null)]);
  if (!p) return <EmptyState icon={LifeBuoy} title="Sem dados" text="Não foi possível ler o painel de qualidade agora." action={null} />;

  const abertas = p.correcoes.filter((c) => !c.fechadaEm);
  const semDono = abertas.filter((c) => !c.dono || !c.prazo);
  const p1Abertas = p.denuncias.filter((d) => d.status !== "resolvida" && prioridadeDenuncia(d.motivo as never) === "p1");

  return (
    <div data-testid="admin-qualidade">
      <PageTitle title={rotuloDoAdmin("/admin/qualidade")} subtitle="Por que as pessoas saem e o que a Viva corrige · contas de teste fora" />

      <Panel className="mb-6" data-testid="qualidade-decisoes">
        {semDono.length === 0 && p1Abertas.length === 0 ? (
          <p className="text-sm text-muted">Nada esperando decisão: toda Correção aberta tem dono e prazo, e não há denúncia P1 em aberto.</p>
        ) : (
          <ul className="grid gap-1 text-sm text-ink">
            {semDono.length > 0 && (
              <li>
                <a href="#correcoes" className="font-semibold underline underline-offset-4">{semDono.length} Correção(ões) sem dono ou prazo</a>
              </li>
            )}
            {p1Abertas.length > 0 && (
              <li>
                <a href="#denuncias" className="font-semibold underline underline-offset-4">{p1Abertas.length} denúncia(s) P1 (pagamento ou contato fora) em aberto</a>
              </li>
            )}
          </ul>
        )}
      </Panel>

      <Panel title="Quebradores e o sinal precoce" className="mb-6" data-testid="qualidade-quebradores">
        <ul className="divide-y divide-line">
          {p.quebradores.map((q) => (
            <li key={q.chave} className="flex flex-wrap items-baseline justify-between gap-2 py-3" data-testid="quebrador" data-chave={q.chave} data-n={q.n ?? ""}>
              <div className="min-w-0">
                {q.href ? (
                  <Link href={q.href} className="font-semibold text-ink underline-offset-4 hover:underline">{q.rotulo}</Link>
                ) : (
                  <span className="font-semibold text-ink">{q.rotulo}</span>
                )}
                <p className="text-xs text-muted">Sinal: {q.sinal}.</p>
                {/* ADMIN-6: sem medição, a linha diz o que falta gravar para medir (no lugar de um número). */}
                {q.faltaParaMedir && (
                  <p className="text-xs text-ink" data-testid="quebrador-falta">
                    Para medir, falta {q.faltaParaMedir}.
                  </p>
                )}
              </div>
              <span className="font-title text-lg text-ink">{q.n == null ? "—" : q.n}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Panel title="Saídas da semana por motivo" data-testid="qualidade-saidas" data-total={p.totalSemana}>
          {p.porMotivo.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma saída nos últimos 7 dias.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {p.porMotivo.map((m) => (
                <li key={`${m.papel}:${m.motivo}`} className="flex justify-between gap-2" data-testid="saida-motivo-linha" data-papel={m.papel} data-motivo={m.motivo}>
                  <span className="text-ink">{ROTULO_PAPEL_SAIDA[m.papel]} · {motivo(m.papel, m.motivo)}</span>
                  <span className="font-semibold text-ink">{m.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Saídas revertidas pela ajuda" data-testid="qualidade-metrica-ouro" data-valor={p.pctRevertidas ?? ""}>
          <p className="font-title text-lg text-ink">{p.pctRevertidas == null ? "sem base" : `${String(p.pctRevertidas).replace(".", ",")}%`}</p>
          <p className="mt-1 text-xs text-muted">Fórmula: saídas em que a pessoa aceitou a ajuda ÷ saídas com ajuda oferecida, últimos 30 dias. Base: {p.baseRevertidas}.</p>
        </Panel>
      </div>

      <Panel title="Correções" className="mb-6" data-testid="qualidade-correcoes" id="correcoes">
        <p className="mb-3 text-xs text-muted">Um motivo com mais de 3 saídas em 30 dias vira Correção. Dono e prazo são obrigatórios; fechar exige a ligação ao PR ou à ação.</p>
        {p.correcoes.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma Correção nos últimos 30 dias.</p>
        ) : (
          <ul className="grid gap-3">
            {p.correcoes.map((c) => (
              <li key={c.id} className="rounded-lg border border-sage-200 p-3 text-sm" data-testid="correcao" data-papel={c.papel} data-motivo={c.motivo} data-estado={c.fechadaEm ? "fechada" : c.dono && c.prazo ? "com_dono" : "sem_dono"}>
                <p className="font-semibold text-ink">
                  {ROTULO_PAPEL_SAIDA[c.papel]} · {motivo(c.papel, c.motivo)} · {c.ocorrencias} saídas
                </p>
                <p className="text-muted">
                  Aberta em {dataBRT(c.criadaEm)}
                  {c.dono ? ` · dono: ${c.dono}` : " · sem dono"}
                  {c.prazo ? ` · prazo: ${dataBRT(c.prazo)}` : " · sem prazo"}
                  {c.fechadaEm ? ` · fechada em ${dataBRT(c.fechadaEm)} (${c.ligacao})` : ""}
                </p>
                {!c.fechadaEm && (
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <FormAcao acao={adminDefinirCorrecao} className="grid gap-2" testid="correcao-definir">
                      <input type="hidden" name="id" value={c.id} />
                      <label>Dono<input name="dono" required defaultValue={c.dono ?? ""} className={campo} /></label>
                      <label>Prazo<input name="prazo" type="date" required defaultValue={c.prazo ?? ""} className={campo} /></label>
                      <Button type="submit" variant="secondary" size="sm">Salvar dono e prazo</Button>
                    </FormAcao>
                    <FormAcao acao={adminFecharCorrecao} className="grid gap-2" testid="correcao-fechar">
                      <input type="hidden" name="id" value={c.id} />
                      <label>PR ou ação feita<input name="ligacao" required placeholder="#1234 ou o que foi feito" className={campo} /></label>
                      <Button type="submit" variant="secondary" size="sm">Fechar a Correção</Button>
                    </FormAcao>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Denúncias de anúncio" className="mb-6" data-testid="qualidade-denuncias" id="denuncias">
        <p className="mb-3 text-xs text-muted">A denúncia não tira o anúncio da busca: quem decide é o atendimento. Quem denunciou vê o estado.</p>
        {p.denuncias.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma denúncia.</p>
        ) : (
          <ul className="grid gap-3">
            {p.denuncias.map((d) => (
              <li key={d.id} className="rounded-lg border border-sage-200 p-3 text-sm" data-testid="denuncia" data-property={d.propertyId} data-status={d.status}>
                <p className="font-semibold text-ink">
                  {prioridadeDenuncia(d.motivo as never) === "p1" ? "P1" : "P2"} · {motivoDenuncia(d.motivo)} ·{" "}
                  <Link href={`/imoveis/${d.propertyId}`} className="underline underline-offset-4">{d.titulo}</Link>
                </p>
                <p className="text-muted">
                  {dataBRT(d.criadoEm)} · {ROTULO_ESTADO_DENUNCIA[d.status as EstadoDenuncia] ?? d.status}
                  {d.chamado ? ` · chamado ${d.chamado}` : ""}
                </p>
                {d.texto && <p className="mt-1 text-ink">{d.texto}</p>}
                <FormAcao acao={adminEstadoDenuncia} className="mt-2 flex flex-wrap items-end gap-2" testid="denuncia-estado-form">
                  <input type="hidden" name="id" value={d.id} />
                  <label className="min-w-40">
                    Estado
                    <select name="status" defaultValue={d.status} className={campo}>
                      {ESTADOS_DENUNCIA.map((e) => (
                        <option key={e} value={e}>{ROTULO_ESTADO_DENUNCIA[e]}</option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" variant="secondary" size="sm">Atualizar</Button>
                </FormAcao>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Saídas que pedem olhar o caso" data-testid="qualidade-contexto" id="contexto">
        <p className="mb-3 text-xs text-muted">Atendimento abre os chamados da pessoa; pagamento abre os contratos e pedidos de parceiro; imóvel diferente abre o anúncio.</p>
        {p.comContexto.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma nos últimos 30 dias.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {p.comContexto.map((s) => (
              <li key={s.id} data-testid="saida-contexto" data-contexto={s.contexto}>
                <Link href={`/admin/qualidade?saida=${s.id}#contexto`} className="underline underline-offset-4">
                  {dataBRT(s.criadoEm)} · {ROTULO_PAPEL_SAIDA[s.papel]} · {motivo(s.papel, s.motivo)} · {ROTULO_NIVEL_SAIDA[s.nivel as NivelSaida] ?? s.nivel}
                </Link>
                {saidaAberta === s.id && ctx && (
                  <div className="mt-2 rounded-lg border border-sage-200 p-3" data-testid="saida-contexto-aberto">
                    <p className="font-semibold text-ink">{ROTULO_CONTEXTO[ctx.contexto]}</p>
                    {ctx.itens.length === 0 ? (
                      <p className="text-muted">Nada encontrado para esta pessoa.</p>
                    ) : (
                      <ul className="mt-1 grid gap-1">
                        {ctx.itens.map((i) => (
                          <li key={i.href + i.rotulo}>
                            <Link href={i.href} className="underline underline-offset-4">{i.rotulo}</Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
