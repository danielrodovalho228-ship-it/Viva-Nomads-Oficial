"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  COR_ESQUADRAO,
  NOME_ESQUADRAO,
  ROTULO_STATUS,
  ROTULO_ESTADO,
  SEM_RONDAS,
  avisoOrdem,
  destinoDaOrdem,
  duracao,
  estadoDaOrdem,
  rotuloAcionado,
  linkDaOrdem,
  prioridadesDe,
  statusDoAgente,
  tempoRelativo,
  type Agente,
  type Conversa,
  type Esquadrao,
  type EstadoOrdem,
  type Ronda,
  type StatusAgente,
} from "@/lib/agentes/central";
import { decidirEnvio, dividirResposta, estaNoFim, horaCurta, lerTextoSimples, textoFeito } from "@/lib/agentes/conversa";
import { COR_RONDA_HEX, achadosDaPrioridade, corDaRonda, indicadores, mesclarConversas, proximaDoAgente, resumoCurto, rondaRecente, ultimaPorAgente } from "@/lib/agentes/painel";
import { deixarOrdem, type ChamadoVermelho, type DadosCentral } from "@/lib/data/agentes-actions";
import { AvatarAgente } from "@/components/admin/agentes/avatar";
import { CartoesAprovacao } from "@/components/admin/agentes/cartoes-aprovacao";
import { RedeAoVivo } from "@/components/admin/agentes/rede";
import { AtivarNotificacoes } from "@/components/app/push-app";
import { ChipPrioridade, RaioX } from "@/components/admin/agentes/raiox";
import styles from "@/components/admin/agentes/central.module.css";

/*
  Central de Agentes v2 — o visual do QG dentro do admin: sala de comando
  escura (#050A18 com grade), avatares hexagonais com foto e anel da última
  ronda. Abas: Equipe · Rede ao vivo · Raio-X · Diário de bordo · Conversar ·
  Sala de reunião. Tudo vem do banco (agentes, agentes_rondas, agentes_ordens);
  a página se atualiza sozinha a cada 90 s. "Deixar ordem" grava para a próxima
  ronda; "Executar agora" grava e dispara a rotina real do agente na hora
  (token só no servidor). O chat só conversa: não faz nada no mundo.
*/

const ABAS = ["Equipe", "Rede ao vivo", "Raio-X da Viva", "Diário de bordo", "Conversar", "Sala de reunião"] as const;
type Aba = (typeof ABAS)[number];
const ATUALIZA_MS = 90_000;

const COR_STATUS: Record<StatusAgente, string> = {
  espera: "#7FD321",
  alerta: "#FFB547",
  falhou: "#FF5470",
  sem_ronda: "#8C9AC4",
  no_ar: "#7FD321",
  planejado: "#8C9AC4",
  pausado: "#8C9AC4",
};
const COR_ESTADO: Record<EstadoOrdem, string> = {
  aguardando: "#FFB547",
  enviada: "#38BDF8",
  falhou: "#FF5470",
  em_execucao: "#3D7BFF",
  concluida: "#7FD321",
  cancelada: "#8C9AC4",
};
const COR_RONDA: Record<Ronda["status"], string> = { ok: "#7FD321", alerta: "#FFB547", falhou: "#FF5470" };
const ROTULO_RONDA: Record<Ronda["status"], string> = { ok: "OK", alerta: "Alerta", falhou: "Falhou" };

const mono = { fontFamily: "var(--font-mono-agentes), ui-monospace, monospace" };
const display = { fontFamily: "var(--font-display-agentes), var(--font-jakarta), sans-serif" };

/** Trilha da investigação do gerente ("Moacir → Viva: …", "Viva: …", "Disparei…") vira um bloco recolhido. */
const ehPasso = (c: Conversa) => c.papel === "agente" && (c.autor_slug !== c.agente_slug || /^(Moacir → |Disparei |Não consegui disparar )/.test(c.texto));
function agruparTrilha(thread: Conversa[]): { tipo: "trilha" | "msg"; itens: Conversa[] }[] {
  const out: { tipo: "trilha" | "msg"; itens: Conversa[] }[] = [];
  for (const c of thread) {
    const ult = out[out.length - 1];
    if (ehPasso(c)) {
      if (ult?.tipo === "trilha") ult.itens.push(c);
      else out.push({ tipo: "trilha", itens: [c] });
    } else out.push({ tipo: "msg", itens: [c] });
  }
  return out;
}

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

/** Marca fixa: deixa claro que todo agente da Central é uma IA (a persona é só o jeito de falar). */
function MarcaIA() {
  return (
    <span className="inline-flex items-center rounded-full border border-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C5CFEE]" data-testid="marca-ia">
      agente de IA
    </span>
  );
}

function Chip({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: `${cor}66`, color: cor, background: `${cor}14` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
      {children}
    </span>
  );
}

