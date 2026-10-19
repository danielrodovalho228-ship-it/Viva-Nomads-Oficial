"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock, Download, Loader2, Repeat, X } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { StatusChip } from "@/components/propostas/status-chip";
import { responderProposta, type PropostaView, type VersaoView } from "@/lib/data/propostas-actions";
import {
  aplicarContraproposta,
  calcularTotais,
  diferencas,
  estaAberta,
  fraseMaisTempo,
  mesesParaFicarMaisTempo,
  MOTIVOS_RECUSA,
  AJUDA_VALOR_CONTRAPROPOSTA,
  TEXTO_ULTIMA_RODADA,
  TEXTO_RODADAS_ESGOTADAS,
  tetoDeRodadasAtingido,
  ehUltimaRodada,
  rotuloRodada,
  type Mudancas,
} from "@/lib/propostas/regras";
import { rotuloTaxaServico } from "@/lib/cobranca/regra";
import { cn, dataBR, formatBRL, hojeBR } from "@/lib/utils";

const quem = (a: "owner" | "tenant") => (a === "owner" ? "Proprietário" : "Interessado");

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-muted">{rotulo}</dt>
      <dd className={cn("text-right text-ink", forte && "font-semibold")}>{valor}</dd>
    </div>
  );
}

function Valores({ v }: { v: VersaoView }) {
  const t = v.termos;
  const desconto = t.descontoPct + t.descontoEstadiaPct;
  return (
    <dl className="text-sm">
      <Linha rotulo="Valor mensal" valor={`${formatBRL(v.totais.valorMensal)}${desconto > 0 || t.descontoValor > 0 ? ` (de ${formatBRL(t.valorBase)})` : ""}`} forte />
      {t.descontoEstadiaPct > 0 && <Linha rotulo="Desconto de estadia longa" valor={`${String(t.descontoEstadiaPct).replace(".", ",")}%`} />}
      {(t.descontoPct > 0 || t.descontoValor > 0) && (
        <Linha
          rotulo={`Desconto${t.motivoDesconto ? ` (${t.motivoDesconto.toLowerCase()})` : ""}`}
          valor={t.descontoPct > 0 ? `${String(t.descontoPct).replace(".", ",")}%` : `${formatBRL(t.descontoValor)}/mês`}
        />
      )}
      <Linha rotulo="Meses" valor={`${t.meses}`} />
      <Linha rotulo="Entrada" valor={dataBR(t.dataEntrada)} />
      {t.condominio > 0 && <Linha rotulo="Condomínio" valor={`${formatBRL(t.condominio)}/mês`} />}
      {t.consumo > 0 && <Linha rotulo="Consumo estimado" valor={`${formatBRL(t.consumo)}/mês`} />}
      {t.limpezasMes > 0 && <Linha rotulo={`Limpezas (${t.limpezasMes}/mês)`} valor={`${formatBRL(t.limpezasMes * t.valorLimpeza)}/mês`} />}
      {t.taxaPet > 0 && <Linha rotulo="Taxa pet" valor={`${formatBRL(t.taxaPet)}/mês`} />}
      {t.limpezaUnica > 0 && <Linha rotulo="Limpeza de preparação (única)" valor={formatBRL(t.limpezaUnica)} />}
      <div className="mt-2 border-t border-sage-200 pt-2">
        <Linha rotulo="Total por mês" valor={formatBRL(v.totais.totalMensal)} forte />
        <Linha rotulo="Total do contrato" valor={formatBRL(v.totais.totalContrato)} forte />
      </div>
    </dl>
  );
}

/**
 * Detalhe e resposta da proposta (prompt 17). Aceitar, recusar com motivo ou contrapropor — só os itens que o
 * proprietário liberou, até 3 versões no total. O resumo do que mudou aparece antes de enviar; abaixo do mínimo
 * privado, o servidor devolve só a próxima centena ("tente a partir de…").
 */
