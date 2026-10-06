"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Clock, Lock, Pencil, Send, ThumbsUp } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { cn, dataBR } from "@/lib/utils";
import { PRAZOS, type Prioridade } from "@/config/atendimento";
import { primeiroNome } from "@/lib/display-name";
import { alterarChamado, avaliarRespostaIA, devolverParaViva, responderComoAdmin, type chamadoAdmin, type Macro } from "@/lib/data/atendimento-actions";
import { mascararEmail, podeDevolverParaViva } from "@/lib/atendimento/copiloto-regras";
import { BotaoSugerir, FontesDaSugestao, QuemEAPessoa, type SugestaoVista } from "./copiloto";
import { relogio } from "../atendimento-client";
import { EXPLICA_AGUARDANDO_APROVACAO } from "@/lib/atendimento/dono";

type Dados = NonNullable<Awaited<ReturnType<typeof chamadoAdmin>>>;
const AUTOR: Record<string, string> = { usuario: "Pessoa", admin: "Equipe", ia: "Viva (IA)", sistema: "Sistema" };
const STATUS: Record<string, string> = {
  aberto: "Aberto",
  aguardando_usuario: "Aguardando usuário",
  aguardando_aprovacao: "Aguardando aprovação interna",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  encerrado: "Encerrado",
};
/** Rótulos do histórico para as ações do copiloto. */
const ACAO: Record<string, string> = {
  consulta_pessoa: "consultou Quem é a pessoa",
  sugestao_ia: "pediu sugestão da Viva",
  devolvido_ia: "devolveu para a Viva",
  mensagem: "mensagem da pessoa",
};

