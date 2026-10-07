"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  COR_ESQUADRAO,
  NOME_ESQUADRAO,
  ROTULO_STATUS,
  avisoOrdem,
  duracao,
  iniciais,
  prioridadesDe,
  statusDoAgente,
  tempoRelativo,
  type Agente,
  type Conversa,
  type Esquadrao,
  type Ordem,
  type Ronda,
  type StatusAgente,
} from "@/lib/agentes/central";
import { deixarOrdem, type DadosCentral } from "@/lib/data/agentes-actions";

/*
  Central de Agentes — tema escuro próprio (fundo #050A18 com grade sutil),
  Plus Jakarta Sans no texto e JetBrains Mono nos horários. Quatro abas:
  Equipe · Rondas · Conversar · Sala de reunião. O site não dispara agentes:
  ordens ficam no banco e o agente lê na próxima ronda.
*/

const ABAS = ["Equipe", "Rondas", "Conversar", "Sala de reunião"] as const;
type Aba = (typeof ABAS)[number];

const COR_STATUS: Record<StatusAgente, string> = {
  espera: "#7FD321",
  alerta: "#FFB547",
  falhou: "#FF7A6B",
  sem_ronda: "#8C9AC4",
  planejado: "#8C9AC4",
  pausado: "#8C9AC4",
};
const COR_ORDEM: Record<Ordem["status"], string> = { pendente: "#FFB547", lida: "#38BDF8", concluida: "#7FD321", cancelada: "#8C9AC4" };
const ROTULO_ORDEM: Record<Ordem["status"], string> = { pendente: "Pendente", lida: "Lida", concluida: "Concluída", cancelada: "Cancelada" };
const COR_RONDA: Record<Ronda["status"], string> = { ok: "#7FD321", alerta: "#FFB547", falhou: "#FF7A6B" };

const mono = { fontFamily: "var(--font-mono-agentes), ui-monospace, monospace" };

function useAgora(ms = 30_000): Date | null {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    // Só no navegador (evita diferença de hora entre servidor e cliente).
    const primeiro = setTimeout(() => setAgora(new Date()), 0);
    const t = setInterval(() => setAgora(new Date()), ms);
    return () => {
      clearTimeout(primeiro);
      clearInterval(t);
    };
  }, [ms]);
  return agora;
}

const hora = (d: Date | null, tz: string) => (d ? d.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }) : "--:--");
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function Hex({ nome, cor, tamanho = 44 }: { nome: string; cor: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 100 100" aria-hidden className="shrink-0">
      <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill={cor} fillOpacity="0.16" stroke={cor} strokeWidth="4" />
      <text x="50" y="50" dominantBaseline="central" textAnchor="middle" fontSize="32" fontWeight="700" fill={cor}>
        {iniciais(nome)}
      </text>
    </svg>
  );
}

function Chip({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: `${cor}66`, color: cor, background: `${cor}14` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
      {children}
    </span>
  );
}

function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
      <p className="font-semibold text-white">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#8C9AC4]">{texto}</p>
    </div>
  );
}

const botao = "rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50";
const botaoAzul = `${botao} bg-[#3D7BFF] text-white hover:bg-[#2f6af0]`;
const botaoLinha = `${botao} border border-white/15 text-white hover:bg-white/5`;
const campoBase = "rounded-lg border border-white/15 bg-[#0B1430] px-3 py-2 text-sm text-white placeholder:text-[#5d6a93] focus:border-[#3D7BFF] focus:outline-none";
const campo = `w-full ${campoBase}`;