export function PropostaDetalhe({ p }: { p: PropostaView }) {
  const router = useRouter();
  const [modo, setModo] = useState<"nada" | "recusar" | "contrapropor">("nada");
  const [motivo, setMotivo] = useState("");
  const [textoRecusa, setTextoRecusa] = useState("");
  const [mud, setMud] = useState<Mudancas>({});
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const atual = p.atual;
  const libera = (item: string) => p.itensLiberados.includes(item);
  const nova = aplicarContraproposta(atual.termos, mud, p.descontos);
  const mudou = diferencas(atual.termos, nova);
  const totNova = calcularTotais(nova);
  const maisTempo = libera("meses") ? mesesParaFicarMaisTempo(nova.meses, p.limites.mesesMax, p.descontos) : null;
  const meses = Array.from({ length: p.limites.mesesMax - p.limites.mesesMin + 1 }, (_, i) => p.limites.mesesMin + i);

  async function enviar(r: Parameters<typeof responderProposta>[1]) {
    setErro(null);
    // O aviso de "tente a partir de…" é da tentativa anterior: some ao reenviar (complemento do prompt 27, parte B).
    setAviso(null);
    setEnviando(true);
    const res = await responderProposta(p.id, r);
    setEnviando(false);
    if (!res.ok) {
      setErro(res.error);
      if (res.aviso) setAviso(res.aviso);
      return;
    }
    if ("fechamentoUrl" in res && res.fechamentoUrl) return router.push(res.fechamentoUrl);
    setModo("nada");
    setMud({});
    setAviso(null);
    router.refresh();
  }

  return (
    <>
      <PageTitle
        title={`Proposta ${p.numero}`}
        subtitle={`${p.imovel.titulo} · ${p.papel === "owner" ? "Interessado" : "Proprietário"}: ${p.outraParte}`}
        action={
          <Button variant="secondary" size="sm" onClick={() => window.print()} data-testid="proposta-pdf">
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Panel data-testid="proposta-atual">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                Versão {atual.versao} · {quem(atual.autor)}
              </p>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink" data-testid="proposta-rodada">
                  {rotuloRodada(atual.versao)}
                </span>
                <StatusChip status={p.status} />
              </div>
            </div>
            {ehUltimaRodada(atual.versao, estaAberta(p.status)) && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800" data-testid="proposta-ultima-rodada">
                {TEXTO_ULTIMA_RODADA}
              </p>
            )}
            {tetoDeRodadasAtingido(atual.versao, estaAberta(p.status)) && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800" data-testid="proposta-teto-rodadas">
                {TEXTO_RODADAS_ESGOTADAS}
              </p>
            )}
            <Valores v={atual} />
            {atual.mensagem && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink" data-testid="proposta-mensagem">“{atual.mensagem}”</p>}
            {estaAberta(p.status) && (
              <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden /> Válida até {dataBR(p.validaAte)}
                {p.vistoEm && p.papel === "owner" ? ` · vista em ${dataBR(p.vistoEm)}` : ""}
              </p>
            )}
            {p.recusa && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="proposta-recusa">
                Recusada por {quem(p.recusa.por).toLowerCase()}. Motivo: {p.recusa.motivo}.{p.recusa.texto ? ` ${p.recusa.texto}` : ""}
              </p>
            )}
            {p.status === "expirada" && (
              <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted" data-testid="proposta-expirada">
                A validade passou e esta proposta expirou. Para seguir, o proprietário envia uma nova.
              </p>
            )}
          </Panel>

          {p.podeResponder && (
            <Panel title="Sua resposta" data-testid="proposta-acoes">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => enviar({ acao: "aceitar" })} disabled={enviando} data-testid="proposta-aceitar">
                  <Check className="h-4 w-4" /> Aceitar
                </Button>
                {!p.bloqueioContraproposta && (
                  <Button variant="secondary" onClick={() => setModo(modo === "contrapropor" ? "nada" : "contrapropor")} data-testid="proposta-contrapropor">
                    <Repeat className="h-4 w-4" /> Contrapropor
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setModo(modo === "recusar" ? "nada" : "recusar")} data-testid="proposta-recusar">
                  <X className="h-4 w-4" /> Recusar
                </Button>
              </div>
              {p.bloqueioContraproposta && p.bloqueioContraproposta !== TEXTO_RODADAS_ESGOTADAS && p.papel === "tenant" && <p className="mt-2 text-[13px] text-muted">{p.bloqueioContraproposta}</p>}

              {modo === "recusar" && (
                <div className="mt-4 space-y-3" data-testid="form-recusa">
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium text-ink">Motivo</legend>
                    <div className="flex flex-wrap gap-2">
                      {MOTIVOS_RECUSA.map((m) => (
                        <label key={m.chave} className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-sm", motivo === m.chave ? "border-forest bg-sage-100 text-forest" : "border-sage-200 text-ink")}>
                          <input type="radio" name="motivo" value={m.chave} className="sr-only" checked={motivo === m.chave} onChange={() => setMotivo(m.chave)} />
                          {m.rotulo}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <textarea rows={2} maxLength={500} className="input" placeholder="Quer explicar? (opcional)" value={textoRecusa} onChange={(e) => setTextoRecusa(e.target.value)} />
                  <Button variant="secondary" disabled={!motivo || enviando} onClick={() => enviar({ acao: "recusar", motivo, texto: textoRecusa || undefined })} data-testid="confirmar-recusa">
                    Confirmar recusa
                  </Button>
                </div>
              )}

              {modo === "contrapropor" && (
                <div className="mt-4 space-y-4" data-testid="form-contraproposta">
                  <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                    {libera("valor_mensal") && (
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-ink">Valor mensal (R$)</span>
                        <CampoReais
                          semPrefixo
                          value={mud.valorBase ?? atual.termos.valorBase}
                          onChange={(v) => {
                            setAviso(null);
                            setMud((m) => ({ ...m, valorBase: v ?? 0 }));
                          }}
                          testid="contra-valor"
                        />
                        {p.papel === "tenant" && (
                          <span className="mt-1 block text-[12px] text-muted" data-testid="contra-valor-ajuda">
                            {AJUDA_VALOR_CONTRAPROPOSTA}
                          </span>
                        )}
                      </label>
                    )}
                    {libera("meses") && (
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-ink">Meses</span>
                        <select className="input" value={nova.meses} onChange={(e) => setMud((m) => ({ ...m, meses: Number(e.target.value) }))} data-testid="contra-meses">
                          {meses.map((m) => (
                            <option key={m} value={m}>
                              {m} {m === 1 ? "mês" : "meses"}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {libera("data_entrada") && (
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-ink">Data de entrada</span>
                        <CampoData className="input" min={hojeBR()} value={nova.dataEntrada} onChange={(e) => setMud((m) => ({ ...m, dataEntrada: e.target.value }))} data-testid="contra-data" />
                      </label>
                    )}
                    {libera("limpeza") && (
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-ink">Pacote de limpeza</span>
                        <select className="input" value={nova.limpezasMes} onChange={(e) => setMud((m) => ({ ...m, limpezasMes: Number(e.target.value) }))} data-testid="contra-limpezas">
                          {[0, 1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>
                              {n === 0 ? "Sem limpeza" : `${n} ${n === 1 ? "limpeza" : "limpezas"}/mês${atual.termos.valorLimpeza > 0 ? ` (${formatBRL(n * atual.termos.valorLimpeza)}/mês)` : ""}`}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {libera("taxa_pet") && (
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-ink">Taxa pet (R$/mês)</span>
                        <CampoReais semPrefixo centavos value={mud.taxaPet ?? atual.termos.taxaPet} onChange={(v) => setMud((m) => ({ ...m, taxaPet: v ?? 0 }))} testid="contra-taxa-pet" />
                      </label>
                    )}
                  </div>
                  {maisTempo !== null && (
                    <button
                      type="button"
                      onClick={() => setMud((m) => ({ ...m, meses: maisTempo }))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-forest px-3 py-1.5 text-sm font-medium text-forest hover:bg-sage-100"
                      data-testid="ficar-mais-tempo"
                    >
                      Vou ficar mais tempo <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                  {nova.meses !== atual.termos.meses && (
                    <p className="text-[13px] text-forest" data-testid="frase-mais-tempo">
                      {fraseMaisTempo(atual.termos, nova)}
                    </p>
                  )}
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-ink">Mensagem curta (opcional)</span>
                    <textarea rows={2} maxLength={500} className="input" value={mensagem} onChange={(e) => setMensagem(e.target.value)} data-testid="contra-mensagem" />
                  </label>
                  {mudou.length > 0 && (
                    <div className="rounded-lg border border-sage-200 p-3 text-sm" data-testid="resumo-mudancas">
                      <p className="mb-1 font-medium text-ink">O que muda</p>
                      <ul className="space-y-0.5">
                        {mudou.map((d) => (
                          <li key={d.campo}>
                            {d.rotulo}: <s className="text-muted">{d.antes}</s> → <strong>{d.depois}</strong>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-muted">Novo total do contrato: {formatBRL(totNova.totalContrato)}</p>
                    </div>
                  )}
                  {aviso && (
                    <p className="text-[13px] text-amber-800" role="alert" data-testid="aviso-minimo">
                      {aviso}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={mudou.length === 0 || enviando} onClick={() => enviar({ acao: "contrapropor", mudancas: mud, mensagem: mensagem || undefined })} data-testid="enviar-contraproposta">
                      {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enviar contraproposta
                    </Button>
                    {aviso && (
                      <Button variant="secondary" disabled={enviando} onClick={() => enviar({ acao: "contrapropor", mudancas: mud, mensagem: mensagem || undefined, mesmoAbaixoDoMinimo: true })} data-testid="enviar-mesmo-assim">
                        Enviar mesmo assim
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {erro && !aviso && (
                <p className="mt-3 text-[13px] text-red-600" role="alert" data-testid="resposta-erro">
                  {erro}
                </p>
              )}
            </Panel>
          )}

          {!p.podeResponder && estaAberta(p.status) && (
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted" data-testid="aguardando">
              Aguardando a resposta {p.vez === "owner" ? "do proprietário" : "do interessado"}.
            </p>
          )}

          {p.versoes.length > 1 && (
            <Panel title="Histórico das versões" data-testid="historico-versoes">
              <div className={cn("grid gap-4", p.versoes.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
                {p.versoes.map((v) => (
                  <div key={v.versao} className="rounded-xl border border-sage-200 p-3" data-testid="versao">
                    <p className="text-xs font-semibold text-muted">
                      v{v.versao} · {quem(v.autor)} · {dataBR(v.criadaEm)}
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {formatBRL(v.totais.valorMensal)} × {v.termos.meses} = {formatBRL(v.totais.totalContrato)}
                    </p>
                    {v.mudou.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-[13px]">
                        {v.mudou.map((d) => (
                          <li key={d.campo} className="text-ink">
                            {d.rotulo}: <s className="text-muted">{d.antes}</s> → <strong className="text-forest">{d.depois}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                    {v.mensagem && <p className="mt-2 text-[13px] text-muted">“{v.mensagem}”</p>}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {p.taxa && (
            <Panel title="Só você vê" data-testid="proposta-taxa">
              <p className="text-sm text-ink">
                {rotuloTaxaServico(p.taxa.pct, p.taxa.valorMensal, p.taxa.meses, p.taxa.valor)}
                {p.taxa.congelada ? " (congelada no aceite)" : " (fixada no envio; não sobe depois)"}. Consumo, limpeza e taxa pet não entram na base.
              </p>
              {p.taxa.seAceitaHoje && (
                <p className="mt-2 text-sm font-medium text-forest" data-testid="proposta-taxa-se-aceita-hoje">
                  {p.taxa.seAceitaHoje}.
                </p>
              )}
              {p.taxa.caiu && (
                <p className="mt-2 text-sm font-medium text-forest" data-testid="proposta-taxa-caiu">
                  {p.taxa.caiu}.
                </p>
              )}
            </Panel>
          )}
          {p.fechamentoUrl && (
            <ButtonLink href={p.fechamentoUrl} className="w-full" data-testid="ir-fechamento">
              Seguir para o fechamento
            </ButtonLink>
          )}
          <p className="text-[12px] text-muted">
            A proposta é um documento, não uma cobrança: a Viva não recebe nem guarda valores. Contato só pela plataforma.{" "}
            <Link href="/dashboard/orcamentos" className="underline">
              Ver todos os orçamentos
            </Link>
          </p>
        </aside>
      </div>
    </>
  );
}