/** Da nota da Viva, "Usar como resposta" pega só a resposta sugerida. */
function respostaDaNota(corpo: string): string {
  const i = corpo.indexOf("Resposta sugerida:\n");
  return i >= 0 ? corpo.slice(i + "Resposta sugerida:\n".length).trim() : corpo;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function ChamadoAdminClient({ dados, macros, agoraISO }: { dados: Dados; macros: Macro[]; agoraISO: string }) {
  const router = useRouter();
  const { chamado: c, mensagens, eventos, pessoa, contextoLink, iaAtiva } = dados;
  const [texto, setTexto] = useState("");
  // Rascunho da Viva: só envia depois de conferir as fontes.
  const [sugestao, setSugestao] = useState<SugestaoVista | null>(null);
  const devolver = podeDevolverParaViva(c.prioridade, c.status);
  const [interno, setInterno] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [corrigindo, setCorrigindo] = useState<number | null>(null);
  const [correcao, setCorrecao] = useState("");
  const avaliadas = new Map(eventos.filter((e) => e.acao === "ia_boa_resposta" || e.acao === "ia_corrigir").map((e) => [Number(e.de), e.acao]));
  const r = relogio(c, new Date(agoraISO));
  const nome = primeiroNome(pessoa?.nome ?? c.visitante_nome) || "tudo bem";

  async function agir(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setOcupado(true);
    setErro(null);
    const res = await fn().catch(() => ({ ok: false, error: "Falha de conexão." }));
    setOcupado(false);
    if (!res.ok) setErro(res.error ?? "Não foi possível.");
    else router.refresh();
    return res.ok;
  }

  return (
    <>
      <Link href="/admin/atendimento" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-forest">
        <ArrowLeft className="h-4 w-4" /> Fila
      </Link>
      <PageTitle title={c.assunto} subtitle={`${c.numero_publico} · ${c.tipo} · ${c.canal} · ${STATUS[c.status] ?? c.status}`} />
      {c.status === "aguardando_aprovacao" && (
        <p className="-mt-2 mb-4 text-xs text-muted" data-testid="explica-aprovacao">
          {EXPLICA_AGUARDANDO_APROVACAO}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <Panel title="Conversa">
            <ol className="space-y-3">
              {mensagens.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm",
                    m.interno ? "border border-dashed border-amber-300 bg-amber-50" : m.autor === "usuario" ? "bg-sage-100" : m.autor === "sistema" ? "bg-surface-2 text-muted" : "border border-line bg-white"
                  )}
                >
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                    {m.interno && <Lock className="h-3.5 w-3.5" />} {AUTOR[m.autor]}
                    {m.interno ? " · nota interna" : ""} · {fmt(m.criado_em)}
                  </span>
                  <span className="whitespace-pre-wrap text-ink">{m.corpo}</span>
                  {m.interno && (
                    <button type="button" onClick={() => setTexto(respostaDaNota(m.corpo))} className="mt-2 block text-xs font-medium text-forest underline">
                      Usar como resposta
                    </button>
                  )}
                  {m.autor === "ia" && !m.interno && (
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {avaliadas.has(m.id) ? (
                        <span className="text-muted">{avaliadas.get(m.id) === "ia_boa_resposta" ? "Marcada como boa resposta" : "Correção registrada"}</span>
                      ) : (
                        <>
                          <button type="button" disabled={ocupado} onClick={() => agir(() => avaliarRespostaIA(c.id, m.id, "boa"))} className="inline-flex items-center gap-1 font-medium text-forest underline">
                            <ThumbsUp className="h-3.5 w-3.5" /> Boa resposta
                          </button>
                          <button type="button" onClick={() => setCorrigindo(m.id)} className="inline-flex items-center gap-1 font-medium text-amber-800 underline">
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
                </li>
              ))}
            </ol>
          </Panel>

          {c.status !== "encerrado" && (
            <Panel title="Responder" className="mt-6">
              {macros.length > 0 && (
                <label className="mb-2 block text-xs text-muted">
                  Resposta pronta
                  <select
                    className="mt-0.5 block w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
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
              <div className="mb-2">
                <BotaoSugerir
                  chamadoId={c.id}
                  disponivel={iaAtiva}
                  onSugestao={(t, sv) => {
                    setTexto(t);
                    setInterno(false);
                    setSugestao(sv);
                  }}
                />
              </div>
              {sugestao && <FontesDaSugestao s={sugestao} onConferir={(v) => setSugestao({ ...sugestao, conferida: v })} />}
              <textarea
                rows={5}
                maxLength={5000}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                placeholder={interno ? "Nota só para a equipe" : `Olá, ${nome}…`}
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} /> Nota interna (a pessoa não vê)
              </label>
              {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
              {sugestao && !sugestao.conferida && !interno && <p className="mt-2 text-xs text-amber-800">Marque &ldquo;Conferi as fontes e o texto&rdquo; para enviar o rascunho da Viva.</p>}
              <Button
                className="mt-3"
                disabled={ocupado || !texto.trim() || (!!sugestao && !sugestao.conferida && !interno)}
                onClick={async () => {
                  if (await agir(() => responderComoAdmin(c.id, texto, interno))) {
                    setTexto("");
                    setSugestao(null);
                  }
                }}
              >
                <Send className="h-4 w-4" /> {interno ? "Salvar nota" : "Enviar resposta (e-mail à pessoa)"}
              </Button>
            </Panel>
          )}
        </div>

        <aside className="grid content-start gap-4">
          <Panel>
            <p className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", r.cor)}>
              <Clock className="h-3.5 w-3.5" /> 1ª resposta: {r.texto}
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted">Prazo 1ª resposta</dt><dd className="text-ink">{fmt(c.prazo_primeira_resposta)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Prazo resolução</dt><dd className="text-ink">{fmt(c.prazo_resolucao)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Aberto em</dt><dd className="text-ink">{fmt(c.criado_em)}</dd></div>
              {c.nota_satisfacao && <div className="flex justify-between gap-2"><dt className="text-muted">Nota</dt><dd className="text-ink">{c.nota_satisfacao}/5</dd></div>}
            </dl>
          </Panel>
          <Panel title="Pessoa">
            {pessoa ? (
              <p className="text-sm text-ink">
                {primeiroNome(pessoa.nome) || "—"} · {pessoa.papel === "owner" ? "proprietário" : pessoa.papel === "tenant" ? "inquilino" : pessoa.papel}
                <span className="block text-xs text-muted">conta desde {pessoa.criado_em ? dataBR(pessoa.criado_em) : "—"}</span>
              </p>
            ) : (
              <p className="text-sm text-ink">
                Visitante (sem conta)
                <span className="block text-xs text-muted">{mascararEmail(c.visitante_email)}</span>
              </p>
            )}
            {c.contexto_tipo && (
              <p className="mt-2 text-sm">
                Contexto: {c.contexto_tipo}
                {contextoLink ? (
                  <>
                    {" "}·{" "}
                    <Link href={contextoLink} className="font-medium text-forest underline">abrir</Link>
                  </>
                ) : null}
              </p>
            )}
          </Panel>
          <Panel title="Quem é a pessoa">
            <QuemEAPessoa chamadoId={c.id} />
          </Panel>
          <Panel title="Ações">
            <label className="block text-xs text-muted">
              Prioridade
              <select
                defaultValue={c.prioridade}
                disabled={ocupado}
                onChange={(e) => agir(() => alterarChamado(c.id, { prioridade: e.target.value }))}
                className="mt-0.5 block w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
              >
                {(["p1", "p2", "p3", "p4"] as Prioridade[]).map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()} — {PRAZOS[p].rotulo}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 grid gap-2">
              <Button variant="outline" disabled={ocupado} onClick={() => agir(() => alterarChamado(c.id, { atribuirAMim: true }))}>
                Atribuir a mim
              </Button>
              {/* Só P3/P4 voltam para a Viva; P1/P2 ficam sempre com a equipe. */}
              {devolver.ok && c.responsavel_tipo === "humano" && (
                <Button variant="outline" disabled={ocupado || !iaAtiva} title={iaAtiva ? undefined : "A Viva está desligada"} onClick={() => agir(() => devolverParaViva(c.id))}>
                  <Bot className="h-4 w-4" /> Devolver para a Viva
                </Button>
              )}
              {c.status !== "aguardando_aprovacao" && c.status !== "encerrado" && (
                <Button variant="outline" disabled={ocupado} onClick={() => agir(() => alterarChamado(c.id, { status: "aguardando_aprovacao" }))}>
                  Mandar para aprovação interna
                </Button>
              )}
              {c.status !== "resolvido" && c.status !== "encerrado" && (
                <Button disabled={ocupado} onClick={() => agir(() => alterarChamado(c.id, { status: "resolvido" }))}>
                  Marcar resolvido (pede a nota)
                </Button>
              )}
              {c.status !== "encerrado" && (
                <Button
                  variant="outline"
                  disabled={ocupado}
                  onClick={() => window.confirm("Encerrar? A pessoa não poderá mais responder neste chamado.") && agir(() => alterarChamado(c.id, { status: "encerrado" }))}
                >
                  Encerrar
                </Button>
              )}
            </div>
          </Panel>
          <Panel title="Histórico">
            <ul className="space-y-1 text-xs text-muted">
              {eventos.map((e, i) => (
                <li key={i}>
                  {fmt(e.criado_em)} · {e.ator_nome ?? e.ator_tipo}: {ACAO[e.acao] ?? e.acao}
                  {e.de || e.para ? ` (${e.de ?? "—"} → ${e.para ?? "—"})` : ""}
                  {e.detalhe ? ` · ${e.detalhe}` : ""}
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}
