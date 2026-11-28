"use client";

import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { AnularRegistroCentral } from "./anular-registro-central";
import { DecidirDevolucaoCentral, type DevolucaoNoChamado } from "./decidir-devolucao-central";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Clock, Lock, Pencil, Send, Sparkles, ThumbsUp } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { cn, dataBR } from "@/lib/utils";
import { primeiroNome } from "@/lib/display-name";
import { SoLeituraQa } from "@/components/admin/so-leitura-qa";
import { alterarChamado, aprovarSugestao, avaliarRespostaIA, devolverParaViva, enviarSugestaoEditada, responderComoAdmin, sugerirResposta, type chamadoAdmin, type Macro } from "@/lib/data/atendimento-actions";
import { ehNotaResumo } from "@/lib/atendimento/resumo";
import { ResumoEAcoes } from "./resumo-acoes";
import { respostaDaSugestao } from "@/lib/atendimento/acolhimento";
import { mascararEmail, podeDevolverParaViva } from "@/lib/atendimento/copiloto-regras";
import { telefoneMascarado } from "@/lib/atendimento/identificacao-chamado";
import { QuemEAPessoa } from "./copiloto";
import { DenunciaNota } from "./denuncia-nota";
import { EXPLICA_AGUARDANDO_APROVACAO } from "@/lib/atendimento/dono";
import { AVISO_SUGESTAO_INDISPONIVEL, DICA_CAIXA_VAZIA, podeEnviarResposta, sugestaoComPrazo, sugestaoVaiParaACaixa } from "@/lib/atendimento/sugestao-resposta";
import {
  OPCOES_PRIORIDADE,
  dataEHora,
  diaEHoraCurtos,
  historicoEmLinguagemSimples,
  indicadorDoPrazo,
  iniciais,
  itensDaConversa,
  linhaDaFalta,
  rotuloCanal,
  rotuloCategoria,
  rotuloPrioridade,
  rotuloStatus,
  type TomDoPrazo,
} from "@/lib/atendimento/detalhe-chamado";

/*
  E1098 (ORDEM-DUET-505): a tela pelo mockup aprovado. O assunto e o estado mandam; os metadados ficam nos selos e no
  cartão Detalhes; UM indicador de prazo no cabeçalho; a resposta ao cliente aparece uma vez (a sugestão enviada vira
  um aviso que aponta para a mensagem da equipe); o histórico fala em frases. As regras do que se diz estão em
  lib/atendimento/detalhe-chamado (puras, com teste).
*/

type Dados = NonNullable<Awaited<ReturnType<typeof chamadoAdmin>>>;

// Guarda de estilo do admin (Prompt 46, D5): estado é cor de TEXTO e de borda, nunca fundo colorido; o selo é pill branca.
const COR_DO_PRAZO: Record<TomDoPrazo, string> = { ok: "text-forest", risco: "text-amber-800", vencido: "text-red-800", fechado: "text-muted" };

const selo = "inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink";

function Avatar({ sigla, tom }: { sigla: string; tom: "pessoa" | "ia" | "equipe" }) {
  return (
    <span aria-hidden className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white text-xs font-semibold", tom === "equipe" ? "border-forest text-forest" : tom === "ia" ? "border-line text-forest" : "border-line text-ink")}>
      {sigla}
    </span>
  );
}

function Linha({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-t border-line py-2 text-sm first:border-t-0">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-semibold text-ink">{v}</dd>
    </div>
  );
}