export function CentralAgentes({ dados }: { dados: DadosCentral }) {
  const [aba, setAba] = useState<Aba>("Equipe");
  const [conversarCom, setConversarCom] = useState<string | null>(null);
  const agora = useAgora();
  const porSlug = useMemo(() => Object.fromEntries(dados.agentes.map((a) => [a.slug, a])), [dados.agentes]);

  function abrirConversa(slug: string) {
    setConversarCom(slug);
    setAba("Conversar");
  }

  return (
    <div
      className="-m-5 min-h-screen text-[#E6ECFF] sm:-m-8"
      style={{
        fontFamily: "var(--font-jakarta), system-ui, sans-serif",
        backgroundColor: "#050A18",
        backgroundImage: "linear-gradient(rgba(140,154,196,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(140,154,196,0.06) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
      data-testid="central-agentes"
    >
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050A18]/90 px-4 backdrop-blur sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <h1 className="text-lg font-bold text-white">Central de Agentes</h1>
          <div className="flex gap-4 text-xs text-[#8C9AC4]" style={mono}>
            <span>
              Brasília <b className="text-white">{hora(agora, "America/Sao_Paulo")}</b>
            </span>
            <span>
              Texas <b className="text-white">{hora(agora, "America/Chicago")}</b>
            </span>
          </div>
        </div>
        <nav className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
          {ABAS.map((a) => (
            <button
              key={a}
              role="tab"
              aria-selected={aba === a}
              onClick={() => setAba(a)}
              className={`whitespace-nowrap border-b-2 px-2 py-2 text-[13px] font-semibold sm:px-3 sm:text-sm ${aba === a ? "border-[#3D7BFF] text-white" : "border-transparent text-[#8C9AC4] hover:text-white"}`}
            >
              {a}
            </button>
          ))}
        </nav>
      </header>

      <div className="px-4 py-6 sm:px-8">
        {dados.agentes.length === 0 ? (
          <Vazio titulo="Nenhum agente cadastrado" texto="A tabela de agentes está vazia ou a migração 0078 ainda não foi aplicada neste banco." />
        ) : aba === "Equipe" ? (
          <Equipe dados={dados} agora={agora} onConversar={abrirConversa} />
        ) : aba === "Rondas" ? (
          <Rondas dados={dados} porSlug={porSlug} agora={agora} />
        ) : aba === "Conversar" ? (
          <Conversar dados={dados} inicial={conversarCom} agora={agora} />
        ) : (
          <Sala dados={dados} porSlug={porSlug} />
        )}
      </div>
    </div>
  );
}

// ── Equipe ─────────────────────────────────────────────────────────────────
function CardAgente({ a, ultima, pendentes, agora, onConversar }: { a: Agente; ultima?: Ronda; pendentes: number; agora: Date | null; onConversar: (s: string) => void }) {
  const cor = COR_ESQUADRAO[a.esquadrao];
  const st = statusDoAgente(a, ultima);
  const dur = ultima ? duracao(ultima.iniciada_em, ultima.concluida_em) : null;
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0B1430]/80 p-4" data-testid={`agente-${a.slug}`}>
      <div className="flex items-start gap-3">
        <Hex nome={a.nome} cor={cor} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">{a.nome}</p>
          <p className="text-xs text-[#8C9AC4]">{a.cargo}</p>
          <div className="mt-1.5">
            <Chip cor={COR_STATUS[st]}>{ROTULO_STATUS[st]}</Chip>
          </div>
        </div>
      </div>
      {a.rotina_texto && (
        <p className="text-xs text-[#AEB9DD]" style={mono}>
          {a.rotina_texto}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8C9AC4]">
        <span>
          Última ronda:{" "}
          <b className="text-white" style={mono}>
            {ultima && agora ? `${tempoRelativo(ultima.iniciada_em, agora)}${dur ? ` · ${dur}` : ""}` : "—"}
          </b>
        </span>
        <span>
          Ordens pendentes: <b className="text-white">{pendentes}</b>
        </span>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <button className={botaoLinha} onClick={() => onConversar(a.slug)}>
          Conversar
        </button>
        {ultima?.link_sessao && (
          <a className={botaoLinha} href={ultima.link_sessao} target="_blank" rel="noopener noreferrer">
            Abrir ronda
          </a>
        )}
      </div>
    </article>
  );
}