/** Texto do agente: **negrito** e listas "- " como elementos React (nunca HTML do texto). */
function TextoSimples({ texto }: { texto: string }) {
  const blocos = lerTextoSimples(texto);
  const trechos = (b: (typeof blocos)[number]) => b.trechos.map((t, i) => (t.negrito ? <strong key={i}>{t.texto}</strong> : <span key={i}>{t.texto}</span>));
  return (
    <>
      {blocos.map((b, i) =>
        b.tipo === "li" ? (
          <p key={i} className="ml-4 -indent-3 before:content-['•_']">
            {trechos(b)}
          </p>
        ) : (
          <p key={i} className={i > 0 ? "mt-1" : ""}>
            {trechos(b)}
          </p>
        )
      )}
    </>
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

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 mt-7 flex items-center gap-2.5 text-[11px] uppercase tracking-[.14em] text-[#8C9AC4] after:h-px after:flex-1 after:bg-gradient-to-r after:from-white/15 after:to-transparent">
      {children}
    </h2>
  );
}

const botao = "rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50";
const botaoAzul = `${botao} bg-[#005DFC] text-white hover:bg-[#2C7BFF]`;
const botaoLinha = `${botao} border border-white/15 text-white hover:bg-white/5`;
const campoBase = "rounded-lg border border-white/15 bg-[#0B1430] px-3 py-2 text-sm text-white placeholder:text-[#5d6a93] focus:border-[#3D7BFF] focus:outline-none";
const campo = `w-full ${campoBase}`;

export function CentralAgentes({ dados, vermelhos = [] }: { dados: DadosCentral; vermelhos?: ChamadoVermelho[] }) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("Equipe");
  const [conversarCom, setConversarCom] = useState<string | null>(null);
  const agora = useAgora();
  const porSlug = useMemo(() => Object.fromEntries(dados.agentes.map((a) => [a.slug, a])), [dados.agentes]);
  const kpi = useMemo(() => (agora ? indicadores(dados.agentes, dados.rondas, agora) : null), [dados.agentes, dados.rondas, agora]);
  const [lidoEm, setLidoEm] = useState<Date | null>(null);

  // "Ao vivo": relê o banco a cada 90 s enquanto a aba do navegador está visível.
  useEffect(() => {
    const marca = setTimeout(() => setLidoEm(new Date()), 0);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ATUALIZA_MS);
    return () => {
      clearTimeout(marca);
      clearInterval(t);
    };
  }, [router, dados]);

  function abrirConversa(slug: string) {
    setConversarCom(slug);
    setAba("Conversar");
  }

  return (
    <div
      className="-m-5 min-h-screen overflow-x-hidden text-[#E8EEFF] sm:-m-8"
      style={{
        fontFamily: "var(--font-jakarta), system-ui, sans-serif",
        backgroundColor: "#050A18",
        backgroundImage:
          "radial-gradient(900px 500px at 85% -10%, rgba(0,93,252,.22), transparent 60%), linear-gradient(rgba(61,123,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(61,123,255,0.05) 1px, transparent 1px)",
        backgroundSize: "auto, 40px 40px, 40px 40px",
      }}
      data-testid="central-agentes"
    >
      {vermelhos.length > 0 && (
        <div className="border-b border-[#FF5470]/40 bg-[#FF5470]/15 px-4 py-2.5 text-sm text-[#FFD1D9] sm:px-8" role="alert" data-testid="chamados-vermelhos">
          <b className="text-white">
            {vermelhos.length} chamado{vermelhos.length > 1 ? "s" : ""} sem resposta da equipe há 6 h ou mais:
          </b>{" "}
          {vermelhos.map((c, i) => (
            <span key={c.id}>
              {i > 0 && " · "}
              <a href={`/admin/atendimento/${c.id}`} className="font-semibold text-white underline">
                {c.numero}
              </a>{" "}
              ({c.categoria}, {c.horas} h)
            </span>
          ))}
        </div>
      )}
      <header className="border-b border-white/10 bg-[#050A18]/85 px-4 backdrop-blur sm:px-8 lg:sticky lg:top-0 lg:z-20">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-gradient-to-br from-[#005DFC] to-[#38BDF8] text-[13px] font-bold text-white shadow-[0_0_24px_rgba(0,93,252,.5)]" style={display}>
              VN
            </span>
            <div>
              <h1 className="text-[15px] font-bold tracking-wide text-white" style={display}>
                Central de Agentes
              </h1>
              <p className="text-[11px] uppercase tracking-[.12em] text-[#8C9AC4]">Viva Nomads · sala de comando</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3.5 text-xs text-[#8C9AC4] sm:ml-auto" style={mono}>
            <span>
              Brasília <b className="font-medium text-white">{hora(agora, "America/Sao_Paulo")}</b>
            </span>
            <span>
              Texas <b className="font-medium text-white">{hora(agora, "America/Chicago")}</b>
            </span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-2.5 py-1 text-xs text-[#8C9AC4]">
            <span className={styles.ponto} />
            Ao vivo · dados de {hora(lidoEm, "America/Chicago")} TX
          </span>
        </div>
        <nav className="-mb-px flex gap-1 overflow-x-auto pb-2" role="tablist" style={{ scrollbarWidth: "none" }}>
          {ABAS.map((a) => (
            <button
              key={a}
              role="tab"
              aria-selected={aba === a}
              onClick={() => setAba(a)}
              className={`whitespace-nowrap rounded-[10px] border px-3 py-1.5 text-[13px] font-semibold sm:text-sm ${aba === a ? "border-white/20 bg-[#111F47] text-white" : "border-transparent text-[#8C9AC4] hover:text-white"}`}
            >
              {a}
            </button>
          ))}
        </nav>
      </header>

      {/* Só dentro do app: notificações e atalhos da equipe (no site, escondido por .app-only). */}
      <div className="app-only border-b border-white/10 px-4 py-3" data-testid="atalhos-app">
        <div className="flex flex-wrap gap-2">
          <AtivarNotificacoes className="border-white/20 bg-[#111F47] text-white" />
          <Link href="/admin/documentos" className="grid min-h-11 place-items-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-white">
            Documentos
          </Link>
          <Link href="/admin/atendimento" className="grid min-h-11 place-items-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-white">
            Atendimento
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-8">
        <section className={`grid items-end gap-4 lg:grid-cols-[1.3fr_1fr] lg:gap-6 ${aba === "Equipe" ? "py-7" : "py-4"}`}>
          <div className={aba === "Equipe" ? "" : "hidden lg:block"}>
            <p className="text-[clamp(24px,3.6vw,36px)] font-bold leading-tight tracking-tight text-white" style={display}>
              A equipe trabalhando{" "}
              <span className="bg-gradient-to-r from-[#38BDF8] to-[#7FD321] bg-clip-text text-transparent">24 horas</span>, cada agente com nome e função.
            </p>
            <p className="mt-2 max-w-[60ch] text-sm text-[#8C9AC4]">Status, rondas e achados vêm direto do banco. Converse com um agente, reúna vários de uma vez ou deixe uma ordem para a próxima ronda.</p>
          </div>
          <div className="grid grid-cols-4 gap-2" data-testid="kpis">
            {[
              [kpi?.ativos, "agentes ativos"],
              [kpi?.rondas24h, "rondas em 24 h"],
              [kpi?.falhas, "falharam na última"],
              [kpi?.p1, "achados P1"],
            ].map(([v, l]) => (
              <div key={String(l)} className="min-w-0 rounded-xl border border-white/10 bg-[#0D1838]/60 px-2 py-2 sm:px-3 sm:py-2.5">
                <b className="block text-lg font-medium text-white sm:text-[22px]" style={mono}>
                  {v ?? "–"}
                </b>
                <span className="block text-[9.5px] uppercase leading-tight tracking-wide text-[#8C9AC4] sm:text-[11px] sm:tracking-wider">{l}</span>
              </div>
            ))}
          </div>
        </section>

        {dados.agentes.length === 0 ? (
          <Vazio titulo="Nenhum agente cadastrado" texto="A tabela de agentes está vazia ou a migração 0078 ainda não foi aplicada neste banco." />
        ) : aba === "Equipe" ? (
          <Equipe dados={dados} agora={agora} onConversar={abrirConversa} />
        ) : aba === "Rede ao vivo" ? (
          <RedeAoVivo agentes={dados.agentes} rondas={dados.rondas} agora={agora} />
        ) : aba === "Raio-X da Viva" ? (
          <RaioX agentes={dados.agentes} rondas={dados.rondas} agora={agora} onConversar={abrirConversa} />
        ) : aba === "Diário de bordo" ? (
          <Diario dados={dados} porSlug={porSlug} agora={agora} />
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
function CardAgente({
  a,
  ultima,
  pendentes,
  agora,
  grande = false,
  onConversar,
}: {
  a: Agente;
  ultima?: Ronda;
  pendentes: number;
  agora: Date | null;
  grande?: boolean;
  onConversar: (s: string) => void;
}) {
  const cor = COR_ESQUADRAO[a.esquadrao];
  const st = statusDoAgente(a, ultima);
  const ativo = a.status === "ativo";
  const anel = st === "no_ar" ? COR_STATUS.no_ar : ativo ? COR_RONDA_HEX[corDaRonda(ultima)] : undefined;
  const dur = ultima ? duracao(ultima.iniciada_em, ultima.concluida_em) : null;
  const proxima = agora ? proximaDoAgente(a, agora) : null;
  const p1 = achadosDaPrioridade(ultima, "P0", "P1");
  return (
    <article
      className={`relative grid min-w-0 gap-3 rounded-xl border border-white/10 bg-gradient-to-b from-[#0D1838] to-[#0D1838]/70 transition hover:border-[color:var(--c)] ${grande ? "grid-cols-[64px_1fr] p-3.5" : "grid-cols-[52px_1fr] p-3"} ${ativo ? "" : "opacity-60"}`}
      style={{ ["--c" as string]: `${cor}99` }}
      data-testid={`agente-${a.slug}`}
    >
      <AvatarAgente slug={a.slug} nome={a.nome} cor={cor} anel={anel} recente={!!agora && rondaRecente(ultima, agora)} tamanho={grande ? 64 : 52} />
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-white">
          {a.nome} <MarcaIA /> <Chip cor={COR_STATUS[st]}>{ROTULO_STATUS[st]}</Chip>
        </h3>
        <p className="text-[13px] text-[#8C9AC4]">{a.cargo}</p>
        {st === "no_ar" ? (
          <>
            <p className="mt-2 text-[13px] text-[#C3CDEB]" data-testid="no-ar">
              {SEM_RONDAS[a.slug] ?? "Não faz rondas."}
            </p>
            {a.rotina_texto && (
              <p className="mt-1.5 text-xs text-[#8C9AC4]" style={mono}>
                {a.rotina_texto}
              </p>
            )}
          </>
        ) : ativo ? (
          <>
            <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-xs text-[#8C9AC4]" style={mono}>
              <dt>Última</dt>
              <dd className="text-white" data-testid="ultima-ronda">
                {ultima && agora ? `${tempoRelativo(ultima.iniciada_em, agora)}${dur ? ` · ${dur}` : ""}` : "—"}
              </dd>
              <dt>Próxima</dt>
              <dd className="text-white">{proxima ?? a.rotina_texto ?? "—"}</dd>
              {pendentes > 0 && (
                <>
                  <dt>Ordens</dt>
                  <dd className="text-white">{pendentes} pendente{pendentes > 1 ? "s" : ""}</dd>
                </>
              )}
            </dl>
            {ultima?.resumo && (
              <p className="mt-2 border-l-2 pl-2 text-[12.5px] text-[#C3CDEB]" style={{ borderColor: cor }} data-testid="resumo-ronda">
                {resumoCurto(ultima.resumo)}
              </p>
            )}
            {p1.length > 0 && (
              <ul className="mt-2 space-y-1 text-[12.5px] text-[#FFC2CC]" data-testid="achados-p1">
                {p1.slice(0, 3).map((x, i) => (
                  <li key={i}>
                    <ChipPrioridade p={String(x.prioridade)} />
                    {x.titulo ?? x.detalhe}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button className="rounded-lg bg-[#005DFC] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#2C7BFF]" onClick={() => onConversar(a.slug)}>
                Conversar
              </button>
              {ultima?.link_sessao && (
                <a className="text-xs font-semibold text-[#38BDF8] hover:underline" href={ultima.link_sessao} target="_blank" rel="noopener noreferrer">
                  Abrir última ronda ↗
                </a>
              )}
            </div>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-[#C3CDEB]">
            {a.esquadrao === "plataforma" ? "Vai trabalhar dentro do app, com inquilinos e proprietários." : "Agente proposto. Peça ao Moacir para ativar."}
          </p>
        )}
      </div>
    </article>
  );
}

function Equipe({ dados, agora, onConversar }: { dados: DadosCentral; agora: Date | null; onConversar: (s: string) => void }) {
  const ultimas = useMemo(() => ultimaPorAgente(dados.rondas), [dados.rondas]);
  const pend = (slug: string) => dados.ordens.filter((o) => o.agente_slug === slug && o.status === "pendente").length;
  const card = (a: Agente, grande = false) => <CardAgente key={a.slug} a={a} ultima={ultimas[a.slug]} pendentes={pend(a.slug)} agora={agora} grande={grande} onConversar={onConversar} />;
  // Comando = todo agente do esquadrão (Moacir, Otávio, Rafael…), na ordem do banco.
  const comando = dados.agentes.filter((a) => a.esquadrao === "comando");
  const esquadroes: Esquadrao[] = ["operacoes", "tecnologia", "crescimento", "financas"];
  const plataforma = dados.agentes.filter((a) => a.esquadrao === "plataforma");

  return (
    <div>
      <Rotulo>Donos</Rotulo>
      {/* Não são agentes (não estão em public.agentes): sem status, rondas nem botões. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="grid grid-cols-[72px_1fr] items-center gap-4 rounded-xl border border-[#7FD321]/50 bg-gradient-to-b from-[#0D1838] to-[#0D1838]/70 p-4" data-testid="agente-daniel">
          <AvatarAgente slug="daniel" nome="Daniel Rodovalho" cor="#7FD321" anel="#7FD321" tamanho={72} />
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-white">
              Daniel Rodovalho <Chip cor="#7FD321">Dono</Chip>
            </h3>
            <p className="text-[13px] text-[#8C9AC4]">Fundador · aprova, decide e assina</p>
            <p className="mt-2 text-[13px] text-[#C3CDEB]">Tudo que muda o site, o banco, publica ou manda mensagem passa pelos donos. Os agentes preparam; os donos aprovam.</p>
          </div>
        </article>
        <article className="grid grid-cols-[72px_1fr] items-center gap-4 rounded-xl border border-[#7FD321]/50 bg-gradient-to-b from-[#0D1838] to-[#0D1838]/70 p-4" data-testid="agente-rogerio">
          <AvatarAgente slug="rogerio" nome="Rogério" cor="#7FD321" anel="#7FD321" tamanho={72} />
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-white">
              Rogério <Chip cor="#7FD321">Dono</Chip>
            </h3>
            <p className="text-[13px] text-[#8C9AC4]">Sócio · aprova e decide junto</p>
          </div>
        </article>
      </div>

      <Rotulo>Comando</Rotulo>
      <div className="grid gap-3 lg:grid-cols-2">
        {comando.map((a) => card(a, true))}
      </div>

      <Rotulo>Esquadrões</Rotulo>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {esquadroes.map((e) => {
          const lista = dados.agentes.filter((a) => a.esquadrao === e);
          return (
            <section key={e} className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-white/10 bg-[#0A1430]/55 p-3">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#8C9AC4]">
                <i className="h-2 w-2 rounded-sm" style={{ background: COR_ESQUADRAO[e] }} /> {NOME_ESQUADRAO[e]}
              </h3>
              {lista.length ? lista.map((a) => card(a)) : <p className="text-xs text-[#8C9AC4]">Ninguém neste esquadrão ainda.</p>}
            </section>
          );
        })}
      </div>

      {plataforma.length > 0 && (
        <>
          <Rotulo>{NOME_ESQUADRAO.plataforma} · agentes dentro do app</Rotulo>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{plataforma.map((a) => card(a))}</div>
        </>
      )}
    </div>
  );
}

// ── Diário de bordo ────────────────────────────────────────────────────────
function Diario({ dados, porSlug, agora }: { dados: DadosCentral; porSlug: Record<string, Agente>; agora: Date | null }) {
  const ultimas = useMemo(() => Object.values(ultimaPorAgente(dados.rondas)).sort((x, y) => new Date(y.iniciada_em).getTime() - new Date(x.iniciada_em).getTime()), [dados.rondas]);
  return (
    <div className="mx-auto max-w-3xl">
      <Rotulo>Última ronda de cada agente</Rotulo>
      {ultimas.length === 0 ? (
        <Vazio titulo="Nenhuma ronda registrada ainda" texto="Quando os agentes chamarem registrar_ronda no fim de cada ronda, a última de cada um aparece aqui." />
      ) : (
        <ul className="space-y-2" data-testid="diario">
          {ultimas.map((r) => {
            const a = porSlug[r.agente_slug];
            const achados = (Array.isArray(r.achados) ? r.achados : []).filter((x) => /^P[0-3]$/i.test(String(x?.prioridade ?? "")));
            return (
              <li key={r.id} className="grid grid-cols-[40px_1fr] gap-3 rounded-xl border border-white/10 bg-[#0D1838]/55 p-3">
                {a ? <AvatarAgente slug={a.slug} nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} anel={COR_RONDA[r.status]} recente={!!agora && rondaRecente(r, agora)} tamanho={40} /> : <span />}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-white">{a?.nome ?? r.agente_slug}</b>
                    <Chip cor={COR_RONDA[r.status]}>{ROTULO_RONDA[r.status]}</Chip>
                    <span className="text-xs text-[#8C9AC4]" style={mono}>
                      {dataHora(r.iniciada_em)} BR{agora ? ` · ${tempoRelativo(r.iniciada_em, agora)}` : ""}
                    </span>
                  </div>
                  {r.resumo && <p className="mt-1 text-[13px] text-[#C3CDEB]">{resumoCurto(r.resumo, 260)}</p>}
                  {achados.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-[13px] text-[#C3CDEB]">
                      {achados.slice(0, 5).map((x, i) => (
                        <li key={i}>
                          <ChipPrioridade p={String(x.prioridade)} />
                          {x.titulo ?? x.detalhe}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.link_sessao && (
                    <a href={r.link_sessao} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-[#38BDF8] hover:underline">
                      Abrir ronda ↗
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Rotulo>Histórico</Rotulo>
      <Rondas dados={dados} porSlug={porSlug} agora={agora} />
    </div>
  );
}

function Rondas({ dados, porSlug, agora }: { dados: DadosCentral; porSlug: Record<string, Agente>; agora: Date | null }) {
  const [agente, setAgente] = useState("");
  const [prio, setPrio] = useState("");
  const lista = dados.rondas.filter((r) => (!agente || r.agente_slug === agente) && (!prio || prioridadesDe(r).includes(prio)));
  return (
    <div className="space-y-4">
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
      {dados.rondas.length === 0 ? null : lista.length === 0 ? (
        <Vazio titulo="Nada com esse filtro" texto="Troque o agente ou a prioridade." />
      ) : (
        <ol className="relative space-y-3 border-l border-white/10 pl-5">
          {lista.map((r) => {
            const a = porSlug[r.agente_slug];
            const dur = duracao(r.iniciada_em, r.concluida_em);
            return (
              <li key={r.id} className="relative">
                <span className="absolute -left-[27px] top-3 h-3 w-3 rounded-full ring-4 ring-[#050A18]" style={{ background: COR_RONDA[r.status] }} />
                <div className="rounded-xl border border-white/10 bg-[#0B1430]/80 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-white">{a?.nome ?? r.agente_slug}</b>
                    <Chip cor={COR_RONDA[r.status]}>{ROTULO_RONDA[r.status]}</Chip>
                    <span className="ml-auto text-xs text-[#8C9AC4]" style={mono}>
                      {dataHora(r.iniciada_em)}
                      {agora ? ` · ${tempoRelativo(r.iniciada_em, agora)}` : ""}
                      {dur ? ` · ${dur}` : ""}
                    </span>
                  </div>
                  {r.resumo && <p className="mt-1.5 whitespace-pre-line text-sm text-[#C9D2F0]">{r.resumo}</p>}
                  {Array.isArray(r.achados) && r.achados.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {r.achados.map((x, i) => (
                        <li key={i} className="text-sm text-[#C9D2F0]">
                          <ChipPrioridade p={String(x?.prioridade ?? "—")} />
                          {x?.titulo ?? x?.detalhe ?? ""}
                        </li>
                      ))}
                    </ul>
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
  const [linkSessao, setLinkSessao] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [noFim, setNoFim] = useState(true);
  const [naoLidas, setNaoLidas] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);
  const vistas = useRef({ slug: "", total: 0 });
  const [, startTransition] = useTransition();
  const a = dados.agentes.find((x) => x.slug === slug);
  // Correção de código vai para o Renato (Engenheiro), que abre o PR.
  const destino = a ? dados.agentes.find((x) => x.slug === destinoDaOrdem(a.slug, texto, dados.agentes)) ?? a : null;
  const podeExecutar = (x: Agente | null | undefined) => !!x && x.status === "ativo" && !!x.trigger_id;
  const thread = mesclarConversas(dados.conversas, extra).filter((c) => c.agente_slug === slug);
  const ordens = dados.ordens.filter((o) => o.agente_slug === slug);

  const irParaOFim = useCallback((suave: boolean) => {
    const el = listaRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: suave ? "smooth" : "auto" });
    setNaoLidas(0);
    setNoFim(true);
  }, []);

  // Abrir a conversa (ou trocar de agente) já posiciona na última mensagem. Mensagem nova:
  // acompanha se o usuário está no fim ou foi ele quem escreveu; senão conta como não lida.
  const ultimaDoDaniel = thread[thread.length - 1]?.papel === "daniel";
  useEffect(() => {
    const ref = vistas.current;
    if (ref.slug !== slug) {
      vistas.current = { slug, total: thread.length };
      const t = setTimeout(() => irParaOFim(false), 0);
      return () => clearTimeout(t);
    }
    const novas = thread.length - ref.total;
    vistas.current = { slug, total: thread.length };
    if (novas <= 0) return;
    const el = listaRef.current;
    if (ultimaDoDaniel || (el && estaNoFim(el))) {
      const t = setTimeout(() => irParaOFim(true), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setNaoLidas((n) => n + novas), 0);
    return () => clearTimeout(t);
  }, [slug, thread.length, ultimaDoDaniel, irParaOFim]);

  function aoRolar() {
    const el = listaRef.current;
    if (!el) return;
    const fim = estaNoFim(el);
    setNoFim(fim);
    if (fim) setNaoLidas(0);
  }

  async function enviar() {
    const msg = texto.trim();
    if (!msg || !a || ocupado) return;
    const pergunta = msg;
    setMenu(false);
    setOcupado(true);
    setErro(null);
    setAviso(null);
    setLinkSessao(null);
    const agoraIso = new Date().toISOString();
    setExtra((e) => [...e, { id: `p-${agoraIso}`, agente_slug: slug, papel: "daniel", autor_slug: null, texto: pergunta, criado_em: agoraIso }]);
    setTexto("");
    try {
      const r = await fetch("/api/admin/agentes/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, texto: pergunta }) });
      const j = (await r.json().catch(() => ({}))) as { resposta?: string; erro?: string; acao?: { slug: string; nome: string }; trilha?: { autor: string; texto: string }[] };
      if (!r.ok || !j.resposta) {
        setErro(j.erro ?? "Não consegui falar com o agente agora.");
        return;
      }
      const passos = (j.trilha ?? []).map((p, i) => ({ id: `t-${agoraIso}-${i}`, agente_slug: slug, papel: "agente" as const, autor_slug: p.autor, texto: p.texto, criado_em: new Date().toISOString() }));
      const resposta: Conversa = { id: `r-${agoraIso}`, agente_slug: slug, papel: "agente", autor_slug: slug, texto: j.resposta, criado_em: new Date().toISOString() };
      const rumo = decidirEnvio(pergunta, !!j.acao);
      if (rumo === "pergunta" || !j.acao) {
        setExtra((e) => [...e, ...passos, resposta]);
        return;
      }
      // Pedido de ação: o servidor já respondeu; agora vira ordem (e aciona na hora se for P0/P1/"agora").
      const alvo = j.acao;
      let feito: string;
      if (rumo === "executar") {
        const x = await fetch("/api/admin/agentes/executar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: alvo.slug, texto: pergunta }) });
        const jx = (await x.json().catch(() => ({}))) as { aviso?: string; erro?: string; sessao_url?: string | null; ordemId?: string };
        if (x.ok) {
          feito = textoFeito(alvo.nome, true, new Date().toISOString());
          setLinkSessao(jx.sessao_url ?? null);
        } else if (jx.ordemId) feito = jx.aviso ?? `Registrei a ordem para ${alvo.nome}; o Moacir aciona em até 1 hora.`;
        else feito = jx.erro ?? "Não consegui registrar a ordem agora.";
      } else {
        const o = await deixarOrdem(alvo.slug, pergunta);
        feito = o.ok ? textoFeito(alvo.nome, false, new Date().toISOString()) : (o.erro ?? "Não consegui registrar a ordem agora.");
      }
      setExtra((e) => [...e, ...passos, { ...resposta, texto: feito }]);
      if (alvo.slug !== slug) setSlug(alvo.slug);
      startTransition(() => router.refresh());
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function executar(alvo: string, ordemTexto: string) {
    if (!ordemTexto.trim()) return;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    setLinkSessao(null);
    try {
      const r = await fetch("/api/admin/agentes/executar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: alvo, texto: ordemTexto.trim() }) });
      const j = (await r.json().catch(() => ({}))) as { aviso?: string; erro?: string; sessao_url?: string | null; ordemId?: string };
      if (!r.ok && j.ordemId && j.aviso) setAviso(j.aviso); // ordem gravada: o Moacir aciona em até 1 hora
      else if (!r.ok) setErro(j.erro ?? "Não consegui disparar agora.");
      else {
        setAviso(j.aviso ?? "Disparado.");
        setLinkSessao(j.sessao_url ?? null);
      }
      if (j.ordemId) {
        setTexto("");
        if (alvo !== slug) setSlug(alvo); // mostra a ordem na lista de quem vai fazer
        startTransition(() => router.refresh());
      }
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setOcupado(false);
    }
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
                    setLinkSessao(null);
            }}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left ${x.slug === slug ? "border-[#3D7BFF] bg-[#3D7BFF]/10" : "border-white/10 hover:bg-white/5"}`}
          >
            <AvatarAgente slug={x.slug} nome={x.nome} cor={COR_ESQUADRAO[x.esquadrao]} tamanho={32} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-white">{x.nome} <MarcaIA /></span>
              <span className="hidden truncate text-[11px] text-[#8C9AC4] lg:block">{x.cargo}</span>
            </span>
          </button>
        ))}
      </aside>

      {a && (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col rounded-2xl border border-white/10 bg-[#0B1430]/80" data-testid="chat-agente">
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 p-3">
              <AvatarAgente slug={a.slug} nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} tamanho={44} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-bold text-white">{a.nome} <MarcaIA /></p>
                <p className="truncate text-xs text-[#8C9AC4]">{a.cargo}</p>
              </div>
              <div className="relative">
                <button
                  type="button"
                  aria-label="Mais opções"
                  aria-haspopup="menu"
                  aria-expanded={menu}
                  onClick={() => setMenu((v) => !v)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold leading-none text-white hover:bg-white/10"
                  data-testid="menu-chat"
                >
                  …
                </button>
                {menu && (
                  <div role="menu" className="absolute right-0 top-12 z-20 w-64 rounded-xl border border-white/15 bg-[#0B1430] p-1 shadow-xl">
                    <button
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-3 text-left text-sm font-semibold text-[#B5EC7A] hover:bg-white/5 disabled:opacity-50"
                      disabled={ocupado || !texto.trim() || !podeExecutar(destino)}
                      title={podeExecutar(destino) ? "Grava a ordem e dispara a rotina real agora" : `${destino?.nome ?? "Este agente"} não tem rotina para disparar`}
                      onClick={() => {
                        setMenu(false);
                        if (destino) void executar(destino.slug, texto);
                      }}
                      data-testid="executar-agora"
                    >
                      Executar agora{destino && destino.slug !== a.slug ? ` → ${destino.nome}` : ""}
                    </button>
                    <p className="px-3 pb-2 text-[11px] text-[#8C9AC4]">Escreva a ordem na caixa de texto e depois toque aqui para acionar na hora.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              <div ref={listaRef} onScroll={aoRolar} className="h-full space-y-2 overflow-y-auto overscroll-contain px-3 py-3" aria-live="polite" data-testid="lista-mensagens">
                {thread.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[#8C9AC4]">
                    Nenhuma conversa com {a.nome} ainda. Pergunte algo sobre as rondas, ou peça uma correção: vira ordem.
                  </p>
                ) : (
                  agruparTrilha(thread).map((g) =>
                    g.tipo === "trilha" ? (
                      <details key={g.itens[0].id} data-testid="trilha-gerente" className="ml-3 max-w-[85%] text-xs text-[#AEB9DD]">
                        <summary className="cursor-pointer select-none py-1 text-[#8C9AC4]">ver como apurei ({g.itens.length})</summary>
                        <div className="space-y-1">
                          {g.itens.map((c) => (
                            <div key={c.id} data-testid="passo-gerente" className="whitespace-pre-line border-l-2 border-[#38BDF8]/50 py-0.5 pl-3">
                              {c.texto}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : (
                      <div
                        key={g.itens[0].id}
                        data-testid={g.itens[0].papel === "daniel" ? "bolha-minha" : "bolha-agente"}
                        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${g.itens[0].papel === "daniel" ? "ml-auto rounded-br-sm bg-[#3D7BFF] text-white" : "rounded-bl-sm bg-white/5 text-[#DCE3FA]"}`}
                      >
                        {(() => {
                          const { resumo, detalhes } = g.itens[0].papel === "daniel" ? { resumo: g.itens[0].texto, detalhes: "" } : dividirResposta(g.itens[0].texto);
                          return (
                            <>
                              {g.itens[0].papel === "daniel" ? resumo : <TextoSimples texto={resumo} />}
                              {detalhes && (
                                <details data-testid="resposta-detalhes" className="mt-1">
                                  <summary className="cursor-pointer select-none text-xs font-semibold text-[#38BDF8]">ver detalhes</summary>
                                  <div className="mt-1">
                                    <TextoSimples texto={detalhes} />
                                  </div>
                                </details>
                              )}
                            </>
                          );
                        })()}
                        <span className="mt-1 block text-right text-[10px] opacity-70" style={mono}>
                          {horaCurta(g.itens[0].criado_em)}
                        </span>
                      </div>
                    )
                  )
                )}
                {ocupado && (
                  <div data-testid="digitando" className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 text-sm text-[#8C9AC4]" role="status">
                    <span className="sr-only">{a.nome} está digitando</span>
                    <span aria-hidden>digitando…</span>
                  </div>
                )}
              </div>
              {!noFim && (
                <button
                  type="button"
                  onClick={() => irParaOFim(true)}
                  aria-label="Ir para a última mensagem"
                  data-testid="ir-para-o-fim"
                  className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#0B1430] text-white shadow-lg hover:bg-[#16224a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7BFF]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                  {naoLidas > 0 && (
                    <span data-testid="nao-lidas" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF7A6B] px-1 text-[11px] font-bold text-white">
                      {naoLidas > 9 ? "9+" : naoLidas}
                    </span>
                  )}
                </button>
              )}
            </div>

            <div className="shrink-0 space-y-2 border-t border-white/10 p-3">
              {a.slug === "moacir" && <CartoesAprovacao versao={thread.length} />}
              {aviso && (
                <p className="rounded-lg bg-[#7FD321]/10 px-3 py-2 text-sm text-[#B5EC7A]" data-testid="aviso-ordem">
                  {aviso}{" "}
                  {linkSessao && (
                    <a href={linkSessao} target="_blank" rel="noreferrer" className="font-semibold underline">
                      Abrir a sessão
                    </a>
                  )}
                </p>
              )}
              {erro && <p className="rounded-lg bg-[#FF7A6B]/10 px-3 py-2 text-sm text-[#FFB0A6]">{erro}</p>}
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviar();
                }}
              >
                <textarea
                  aria-label={`Mensagem para ${a.nome}`}
                  rows={1}
                  className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-white/15 bg-[#0B1430] px-4 py-[10px] text-base text-white placeholder:text-[#5d6a93] focus:border-[#3D7BFF] focus:outline-none"
                  placeholder={`Escreva para ${a.nome}…`}
                  value={texto}
                  maxLength={4000}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter envia no computador; Shift+Enter quebra a linha; no celular o Enter do teclado segue quebrando linha.
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                      e.preventDefault();
                      void enviar();
                    }
                  }}
                />
                <button
                  type="submit"
                  aria-label="Enviar"
                  data-testid="enviar"
                  disabled={ocupado || !texto.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#005DFC] text-white hover:bg-[#2C7BFF] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </form>
              <p className="text-[11px] text-[#8C9AC4]">{agora ? avisoOrdem(a, agora).replace(/^O /, "Ordem: o ") : ""}</p>
            </div>
          </div>

          <MemoriaAgente key={a.slug} slug={a.slug} nome={a.nome} />

          <div className="rounded-2xl border border-white/10 bg-[#0B1430]/80 p-4">
            <h3 className="text-sm font-bold text-white">Ordens para {a.nome}</h3>
            {ordens.length === 0 ? (
              <p className="mt-2 text-sm text-[#8C9AC4]">Nenhuma ordem ainda.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {ordens.map((o) => {
                  const estado = estadoDaOrdem(o);
                  const link = linkDaOrdem(o, dados.rondas);
                  return (
                  <li key={o.id} className="border-t border-white/5 pt-3 first:border-0 first:pt-0" data-testid="ordem" data-estado={estado}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip cor={COR_ESTADO[estado]}>{ROTULO_ESTADO[estado]}</Chip>
                      {o.origem_slug && (
                        <span className="text-xs font-semibold text-[#FF7A6B]" data-testid="ordem-origem">
                          {o.retorno_de ? "retorno de" : "encaminhado por"} {dados.agentes.find((x) => x.slug === o.origem_slug)?.nome ?? o.origem_slug}
                          {o.prioridade ? ` · ${o.prioridade}` : ""}
                        </span>
                      )}
                      <span className="text-xs text-[#8C9AC4]" style={mono}>
                        {dataHora(o.criada_em)}
                      </span>
                      {rotuloAcionado(o) && (
                        <span className="text-xs text-[#8C9AC4]" data-testid="ordem-acionado">
                          {rotuloAcionado(o)}
                        </span>
                      )}
                      {link && (
                        <a href={link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#38BDF8] hover:underline">
                          {estado === "concluida" ? "Ver PR / ronda" : "Ver sessão"}
                        </a>
                      )}
                    </div>
                    {estado === "falhou" && o.disparo_erro && <p className="mt-1 text-xs text-[#FFB0A6]">Disparo: {o.disparo_erro}. O Moacir aciona em até 1 hora.</p>}
                    <p className="mt-1 whitespace-pre-line text-sm text-[#DCE3FA]">{o.texto}</p>
                    {o.resposta && <p className="mt-1 whitespace-pre-line border-l-2 border-[#7FD321]/50 pl-2 text-sm text-[#AEB9DD]">{o.resposta}</p>}
                  </li>
                  );
                })}
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
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm ${on ? "border-[#3D7BFF] bg-[#3D7BFF]/15 text-white" : "border-white/15 text-[#8C9AC4] opacity-70"}`}
              >
                <AvatarAgente slug={a.slug} nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} tamanho={24} />
                {a.nome}
                <MarcaIA />
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
                  {a && <AvatarAgente slug={a.slug} nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} tamanho={32} />}
                  <b className="text-white">{a?.nome ?? f.slug}</b> <MarcaIA />
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

// ── Memória: "O que <nome> sabe sobre você" ──────────────────────────────────
function MemoriaAgente({ slug, nome }: { slug: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<{ id: string; fato: string }[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    const vaiAbrir = !aberto;
    setAberto(vaiAbrir);
    if (!vaiAbrir) return;
    setErro(null);
    try {
      const r = await fetch(`/api/admin/agentes/memoria?slug=${encodeURIComponent(slug)}`);
      const j = (await r.json().catch(() => ({}))) as { memorias?: { id: string; fato: string }[]; erro?: string };
      if (!r.ok) setErro(j.erro ?? "Não consegui ler agora.");
      else setItens(j.memorias ?? []);
    } catch {
      setErro("Sem conexão. Tente de novo.");
    }
  }

  async function apagar(id: string) {
    setErro(null);
    try {
      const r = await fetch("/api/admin/agentes/memoria", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (r.ok) setItens((l) => (l ?? []).filter((x) => x.id !== id));
      else setErro("Não consegui apagar agora.");
    } catch {
      setErro("Sem conexão. Tente de novo.");
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1430]/80 p-4">
      <button className={botaoLinha} onClick={abrir} aria-expanded={aberto} data-testid="memoria-abrir">
        O que {nome} sabe sobre você
      </button>
      {aberto && (
        <div className="mt-3" data-testid="memoria-lista">
          {erro && <p className="rounded-lg bg-[#FF7A6B]/10 px-3 py-2 text-sm text-[#FFB0A6]">{erro}</p>}
          {itens && itens.length === 0 && <p className="text-sm text-[#8C9AC4]">{nome} ainda não guardou nada sobre você.</p>}
          {itens && itens.length > 0 && (
            <ul className="space-y-2">
              {itens.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 border-t border-white/5 pt-2 first:border-0 first:pt-0">
                  <span className="text-sm text-[#DCE3FA]">{m.fato}</span>
                  <button className="shrink-0 text-xs font-semibold text-[#FFB0A6] hover:underline" onClick={() => apagar(m.id)} aria-label={`Apagar: ${m.fato}`}>
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