export function ChamadoAdminClient({ dados, macros, agoraISO, observadorQa = false, anularSoLeitura = false, devolucao = null }: { dados: Dados; macros: Macro[]; agoraISO: string; observadorQa?: boolean; /** E1246: a observadora da QA não vê o cartão quando o contrato não é todo de teste. */ anularSoLeitura?: boolean; /** E1248: a contestação da devolução da caução (o comprovante e a decisão). */ devolucao?: DevolucaoNoChamado | null }) {
  const router = useRouter();
  const { chamado: c, eventos, pessoa, contextoLink, iaAtiva, sugestaoAuto, historico } = dados;
  // O resumo vai no cartão do topo; na conversa ficam só as mensagens e notas.
  const mensagens = dados.mensagens.filter((m) => !(m.interno && ehNotaResumo(m.corpo)));
  // E1229 (ORDEM-DUET-1160): o chamado que nasceu de um registro (a nota do sistema) tem o botão de anular.
  const pedidoDeAnulacao = dados.mensagens.some((m) => m.autor === "sistema" && m.interno && /^\[anulacao\] pagamento=/.test(m.corpo));
  // E1248: o chamado que nasceu da contestação de uma devolução da caução (a nota do sistema) tem o botão da decisão.
  const contestacaoDeDevolucao = dados.mensagens.some((m) => m.autor === "sistema" && m.interno && /^\[devolucao\] acerto=/.test(m.corpo));
  // Ao abrir, a última sugestão da Viva ainda não usada já vem na caixa (nota
  // interna no banco: "Enviar como está" lê de lá).
  const [base, setBase] = useState<{ mensagemId: number; texto: string } | null>(() => {
    if (c.status === "resolvido" || c.status === "encerrado") return null;
    const usadas = new Set(eventos.filter((e) => e.acao === "sugestao_aprovada" || e.acao === "sugestao_editada").map((e) => Number(e.de)));
    const ultima = [...mensagens].reverse().find((m) => m.autor === "ia" && m.interno && respostaDaSugestao(m.corpo));
    if (!ultima || usadas.has(ultima.id) || mensagens.some((m) => m.autor === "admin" && !m.interno && m.id > ultima.id)) return null;
    return { mensagemId: ultima.id, texto: respostaDaSugestao(ultima.corpo)! };
  });
  const [texto, setTexto] = useState(() => base?.texto ?? "");
  const [gerando, setGerando] = useState(false);
  // E217 (L-70): a sugestão falhou ou não chegou no prazo — aviso discreto, nada bloqueado.
  const [sugestaoFalhou, setSugestaoFalhou] = useState(false);
  const textoAtual = useRef(texto);
  useEffect(() => {
    textoAtual.current = texto;
  }, [texto]);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const devolver = podeDevolverParaViva(c.prioridade, c.status);
  const [interno, setInterno] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [corrigindo, setCorrigindo] = useState<number | null>(null);
  const [correcao, setCorrecao] = useState("");
  const fechado = c.status === "resolvido" || c.status === "encerrado";
  const espera = c.status === "aguardando_usuario" || c.status === "aguardando_aprovacao";
  const avaliadas = new Map(eventos.filter((e) => e.acao === "ia_boa_resposta" || e.acao === "ia_corrigir").map((e) => [Number(e.de), e.acao]));
  const nomeDaPessoa = primeiroNome(pessoa?.nome ?? c.visitante_nome);
  const nome = nomeDaPessoa || "tudo bem";
  const prazo = indicadorDoPrazo(c, new Date(agoraISO));
  const cor = { texto: COR_DO_PRAZO[prazo.tom], barra: `bg-current ${COR_DO_PRAZO[prazo.tom]}` };
  const peloChat = eventos.some((e) => e.acao === "pediu_humano");
  const canal = rotuloCanal(c.canal, peloChat);
  const categoria = rotuloCategoria(c.categoria);
  const linhasDoHistorico = historicoEmLinguagemSimples(eventos, { nomeDaPessoa: nomeDaPessoa || "visitante", canal, categoria });
  const atribuicao = [...eventos].reverse().find((e) => e.acao === "atribuido");
  const responsavel = c.responsavel_tipo === "ia" ? "Viva (IA)" : c.responsavel_admin ? primeiroNome(atribuicao?.ator_nome) || "Equipe" : "Não atribuído";

  // Sem sugestão aberta e com a Viva disponível: pede uma ao abrir (fica guardada como nota).
  const pediu = useRef(false);
  useEffect(() => {
    if (fechado || base || texto || !sugestaoAuto || pediu.current) return;
    if (mensagens.some((m) => m.autor === "admin" && !m.interno)) return; // já respondido: "Gerar outra" sob demanda
    pediu.current = true;
    void gerarOutra(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados]);

  /** Pede uma sugestão à Viva. Nunca trava a resposta manual: falhou ou demorou, só o aviso aparece. */
  async function gerarOutra(pedidaPeloAtendente = true) {
    setGerando(true);
    setSugestaoFalhou(false);
    const r = await sugestaoComPrazo(() => sugerirResposta(c.id));
    setGerando(false);
    if (!r.ok) return setSugestaoFalhou(true);
    // Escreveu enquanto a sugestão vinha: ela fica só como nota na conversa, o texto dele não é apagado.
    if (sugestaoVaiParaACaixa(textoAtual.current, pedidaPeloAtendente)) {
      if (r.valor.mensagemId) setBase({ mensagemId: r.valor.mensagemId, texto: r.valor.texto });
      setTexto(r.valor.texto);
      setInterno(false);
    }
    router.refresh();
  }

  const editada = !!base && texto.trim() !== base.texto.trim();
  // A resposta aparece UMA vez: a sugestão que está inteira na caixa não se repete na conversa.
  const primeiraAutomatica = mensagens.find((m) => !m.interno && (m.autor === "ia" || m.autor === "sistema"))?.id;
  const itens = itensDaConversa(mensagens, eventos, { respostaDaSugestao, naCaixa: base && !editada && !interno ? base.mensagemId : null });

  async function agir(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setOcupado(true);
    setErro(null);
    const res = await fn().catch(() => ({ ok: false, error: "Falha de conexão." }));
    setOcupado(false);
    if (!res.ok) setErro(res.error ?? "Não foi possível.");
    else router.refresh();
    return res.ok;
  }

  /** Põe uma sugestão na caixa (a da barra, ou a de uma nota), pronta para rever. */
  function usarSugestao(mensagemId: number, sugerida: string) {
    setBase({ mensagemId, texto: sugerida });
    setTexto(sugerida);
    setInterno(false);
    caixa.current?.focus();
  }

  async function enviar() {
    // Sugestão inteira → fica registrado que foi enviada como estava; editada → como editada; o resto é resposta da equipe.
    const envio = interno
      ? () => responderComoAdmin(c.id, texto, true)
      : base && !editada
        ? () => aprovarSugestao(c.id, base.mensagemId)
        : base && editada
          ? () => enviarSugestaoEditada(c.id, texto, base.mensagemId)
          : () => responderComoAdmin(c.id, texto, false);
    if (await agir(envio)) {
      setTexto("");
      setBase(null);
    }
  }

  return (
    <>
      <Link href="/admin/atendimento" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline">
        <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Voltar à fila de atendimento</span>
        <span className="sm:hidden">Fila de atendimento</span>
      </Link>

      {pedidoDeAnulacao && !anularSoLeitura && <AnularRegistroCentral chamadoId={c.id} />}
      {contestacaoDeDevolucao && !anularSoLeitura && <DecidirDevolucaoCentral chamadoId={c.id} devolucao={devolucao} />}

      {/* Cabeçalho: o assunto e o estado mandam; o prazo é UM indicador. */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 lg:flex-nowrap" data-testid="chamado-cabecalho">
        <div className="min-w-0 flex-1">
          <h1 className="font-title text-2xl font-semibold text-ink">{c.assunto}</h1>
          <ul className="mt-3 flex flex-wrap gap-2" data-testid="chamado-selos">
            <li className={selo}>{c.numero_publico}</li>
            {/* E1244: a mesma marca da fila (a leitura do detalhe não muda — já abria igual). */}
            {c.simulacao && (
              <li className={selo} data-testid="chamado-simulacao">
                Simulação
              </li>
            )}
            <li className={cn(selo, espera ? "border-amber-300 text-amber-900" : "border-forest/40 text-forest-700")} data-testid="chamado-status">
              <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
              {rotuloStatus(c.status)}
            </li>
            <li className={cn(selo, c.prioridade === "p1" ? "border-red-300 text-red-800" : c.prioridade === "p2" ? "border-amber-300 text-amber-900" : "")} data-testid="chamado-prioridade">
              {rotuloPrioridade(c.prioridade)}
            </li>
            <li className={selo}>{categoria}</li>
            <li className={selo}>{canal}</li>
          </ul>
        </div>
        <div role="status" className="w-full shrink-0 rounded-xl border border-line bg-white p-4 lg:w-80" data-testid="chamado-prazo">
          <p className={cn("flex items-center gap-2 text-sm font-semibold", cor.texto)}>
            <Clock className="h-4 w-4" /> {prazo.titulo}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-ink">{prazo.quando}</p>
          <p className="text-xs text-muted">{linhaDaFalta(prazo)}</p>
          <div aria-hidden className="mt-3 h-1 overflow-hidden rounded-lg bg-surface-3">
            <div className={cn("h-full rounded-lg", cor.barra)} style={{ width: `${Math.round(prazo.fracao * 100)}%` }} />
          </div>
        </div>
      </header>
      {c.status === "aguardando_aprovacao" && (
        <p className="-mt-2 mb-4 text-xs text-muted" data-testid="explica-aprovacao">
          {EXPLICA_AGUARDANDO_APROVACAO}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          <ResumoEAcoes chamadoId={c.id} />

          <Panel title="Conversa">
            <ol className="space-y-4" data-testid="chamado-conversa">
              {itens.map((it) => {
                const m = it.m;
                if (it.tipo === "sugestao" || it.tipo === "nota") {
                  const aberta = it.tipo === "sugestao" && (it.estado === "aberta" || it.estado === "na-caixa");
                  return (
                    <li key={m.id} className="flex gap-3 rounded-xl border border-dashed border-amber-300 bg-white p-4 text-sm" data-testid={it.tipo === "sugestao" ? `nota-sugestao-${it.estado}` : "nota-interna"}>
                      <Lock aria-hidden className="mt-1 h-4 w-4 shrink-0 text-amber-800" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-amber-900">
                          Nota interna · {it.tipo === "sugestao" ? "Sugestão da Viva (IA)" : m.autor === "ia" ? "Viva (IA)" : "Equipe"}
                          <span className="font-normal text-muted"> · {dataEHora(m.criado_em)}</span>
                        </p>
                        {it.tipo === "sugestao" ? (
                          <>
                            <p className="mt-1 text-ink">{it.aviso}</p>
                            {it.texto && <p className="mt-2 whitespace-pre-wrap text-ink">{it.texto}</p>}
                          </>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap text-ink">{m.corpo}</p>
                        )}
                        {!fechado && (aberta || it.tipo === "nota") && (
                          <span className="mt-2 flex flex-wrap items-center gap-3">
                            {m.autor === "ia" && !observadorQa && respostaDaSugestao(m.corpo) && aberta && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={ocupado}
                                data-testid="aprovar-sugestao"
                                onClick={async () => {
                                  if ((await agir(() => aprovarSugestao(c.id, m.id))) && base?.mensagemId === m.id) {
                                    setTexto("");
                                    setBase(null);
                                  }
                                }}
                              >
                                <Send className="h-4 w-4" /> Aprovar e enviar
                              </Button>
                            )}
                            {!observadorQa && (it.tipo === "nota" || it.estado === "aberta") && (
                              <button
                                type="button"
                                onClick={() => (it.tipo === "sugestao" && it.texto ? usarSugestao(m.id, it.texto) : setTexto(m.corpo))}
                                className="text-xs font-semibold text-forest underline"
                              >
                                {it.tipo === "sugestao" ? "Editar antes de enviar" : "Usar como resposta"}
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                }
                const daEquipe = m.autor === "admin";
                const automatica = m.autor === "ia" || m.autor === "sistema";
                return (
                  <li key={m.id} data-testid={daEquipe ? "mensagem-da-equipe" : undefined}>
                    {automatica && m.id === primeiraAutomatica && (
                      <p className="mb-4 flex items-center gap-3 text-xs text-muted" data-testid="confirmacao-automatica">
                        <span aria-hidden className="h-px flex-1 bg-line" />
                        Confirmação automática enviada · {diaEHoraCurtos(m.criado_em).replace(", às ", ", ")}
                        <span aria-hidden className="h-px flex-1 bg-line" />
                      </p>
                    )}
                    <div className="flex gap-3">
                    <Avatar sigla={daEquipe ? "EQ" : automatica ? "IA" : iniciais(nomeDaPessoa)} tom={daEquipe ? "equipe" : automatica ? "ia" : "pessoa"} />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{daEquipe ? "Equipe Viva" : automatica ? "Viva (IA)" : nomeDaPessoa || "Visitante"}</span>
                        <span className="rounded-full border border-line bg-white px-2 py-1 text-[11px] font-semibold text-ink">{daEquipe ? "Resposta enviada" : automatica ? "Automático" : "Solicitante"}</span>
                        <span className="text-xs text-muted">{dataEHora(m.criado_em)}</span>
                      </p>
                      <p className={cn("mt-2 whitespace-pre-wrap rounded-xl border px-4 py-3 text-ink", daEquipe ? "border-forest/20 bg-sage-100" : "border-line bg-surface-2")}>{m.corpo}</p>
                      {m.autor === "ia" && !m.interno && !observadorQa && (
                        <span className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                          {avaliadas.has(m.id) ? (
                            <span className="text-muted">{avaliadas.get(m.id) === "ia_boa_resposta" ? "Marcada como boa resposta" : "Correção registrada"}</span>
                          ) : (
                            <>
                              <button type="button" disabled={ocupado} onClick={() => agir(() => avaliarRespostaIA(c.id, m.id, "boa"))} className="inline-flex items-center gap-1 font-semibold text-forest underline">
                                <ThumbsUp className="h-3.5 w-3.5" /> Boa resposta
                              </button>
                              <button type="button" onClick={() => setCorrigindo(m.id)} className="inline-flex items-center gap-1 font-semibold text-red-700 underline">
                                <Pencil className="h-3.5 w-3.5" /> Corrigir
                              </button>
                            </>
                          )}
                        </span>
                      )}
                      {corrigindo === m.id && (
                        <span className="mt-2 block">
                          <textarea
                            rows={3}
                            value={correcao}
                            onChange={(e) => setCorrecao(e.target.value)}
                            placeholder="Como a Viva deveria ter respondido (vira base para respostas prontas e FAQ)"
                            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="mt-2"
                            disabled={ocupado}
                            onClick={async () => {
                              if (await agir(() => avaliarRespostaIA(c.id, m.id, "corrigir", correcao))) {
                                setCorrigindo(null);
                                setCorrecao("");
                              }
                            }}
                          >
                            Salvar correção
                          </Button>
                        </span>
                      )}
                    </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {c.status !== "encerrado" && !observadorQa && (
              <div className="mt-6 border-t border-line pt-4" data-testid="chamado-responder">
                <div className="inline-flex rounded-lg border border-line bg-surface-2 p-1" role="group" aria-label="Tipo de mensagem">
                  <button type="button" aria-pressed={!interno} onClick={() => setInterno(false)} className={cn("rounded-lg px-3 py-2 text-sm font-semibold", !interno ? "bg-white text-ink" : "text-muted")}>
                    Responder à pessoa
                  </button>
                  <button type="button" aria-pressed={interno} onClick={() => setInterno(true)} className={cn("rounded-lg px-3 py-2 text-sm font-semibold", interno ? "bg-white text-ink" : "text-muted")}>
                    Nota interna
                  </button>
                </div>
                {(base || gerando || sugestaoAuto) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-forest/20 bg-sage-100 px-3 py-2 text-sm" data-testid="sugestao-pronta">
                    <p className="flex min-w-0 basis-full items-center gap-2 font-semibold text-forest-700 sm:flex-1 sm:basis-0">
                      <Sparkles aria-hidden className="h-4 w-4 shrink-0" />
                      {gerando ? "A Viva está escrevendo uma sugestão…" : base ? (editada ? "Sugestão da Viva (IA) editada por você" : "Sugestão da Viva (IA) pronta para este chamado") : "Sem sugestão da Viva (IA) ainda"}
                    </p>
                    <Button size="sm" variant="secondary" disabled={ocupado || gerando || !base || (!editada && !interno)} data-testid="usar-sugestao" onClick={() => base && usarSugestao(base.mensagemId, base.texto)}>
                      Usar sugestão
                    </Button>
                    <Button size="sm" variant="secondary" disabled={ocupado || gerando || !sugestaoAuto} onClick={() => gerarOutra(true)} data-testid="gerar-outra">
                      <Bot className="h-4 w-4" /> Gerar outra
                    </Button>
                  </div>
                )}
                {macros.length > 0 && (
                  <label className="mt-3 block text-xs text-muted">
                    Resposta pronta
                    <select
                      className="mt-1 block w-full rounded-lg border border-line bg-white px-2 py-2 text-sm text-ink"
                      value=""
                      onChange={(e) => {
                        const m = macros.find((x) => x.id === e.target.value);
                        if (m) setTexto((t) => (t ? t + "\n\n" : "") + m.corpo.replaceAll("{nome}", nome));
                      }}
                    >
                      <option value="">Inserir…</option>
                      {macros.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.titulo}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <textarea
                  ref={caixa}
                  rows={5}
                  maxLength={5000}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  aria-label={interno ? "Nota interna" : "Resposta para a pessoa"}
                  className="mt-3 w-full rounded-xl border border-line px-3 py-2 text-sm"
                  placeholder={interno ? "Escreva uma nota só para a equipe…" : "Escreva uma resposta para a pessoa…"}
                />
                {sugestaoFalhou && (
                  <p role="status" className="mt-2 text-xs text-muted" data-testid="sugestao-indisponivel">
                    {AVISO_SUGESTAO_INDISPONIVEL}
                  </p>
                )}
                {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted">{interno ? "A pessoa não vê esta nota." : "A resposta vai por e-mail e fica nesta conversa."}</p>
                  <Button size="sm" disabled={!podeEnviarResposta(texto, ocupado)} aria-describedby={texto.trim() ? undefined : "chamado-dica-caixa-vazia"} data-testid="enviar-resposta" onClick={enviar}>
                    <Send className="h-4 w-4" /> {interno ? "Salvar nota" : "Enviar resposta"}
                  </Button>
                </div>
                {!texto.trim() && (
                  <p id="chamado-dica-caixa-vazia" data-trava-motivo className="mt-2 text-xs text-muted" data-testid="dica-caixa-vazia">
                    {DICA_CAIXA_VAZIA}
                  </p>
                )}
              </div>
            )}
          </Panel>
        </div>

        <aside className="grid content-start gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Panel title="Detalhes">
            <div className="flex items-center gap-3" data-testid="chamado-pessoa">
              <Avatar sigla={iniciais(nomeDaPessoa)} tom="pessoa" />
              {pessoa ? (
                <p className="min-w-0 text-sm font-semibold text-ink">
                  {nomeDaPessoa || "—"}
                  <span className="block text-xs font-normal text-muted">
                    {pessoa.papel === "owner" ? "Proprietário" : pessoa.papel === "tenant" ? "Morador" : pessoa.papel ?? "Cadastrado"} · conta desde {pessoa.criado_em ? dataBR(pessoa.criado_em) : "—"}
                  </span>
                </p>
              ) : (
                <p className="min-w-0 text-sm font-semibold text-ink">
                  Visitante (sem conta)
                  <span className="block text-xs font-normal text-muted">{mascararEmail(c.visitante_email)}</span>
                  {telefoneMascarado(c.visitante_telefone) && <span data-testid="chamado-visitante-telefone" className="block text-xs font-normal text-muted">{telefoneMascarado(c.visitante_telefone)}</span>}
                </p>
              )}
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-2 text-center" data-testid="chamado-numeros">
              {(pessoa ? [[historico.anuncios, "anúncios"], [historico.pedidos, "pedidos"], [historico.chamadosAnteriores + 1, "chamados"]] : [[historico.chamadosAnteriores + 1, "chamados"]]).map(([n, rotulo]) => (
                <li key={rotulo} className="rounded-lg bg-surface-2 px-2 py-2">
                  <b className="block text-base font-semibold text-ink">{n}</b>
                  <span className="text-xs text-muted">{rotulo}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4">
              <Linha k="Responsável" v={responsavel} />
              <Linha k="Aberto em" v={dataEHora(c.criado_em)} />
              <Linha k="Canal" v={canal} />
              <Linha k="Categoria" v={categoria} />
              {c.nota_satisfacao && <Linha k="Nota da pessoa" v={`${c.nota_satisfacao}/5`} />}
              {c.contexto_tipo && (
                <Linha
                  k="Contexto"
                  v={
                    <>
                      {c.contexto_tipo}
                      {contextoLink ? (
                        <>
                          {" "}·{" "}
                          <Link href={contextoLink} className="text-forest underline">abrir</Link>
                        </>
                      ) : null}
                    </>
                  }
                />
              )}
            </dl>
            <div className="mt-4">
              <QuemEAPessoa chamadoId={c.id} />
            </div>
            {c.categoria === "nota_parceiro" && c.contexto_tipo === "parceiro" && <DenunciaNota chamadoId={c.id} jaProcedente={eventos.some((e) => e.acao === "denuncia_procedente")} soLeitura={observadorQa} />}
          </Panel>

          <Panel title="Prazos">
            <p className={cn("text-[15px] font-semibold", cor.texto)} data-testid="chamado-prazos-resumo">{prazo.curto}</p>
            <div aria-hidden className="mb-2 mt-2 h-1 overflow-hidden rounded-lg bg-surface-3">
              <div className={cn("h-full rounded-lg", cor.barra)} style={{ width: `${Math.round(prazo.fracao * 100)}%` }} />
            </div>
            <dl>
              <Linha k="Resolver até" v={dataEHora(c.prazo_resolucao)} />
              <Linha k="Primeira resposta da equipe" v={c.primeira_resposta_em ? diaEHoraCurtos(c.primeira_resposta_em) : "Ainda não respondida"} />
              <Linha k="Prazo da primeira resposta" v={dataEHora(c.prazo_primeira_resposta)} />
            </dl>
          </Panel>

          <Panel title="Ações">
            {observadorQa ? <SoLeituraQa /> : (
            <>
            <label className="block text-xs font-semibold text-muted">
              Prioridade
              <select
                defaultValue={c.prioridade}
                disabled={ocupado}
                onChange={(e) => agir(() => alterarChamado(c.id, { prioridade: e.target.value }))}
                className="mt-2 block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink"
                data-testid="chamado-seletor-prioridade"
              >
                {OPCOES_PRIORIDADE.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2" data-testid="chamado-acoes">
              <Button size="sm" variant="secondary" disabled={ocupado} onClick={() => agir(() => alterarChamado(c.id, { atribuirAMim: true }))}>
                Atribuir a mim
              </Button>
              <Button size="sm" variant="secondary" disabled={ocupado || c.status === "aguardando_aprovacao" || c.status === "encerrado"} onClick={() => agir(() => alterarChamado(c.id, { status: "aguardando_aprovacao" }))}>
                Aprovação interna
              </Button>
              {/* Só P3/P4 voltam para a Viva; P1/P2 ficam sempre com a equipe. */}
              {devolver.ok && c.responsavel_tipo === "humano" && (
                <Button size="sm" variant="secondary" className="col-span-2" disabled={ocupado || !iaAtiva} title={iaAtiva ? undefined : "A Viva está desligada"} onClick={() => agir(() => devolverParaViva(c.id))}>
                  <Bot className="h-4 w-4" /> Devolver para a Viva
                </Button>
              )}
              {c.status !== "resolvido" && c.status !== "encerrado" && (
                <Button size="sm" className="col-span-2" disabled={ocupado} onClick={() => agir(() => alterarChamado(c.id, { status: "resolvido" }))}>
                  Marcar como resolvido
                </Button>
              )}
              {c.status !== "encerrado" && (
                <ConfirmarNaPagina
                  aviso="Encerrar? A pessoa não poderá mais responder neste chamado."
                  confirmar="Encerrar"
                  disabled={ocupado}
                  onConfirmar={() => agir(() => alterarChamado(c.id, { status: "encerrado" }))}
                  testid="chamado-encerrar"
                  className="col-span-2"
                  botaoClassName="inline-flex h-10 w-full items-center justify-center rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 hover:border-red-600 disabled:opacity-60"
                >
                  Encerrar chamado
                </ConfirmarNaPagina>
              )}
            </div>
            </>
            )}
          </Panel>
        </aside>

        <Panel title="Histórico" className="lg:col-start-1 lg:row-start-2">
          <ol className="border-l border-line pl-4" data-testid="chamado-historico">
            {linhasDoHistorico.map((l, i) => (
              <li key={i} className="relative pb-4 last:pb-0">
                <span aria-hidden className={cn("absolute -left-4 top-1 h-3 w-3 -translate-x-1/2 rounded-full border-2", l.tom === "alerta" ? "border-amber-500 bg-current text-amber-500" : l.tom === "chave" ? "border-forest bg-current text-forest" : "border-line bg-white")} />
                <p className="text-xs text-muted">{l.quando}</p>
                <p className="text-sm font-semibold text-ink">{l.oQue}</p>
                {l.detalhe && <p className="text-sm text-muted">{l.detalhe}</p>}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