function Equipe({ dados, agora, onConversar }: { dados: DadosCentral; agora: Date | null; onConversar: (s: string) => void }) {
  const ultima = (slug: string) => dados.rondas.find((r) => r.agente_slug === slug);
  const pend = (slug: string) => dados.ordens.filter((o) => o.agente_slug === slug && o.status === "pendente").length;
  const card = (a: Agente) => <CardAgente key={a.slug} a={a} ultima={ultima(a.slug)} pendentes={pend(a.slug)} agora={agora} onConversar={onConversar} />;
  const moacir = dados.agentes.find((a) => a.slug === "moacir");
  const otavio = dados.agentes.find((a) => a.slug === "otavio");
  const esquadroes: Esquadrao[] = ["operacoes", "tecnologia", "crescimento", "financas"];
  const linha = <div className="mx-auto h-5 w-px bg-white/15" aria-hidden />;

  return (
    <div className="space-y-2">
      <div className="mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-[#3D7BFF]/40 bg-[#0B1430]/80 p-4">
        <Hex nome="Daniel" cor="#E6ECFF" />
        <div>
          <p className="font-bold text-white">Daniel</p>
          <p className="text-xs text-[#8C9AC4]">Dono · aprova tudo que vai para produção</p>
        </div>
      </div>
      {moacir && (
        <>
          {linha}
          <div className="mx-auto max-w-sm">{card(moacir)}</div>
        </>
      )}
      {otavio && (
        <>
          {linha}
          <div className="mx-auto max-w-sm">{card(otavio)}</div>
        </>
      )}
      {linha}
      <div className="grid gap-6 pt-2 md:grid-cols-2 xl:grid-cols-4">
        {esquadroes.map((e) => {
          const lista = dados.agentes.filter((a) => a.esquadrao === e);
          return (
            <section key={e} className="space-y-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: COR_ESQUADRAO[e] }}>
                <span className="h-2 w-2 rounded-full" style={{ background: COR_ESQUADRAO[e] }} /> {NOME_ESQUADRAO[e]}
              </h2>
              {lista.length ? lista.map(card) : <p className="text-xs text-[#8C9AC4]">Ninguém neste esquadrão ainda.</p>}
            </section>
          );
        })}
      </div>
      <section className="space-y-3 pt-8">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: COR_ESQUADRAO.plataforma }}>
          <span className="h-2 w-2 rounded-full" style={{ background: COR_ESQUADRAO.plataforma }} /> {NOME_ESQUADRAO.plataforma}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dados.agentes.filter((a) => a.esquadrao === "plataforma").map((a) => (
            <div key={a.slug} className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 p-3 opacity-80" data-testid={`agente-${a.slug}`}>
              <Hex nome={a.nome} cor={COR_ESQUADRAO.plataforma} tamanho={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{a.nome}</p>
                <p className="truncate text-xs text-[#8C9AC4]">{a.cargo}</p>
              </div>
              <Chip cor={COR_STATUS.planejado}>{ROTULO_STATUS[statusDoAgente(a, undefined)]}</Chip>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Rondas ─────────────────────────────────────────────────────────────────
function Rondas({ dados, porSlug, agora }: { dados: DadosCentral; porSlug: Record<string, Agente>; agora: Date | null }) {
  const [agente, setAgente] = useState("");
  const [prio, setPrio] = useState("");
  const lista = dados.rondas.filter((r) => (!agente || r.agente_slug === agente) && (!prio || prioridadesDe(r).includes(prio)));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap gap-2">
        <select aria-label="Filtrar por agente" className={campoBase} value={agente} onChange={(e) => setAgente(e.target.value)}>
          <option value="">Todos os agentes</option>
          {dados.agentes.filter((a) => a.status !== "planejado").map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.nome}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por prioridade" className={campoBase} value={prio} onChange={(e) => setPrio(e.target.value)}>
          <option value="">Todas as prioridades</option>
          {["P0", "P1", "P2", "P3"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      {dados.rondas.length === 0 ? (
        <Vazio titulo="Nenhuma ronda registrada ainda" texto="Quando os agentes passarem a chamar registrar_ronda no fim de cada ronda, as últimas 50 aparecem aqui." />
      ) : lista.length === 0 ? (
        <Vazio titulo="Nada com esse filtro" texto="Troque o agente ou a prioridade." />
      ) : (
        <ol className="relative space-y-4 border-l border-white/10 pl-5">
          {lista.map((r) => {
            const a = porSlug[r.agente_slug];
            const dur = duracao(r.iniciada_em, r.concluida_em);
            return (
              <li key={r.id} className="relative">
                <span className="absolute -left-[27px] top-3 h-3 w-3 rounded-full ring-4 ring-[#050A18]" style={{ background: COR_RONDA[r.status] }} />
                <div className="rounded-2xl border border-white/10 bg-[#0B1430]/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {a && <Hex nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} tamanho={28} />}
                    <b className="text-white">{a?.nome ?? r.agente_slug}</b>
                    <Chip cor={COR_RONDA[r.status]}>{r.status === "ok" ? "OK" : r.status === "alerta" ? "Alerta" : "Falhou"}</Chip>
                    <span className="ml-auto text-xs text-[#8C9AC4]" style={mono}>
                      {dataHora(r.iniciada_em)}
                      {agora ? ` · ${tempoRelativo(r.iniciada_em, agora)}` : ""}
                      {dur ? ` · ${dur}` : ""}
                    </span>
                  </div>
                  {r.resumo && <p className="mt-2 whitespace-pre-line text-sm text-[#C9D2F0]">{r.resumo}</p>}
                  {Array.isArray(r.achados) && r.achados.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {r.achados.map((x, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="shrink-0 rounded bg-white/10 px-1.5 text-[11px] font-bold text-white" style={mono}>
                            {String(x?.prioridade ?? "—").toUpperCase()}
                          </span>
                          <span className="text-[#C9D2F0]">{x?.titulo ?? x?.detalhe ?? ""}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.link_sessao && (
                    <a href={r.link_sessao} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-[#38BDF8] hover:underline">
                      Abrir ronda
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ── Conversar ──────────────────────────────────────────────────────────────
function Conversar({ dados, inicial, agora }: { dados: DadosCentral; inicial: string | null; agora: Date | null }) {
  const router = useRouter();
  const [slug, setSlug] = useState<string>(inicial ?? dados.agentes[0]?.slug ?? "");
  const [texto, setTexto] = useState("");
  const [extra, setExtra] = useState<Conversa[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [, startTransition] = useTransition();
  const a = dados.agentes.find((x) => x.slug === slug);
  const ids = new Set(dados.conversas.map((c) => c.id));
  const thread = [...dados.conversas, ...extra.filter((c) => !ids.has(c.id))].filter((c) => c.agente_slug === slug);
  const ordens = dados.ordens.filter((o) => o.agente_slug === slug);

  async function perguntar() {
    if (!texto.trim() || !a) return;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    const pergunta = texto.trim();
    const agoraIso = new Date().toISOString();
    setExtra((e) => [...e, { id: `p-${agoraIso}`, agente_slug: slug, papel: "daniel", autor_slug: null, texto: pergunta, criado_em: agoraIso }]);
    setTexto("");
    try {
      const r = await fetch("/api/admin/agentes/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, texto: pergunta }) });
      const j = (await r.json().catch(() => ({}))) as { resposta?: string; erro?: string };
      if (!r.ok || !j.resposta) setErro(j.erro ?? "Não consegui falar com o agente agora.");
      else setExtra((e) => [...e, { id: `r-${agoraIso}`, agente_slug: slug, papel: "agente", autor_slug: slug, texto: j.resposta!, criado_em: new Date().toISOString() }]);
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function ordem() {
    if (!texto.trim() || !a) return;
    setOcupado(true);
    setErro(null);
    const r = await deixarOrdem(slug, texto);
    setOcupado(false);
    if (!r.ok) return setErro(r.erro ?? "Não consegui gravar a ordem.");
    setTexto("");
    setAviso(r.aviso ?? null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Agentes">
        {dados.agentes.map((x) => (
          <button
            key={x.slug}
            onClick={() => {
              setSlug(x.slug);
              setAviso(null);
              setErro(null);
            }}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left ${x.slug === slug ? "border-[#3D7BFF] bg-[#3D7BFF]/10" : "border-white/10 hover:bg-white/5"}`}
          >
            <Hex nome={x.nome} cor={COR_ESQUADRAO[x.esquadrao]} tamanho={28} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">{x.nome}</span>
              <span className="hidden truncate text-[11px] text-[#8C9AC4] lg:block">{x.cargo}</span>
            </span>
          </button>
        ))}
      </aside>

      {a && (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-[#0B1430]/80 p-4">
            <div className="flex items-center gap-3">
              <Hex nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} tamanho={36} />
              <div>
                <p className="font-bold text-white">{a.nome}</p>
                <p className="text-xs text-[#8C9AC4]">{a.cargo}</p>
              </div>
            </div>
            <div className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto" aria-live="polite">
              {thread.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#8C9AC4]">
                  Nenhuma conversa com {a.nome} ainda. Pergunte algo sobre as rondas, ou deixe uma ordem para a próxima.
                </p>
              ) : (
                thread.map((c) => (
                  <div key={c.id} className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${c.papel === "daniel" ? "ml-auto bg-[#3D7BFF] text-white" : "bg-white/5 text-[#DCE3FA]"}`}>
                    {c.texto}
                  </div>
                ))
              )}
              {ocupado && <p className="text-xs text-[#8C9AC4]">{a.nome} está escrevendo…</p>}
            </div>
            <div className="mt-4 space-y-2">
              <textarea className={`${campo} min-h-[80px]`} placeholder={`Escreva para ${a.nome}…`} value={texto} maxLength={4000} onChange={(e) => setTexto(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <button className={botaoAzul} disabled={ocupado || !texto.trim()} onClick={perguntar}>
                  Perguntar
                </button>
                <button className={botaoLinha} disabled={ocupado || !texto.trim()} onClick={ordem}>
                  Deixar ordem
                </button>
                <span className="self-center text-xs text-[#8C9AC4]">{agora ? avisoOrdem(a, agora).replace(/^O /, "Ordem: o ") : ""}</span>
              </div>
              {aviso && <p className="rounded-lg bg-[#7FD321]/10 px-3 py-2 text-sm text-[#B5EC7A]">{aviso}</p>}
              {erro && <p className="rounded-lg bg-[#FF7A6B]/10 px-3 py-2 text-sm text-[#FFB0A6]">{erro}</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0B1430]/80 p-4">
            <h3 className="text-sm font-bold text-white">Ordens para {a.nome}</h3>
            {ordens.length === 0 ? (
              <p className="mt-2 text-sm text-[#8C9AC4]">Nenhuma ordem ainda.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {ordens.map((o) => (
                  <li key={o.id} className="border-t border-white/5 pt-3 first:border-0 first:pt-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip cor={COR_ORDEM[o.status]}>{ROTULO_ORDEM[o.status]}</Chip>
                      <span className="text-xs text-[#8C9AC4]" style={mono}>
                        {dataHora(o.criada_em)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-[#DCE3FA]">{o.texto}</p>
                    {o.resposta && <p className="mt-1 whitespace-pre-line border-l-2 border-[#7FD321]/50 pl-2 text-sm text-[#AEB9DD]">{o.resposta}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Sala de reunião ───────────────────────────────────────────────────────
interface ResultadoReuniao {
  falas: { slug: string; texto: string }[];
  consolidado: { texto: string; passos: { dono: string; acao: string }[] };
  fallback?: boolean;
}

function Sala({ dados, porSlug }: { dados: DadosCentral; porSlug: Record<string, Agente> }) {
  const router = useRouter();
  const ativos = dados.agentes.filter((a) => a.status !== "planejado");
  const [pauta, setPauta] = useState("");
  const [escolhidos, setEscolhidos] = useState<string[]>(["otavio", "bruno"].filter((s) => porSlug[s]));
  const [res, setRes] = useState<ResultadoReuniao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [virou, setVirou] = useState<Record<string, string>>({});

  const alternar = (s: string) => setEscolhidos((e) => (e.includes(s) ? e.filter((x) => x !== s) : [...e, s]));

  async function reunir() {
    setOcupado(true);
    setErro(null);
    setRes(null);
    setVirou({});
    try {
      const r = await fetch("/api/admin/agentes/reuniao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pauta, participantes: escolhidos }) });
      const j = (await r.json().catch(() => ({}))) as ResultadoReuniao & { erro?: string };
      if (!r.ok) setErro(j.erro ?? "Não consegui fazer a reunião agora.");
      else {
        setRes(j);
        router.refresh();
      }
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function virarOrdem(chave: string, slug: string, texto: string) {
    const r = await deixarOrdem(slug, texto);
    setVirou((v) => ({ ...v, [chave]: r.ok ? (r.aviso ?? "Ordem criada.") : (r.erro ?? "Não consegui.") }));
    if (r.ok) router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0B1430]/80 p-4">
        <label className="block text-sm font-bold text-white" htmlFor="pauta">
          Pauta
        </label>
        <textarea id="pauta" className={`${campo} min-h-[80px]`} placeholder="O que a equipe precisa decidir?" value={pauta} maxLength={2000} onChange={(e) => setPauta(e.target.value)} />
        <p className="text-sm font-bold text-white">Participantes</p>
        <div className="flex flex-wrap gap-2">
          {ativos.map((a) => {
            const fixo = a.slug === "moacir";
            const on = fixo || escolhidos.includes(a.slug);
            return (
              <button
                key={a.slug}
                disabled={fixo}
                onClick={() => alternar(a.slug)}
                aria-pressed={on}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${on ? "border-[#3D7BFF] bg-[#3D7BFF]/15 text-white" : "border-white/15 text-[#8C9AC4]"}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: COR_ESQUADRAO[a.esquadrao] }} />
                {a.nome}
                {fixo && <span className="text-[10px]">(fecha)</span>}
              </button>
            );
          })}
        </div>
        <button className={botaoAzul} disabled={ocupado || !pauta.trim() || escolhidos.filter((s) => s !== "moacir").length === 0} onClick={reunir}>
          {ocupado ? "Reunindo…" : "Começar reunião"}
        </button>
        {erro && <p className="rounded-lg bg-[#FF7A6B]/10 px-3 py-2 text-sm text-[#FFB0A6]">{erro}</p>}
      </div>

      {res && (
        <div className="space-y-3" data-testid="ata">
          {res.falas.map((f, i) => {
            const a = porSlug[f.slug];
            const chave = `f${i}`;
            return (
              <div key={chave} className="rounded-2xl border border-white/10 bg-[#0B1430]/80 p-4">
                <div className="flex items-center gap-2">
                  {a && <Hex nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} tamanho={28} />}
                  <b className="text-white">{a?.nome ?? f.slug}</b>
                  <span className="text-xs text-[#8C9AC4]">{a?.cargo}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-[#DCE3FA]">{f.texto}</p>
                <div className="mt-2">
                  {virou[chave] ? (
                    <p className="text-xs text-[#B5EC7A]">{virou[chave]}</p>
                  ) : (
                    <button className="text-xs font-semibold text-[#38BDF8] hover:underline" onClick={() => virarOrdem(chave, f.slug, f.texto)}>
                      Virar ordem
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="rounded-2xl border border-[#3D7BFF]/40 bg-[#3D7BFF]/10 p-4">
            <p className="text-sm font-bold text-white">{res.fallback ? "Reunião não concluída" : "Consolidado do Moacir"}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-[#DCE3FA]">{res.consolidado.texto}</p>
            {res.consolidado.passos.length > 0 && (
              <ol className="mt-3 space-y-2">
                {res.consolidado.passos.map((p, i) => {
                  const chave = `p${i}`;
                  const dono = porSlug[p.dono];
                  return (
                    <li key={chave} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <b className="text-white">
                        {i + 1}. {dono?.nome ?? p.dono}
                      </b>
                      <span className="text-[#DCE3FA]">{p.acao}</span>
                      {dono &&
                        (virou[chave] ? (
                          <span className="text-xs text-[#B5EC7A]">{virou[chave]}</span>
                        ) : (
                          <button className="text-xs font-semibold text-[#38BDF8] hover:underline" onClick={() => virarOrdem(chave, p.dono, p.acao)}>
                            Virar ordem
                          </button>
                        ))}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#0B1430]/80 p-4">
        <h3 className="text-sm font-bold text-white">Atas anteriores</h3>
        {dados.atas.length === 0 ? (
          <p className="mt-2 text-sm text-[#8C9AC4]">Nenhuma reunião ainda. A ata de cada reunião fica guardada aqui.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {dados.atas.map((c) => (
              <li key={c.id}>
                <details className="rounded-xl border border-white/5 p-3">
                  <summary className="cursor-pointer text-sm text-white">
                    <span className="text-xs text-[#8C9AC4]" style={mono}>
                      {dataHora(c.criado_em)}
                    </span>{" "}
                    {c.texto.split("\n")[0].replace(/^Pauta: /, "")}
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm text-[#C9D2F0]">{c.texto}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
