"use client";

import { ABAS_AGENTES, abaDaUrl, type AbaAgentes } from "@/lib/admin/agentes-abas";
import { dataHoraBRT, horaBRT } from "@/lib/datas-brasilia";
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
  podeAceitarOrdem,
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
import { decidirEnvio, dividirResposta, estaNoFim, horaCurta, lerTextoSimples, moverTrocaParaAgente, textoFeito } from "@/lib/agentes/conversa";
import { COR_RONDA_HEX, achadosDaPrioridade, corDaRonda, indicadores, mesclarConversas, proximaDoAgente, resumoCurto, rondaRecente, ultimaPorAgente } from "@/lib/agentes/painel";
import { carregarAtas, carregarConversas, deixarOrdem, responderAceiteOrdem, type ChamadoVermelho, type DadosCentral } from "@/lib/data/agentes-actions";
import { AvatarAgente } from "@/components/admin/agentes/avatar";
import { buttonClasses } from "@/components/ui/button";
import { CartoesAprovacao } from "@/components/admin/agentes/cartoes-aprovacao";
import { RedeAoVivo } from "@/components/admin/agentes/rede";
import { AtivarNotificacoes } from "@/components/app/push-app";
import { ChipPrioridade, RaioX } from "@/components/admin/agentes/raiox";
import styles from "@/components/admin/agentes/central.module.css";
import { estadoDaCentral } from "@/lib/agentes/selo-vivo";

/*
  Central de Agentes v2 — ADMIN-5: nos tokens do admin (fundo claro, sem o tema escuro do QG), avatares hexagonais
  com foto e anel da última ronda; o chat e as atas são lidos só quando a aba abre, com paginação. Abas: Equipe · Rede ao vivo · Raio-X · Diário de bordo · Conversar ·
  Sala de reunião. Tudo vem do banco (agentes, agentes_rondas, agentes_ordens);
  a página se atualiza sozinha a cada 90 s. "Deixar ordem" grava para a próxima
  ronda; "Executar agora" grava e dispara a rotina real do agente na hora
  (token só no servidor). O chat só conversa: não faz nada no mundo.
*/

// ADMIN-2: "Aprovações" é aba (?aba=aprovacoes; o antigo #aprovacoes abre a mesma aba).
const ABAS = ABAS_AGENTES;
type Aba = AbaAgentes;
const ATUALIZA_MS = 90_000;

const COR_STATUS: Record<StatusAgente, string> = {
  espera: "#15803D",
  alerta: "#B45309",
  falhou: "#B91C1C",
  sem_ronda: "#6B7280",
  no_ar: "#15803D",
  planejado: "#6B7280",
  pausado: "#6B7280",
};
const COR_ESTADO: Record<EstadoOrdem, string> = {
  aguardando: "#B45309",
  enviada: "#0369A1",
  falhou: "#B91C1C",
  em_execucao: "#1D4ED8",
  aguardando_aceite: "#B45309",
  concluida: "#15803D",
  cancelada: "#6B7280",
};
const COR_RONDA: Record<Ronda["status"], string> = { ok: "#15803D", alerta: "#B45309", falhou: "#B91C1C" };
const ROTULO_RONDA: Record<Ronda["status"], string> = { ok: "OK", alerta: "Alerta", falhou: "Falhou" };

const mono = { fontVariantNumeric: "tabular-nums" } as const;

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

// Relógio do Texas (sócio nos EUA): o único fuso fora de Brasília no admin, de propósito.
const horaTexas = (d: Date | null) => (d ? d.toLocaleTimeString("pt-BR", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit" }) : "--:--");
const dataHora = (iso: string) => dataHoraBRT(iso, { tabela: true });

/** Marca fixa: deixa claro que todo agente da Central é uma IA (a persona é só o jeito de falar). */
function MarcaIA() {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-2 py-1 text-[10px] font-semibold text-ink" data-testid="marca-ia">
      agente de IA
    </span>
  );
}

function Chip({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: `${cor}66`, color: cor, background: `${cor}14` }}>
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

function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao?: { rotulo: string; href: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-8 text-center" data-testid="central-vazio">
      <p className="font-semibold text-ink">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{texto}</p>
      {acao && (
        <Link href={acao.href} className="mt-4 inline-grid min-h-11 place-items-center rounded-xl border border-line px-4 text-sm font-semibold text-ink">
          {acao.rotulo}
        </Link>
      )}
    </div>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-8 flex items-center gap-3 text-[11px] text-muted after:h-px after:flex-1 after:bg-line">
      {children}
    </h2>
  );
}

const botao = "rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50";
const botaoAzul = buttonClasses({ size: "sm" });
const botaoLinha = `${botao} border border-line text-ink hover:bg-surface-2`;
const campoBase = "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-forest focus:outline-none";
const campo = `w-full ${campoBase}`;

export function CentralAgentes({ dados, vermelhos = [], abaInicial = "Equipe" }: { dados: DadosCentral; vermelhos?: ChamadoVermelho[]; abaInicial?: Aba }) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(abaInicial);
  // O link antigo /admin/agentes#aprovacoes (o hash não chega ao servidor) abre a aba Aprovações.
  useEffect(() => {
    if (abaDaUrl(null, window.location.hash) !== "Aprovações") return;
    const t = window.setTimeout(() => setAba("Aprovações"), 0);
    return () => window.clearTimeout(t);
  }, []);
  const [conversarCom, setConversarCom] = useState<string | null>(null);
  const agora = useAgora();
  const porSlug = useMemo(() => Object.fromEntries(dados.agentes.map((a) => [a.slug, a])), [dados.agentes]);
  // E74: sem acesso às tabelas, os números ficam "–" (não 0): zero seria afirmar que a equipe parou.
  const kpi = useMemo(() => (agora && dados.acessoLiberado ? indicadores(dados.agentes, dados.rondas, agora) : null), [dados.agentes, dados.rondas, dados.acessoLiberado, agora]);
  const estado = useMemo(() => estadoDaCentral({ acessoLiberado: dados.acessoLiberado, agentes: dados.agentes, rondas: dados.rondas, agora: agora ?? new Date(0) }), [dados, agora]);
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
    <div className="overflow-x-hidden text-ink" data-testid="central-agentes">
      {vermelhos.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-800" role="alert" data-testid="chamados-vermelhos">
          <b className="text-ink">
            {vermelhos.length} chamado{vermelhos.length > 1 ? "s" : ""} sem resposta da equipe há 6 h ou mais:
          </b>{" "}
          {vermelhos.map((c, i) => (
            <span key={c.id}>
              {i > 0 && " · "}
              <a href={`/admin/atendimento/${c.id}`} className="font-semibold text-ink underline">
                {c.numero}
              </a>{" "}
              ({c.categoria}, {c.horas} h)
            </span>
          ))}
        </div>
      )}
      <header className="border-b border-line bg-white">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <div>
            <h1 className="font-title text-2xl font-semibold text-ink sm:text-[28px]">Central de Agentes</h1>
            <p className="text-sm text-muted">A equipe de agentes de IA da Viva: rondas, ordens e conversas.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted sm:ml-auto" style={mono}>
            <span>
              Brasília <b className="font-semibold text-ink">{agora ? horaBRT(agora) : "--:--"}</b>
            </span>
            <span>
              Texas <b className="font-semibold text-ink">{horaTexas(agora)}</b>
            </span>
          </div>
          {/* E74: "Ao vivo" só com acesso às tabelas e ronda recente; fora disso, o selo diz o que está acontecendo. */}
          <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-muted" data-testid="selo-central" data-tipo={agora ? estado.tipo : "carregando"}>
            {agora && estado.tipo === "ao_vivo" ? (
              <>
                <span className={styles.ponto} />
                Ao vivo · dados de {horaTexas(lidoEm)} TX
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-muted" />
                {agora ? estado.selo : "Carregando…"}
              </>
            )}
          </span>
        </div>
        <nav className="-mb-px flex gap-1 overflow-x-auto pb-2" role="tablist" style={{ scrollbarWidth: "none" }}>
          {ABAS.map((a) => (
            <button
              key={a}
              role="tab"
              aria-selected={aba === a}
              data-testid={a === "Aprovações" ? "aba-aprovacoes" : undefined}
              onClick={() => setAba(a)}
              className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[13px] font-semibold sm:text-sm ${aba === a ? "border-line bg-surface-2 text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {a}
            </button>
          ))}
        </nav>
      </header>

      {/* Só dentro do app: notificações e atalhos da equipe (no site, escondido por .app-only). */}
      <div className="app-only border-b border-line px-4 py-3" data-testid="atalhos-app">
        <div className="flex flex-wrap gap-2">
          <AtivarNotificacoes className="border-line bg-surface-2 text-ink" />
          <Link href="/admin/documentos" className="grid min-h-11 place-items-center rounded-xl border border-line px-4 text-sm font-semibold text-ink">
            Documentos
          </Link>
          <Link href="/admin/atendimento" className="grid min-h-11 place-items-center rounded-xl border border-line px-4 text-sm font-semibold text-ink">
            Atendimento
          </Link>
        </div>
      </div>

      <div className="pb-16">
        <section className={`grid items-end gap-4 lg:grid-cols-[1.3fr_1fr] lg:gap-6 ${aba === "Equipe" ? "py-8" : "py-4"}`}>
          <div className={aba === "Equipe" ? "" : "hidden lg:block"}>
            <p className="font-title text-xl font-semibold text-ink">
              A equipe trabalhando{" "}
              <span className="text-forest">24 horas</span>, cada agente com nome e função.
            </p>
            <p className="mt-2 max-w-[60ch] text-sm text-muted">Status, rondas e achados vêm direto do banco. Converse com um agente, reúna vários de uma vez ou deixe uma ordem para a próxima ronda.</p>
          </div>
          <div className="grid grid-cols-4 gap-2" data-testid="kpis">
            {[
              [kpi?.ativos, "agentes ativos"],
              [kpi?.rondas24h, "rondas em 24 h"],
              [kpi?.falhas, "falharam na última"],
              [kpi?.p1, "achados P1 (última ronda)"],
            ].map(([v, l]) => (
              <div key={String(l)} className="min-w-0 rounded-xl border border-line bg-white px-2 py-2 sm:px-3 sm:py-3">
                <b className="block text-lg font-semibold text-ink sm:text-[22px]" style={mono}>
                  {v ?? "–"}
                </b>
                <span className="block text-[9.5px] leading-tight text-muted sm:text-[11px]">{l}</span>
              </div>
            ))}
          </div>
        </section>

        {aba === "Aprovações" ? (
          <section id="aprovacoes" aria-label="Aprovações" className="scroll-mt-24" data-testid="secao-aprovacoes">
            <h2 className="mb-2 text-sm font-semibold text-muted">Aprovações</h2>
            <CartoesAprovacao versao={0} mostrarVazio />
          </section>
        ) : estado.vazio ? (
          <Vazio titulo={estado.vazio.titulo} texto={estado.vazio.texto} acao={estado.vazio.acao} />
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
      className={`relative grid min-w-0 gap-3 rounded-xl border border-line bg-white transition hover:border-[color:var(--c)] ${grande ? "grid-cols-[64px_1fr] p-4" : "grid-cols-[52px_1fr] p-3"} ${ativo ? "" : "opacity-60"}`}
      style={{ ["--c" as string]: `${cor}99` }}
      data-testid={`agente-${a.slug}`}
    >
      <AvatarAgente slug={a.slug} nome={a.nome} cor={cor} anel={anel} recente={!!agora && rondaRecente(ultima, agora)} tamanho={grande ? 64 : 52} />
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
          {a.nome} <MarcaIA /> <Chip cor={COR_STATUS[st]}>{ROTULO_STATUS[st]}</Chip>
        </h3>
        <p className="text-[13px] text-muted">{a.cargo}</p>
        {st === "no_ar" ? (
          <>
            <p className="mt-2 text-[13px] text-ink" data-testid="no-ar">
              {SEM_RONDAS[a.slug] ?? "Não faz rondas."}
            </p>
            {a.rotina_texto && (
              <p className="mt-2 text-xs text-muted" style={mono}>
                {a.rotina_texto}
              </p>
            )}
          </>
        ) : ativo ? (
          <>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted" style={mono}>
              <dt>Última</dt>
              <dd className="text-ink" data-testid="ultima-ronda">
                {ultima && agora ? `${tempoRelativo(ultima.iniciada_em, agora)}${dur ? ` · ${dur}` : ""}` : "—"}
              </dd>
              <dt>Próxima</dt>
              <dd className="text-ink">{proxima ?? a.rotina_texto ?? "—"}</dd>
              {pendentes > 0 && (
                <>
                  <dt>Ordens</dt>
                  <dd className="text-ink">{pendentes} pendente{pendentes > 1 ? "s" : ""}</dd>
                </>
              )}
            </dl>
            {ultima?.resumo && (
              <p className="mt-2 border-l-2 pl-2 text-[12.5px] text-ink" style={{ borderColor: cor }} data-testid="resumo-ronda">
                {resumoCurto(ultima.resumo)}
              </p>
            )}
            {p1.length > 0 && (
              <ul className="mt-2 space-y-1 text-[12.5px] text-red-800" data-testid="achados-p1">
                {p1.slice(0, 3).map((x, i) => (
                  <li key={i}>
                    <ChipPrioridade p={String(x.prioridade)} />
                    {x.titulo ?? x.detalhe}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className={buttonClasses({ size: "sm" })} onClick={() => onConversar(a.slug)}>
                Conversar
              </button>
              {ultima?.link_sessao && (
                <a className="text-xs font-semibold text-forest hover:underline" href={ultima.link_sessao} target="_blank" rel="noopener noreferrer">
                  Abrir última ronda ↗
                </a>
              )}
            </div>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-ink">
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
        <article className="grid grid-cols-[72px_1fr] items-center gap-4 rounded-xl border border-line bg-white p-4" data-testid="agente-daniel">
          <AvatarAgente slug="daniel" nome="Daniel Rodovalho" cor="#15803D" anel="#15803D" tamanho={72} />
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
              Daniel Rodovalho <Chip cor="#15803D">Dono</Chip>
            </h3>
            <p className="text-[13px] text-muted">Fundador · aprova, decide e assina</p>
            <p className="mt-2 text-[13px] text-ink">Tudo que muda o site, o banco, publica ou manda mensagem passa pelos donos. Os agentes preparam; os donos aprovam.</p>
          </div>
        </article>
        <article className="grid grid-cols-[72px_1fr] items-center gap-4 rounded-xl border border-line bg-white p-4" data-testid="agente-rogerio">
          <AvatarAgente slug="rogerio" nome="Rogério" cor="#15803D" anel="#15803D" tamanho={72} />
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
              Rogério <Chip cor="#15803D">Dono</Chip>
            </h3>
            <p className="text-[13px] text-muted">Sócio · aprova e decide junto</p>
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
            <section key={e} className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface-2 p-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-muted">
                <i className="h-2 w-2 rounded-lg" style={{ background: COR_ESQUADRAO[e] }} /> {NOME_ESQUADRAO[e]}
              </h3>
              {lista.length ? lista.map((a) => card(a)) : <p className="text-xs text-muted">Ninguém neste esquadrão ainda.</p>}
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
    <div className="w-full">
      <Rotulo>Última ronda de cada agente</Rotulo>
      {ultimas.length === 0 ? (
        <Vazio titulo="Nenhuma ronda registrada ainda" texto="Quando os agentes chamarem registrar_ronda no fim de cada ronda, a última de cada um aparece aqui." />
      ) : (
        <ul className="space-y-2" data-testid="diario">
          {ultimas.map((r) => {
            const a = porSlug[r.agente_slug];
            const achados = (Array.isArray(r.achados) ? r.achados : []).filter((x) => /^P[0-3]$/i.test(String(x?.prioridade ?? "")));
            return (
              <li key={r.id} className="grid grid-cols-[40px_1fr] gap-3 rounded-xl border border-line bg-white p-3">
                {a ? <AvatarAgente slug={a.slug} nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} anel={COR_RONDA[r.status]} recente={!!agora && rondaRecente(r, agora)} tamanho={40} /> : <span />}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-ink">{a?.nome ?? r.agente_slug}</b>
                    <Chip cor={COR_RONDA[r.status]}>{ROTULO_RONDA[r.status]}</Chip>
                    <span className="text-xs text-muted" style={mono}>
                      {dataHora(r.iniciada_em)}{agora ? ` · ${tempoRelativo(r.iniciada_em, agora)}` : ""}
                    </span>
                  </div>
                  {r.resumo && <p className="mt-1 text-[13px] text-ink">{resumoCurto(r.resumo, 260)}</p>}
                  {achados.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[13px] text-ink">
                      {achados.slice(0, 5).map((x, i) => (
                        <li key={i}>
                          <ChipPrioridade p={String(x.prioridade)} />
                          {x.titulo ?? x.detalhe}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.link_sessao && (
                    <a href={r.link_sessao} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-forest hover:underline">
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
        <ol className="relative space-y-3 border-l border-line pl-4">
          {lista.map((r) => {
            const a = porSlug[r.agente_slug];
            const dur = duracao(r.iniciada_em, r.concluida_em);
            return (
              <li key={r.id} className="relative">
                <span className="absolute -left-[27px] top-3 h-3 w-3 rounded-full ring-4 ring-white" style={{ background: COR_RONDA[r.status] }} />
                <div className="rounded-xl border border-line bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-ink">{a?.nome ?? r.agente_slug}</b>
                    <Chip cor={COR_RONDA[r.status]}>{ROTULO_RONDA[r.status]}</Chip>
                    <span className="ml-auto text-xs text-muted" style={mono}>
                      {dataHora(r.iniciada_em)}
                      {agora ? ` · ${tempoRelativo(r.iniciada_em, agora)}` : ""}
                      {dur ? ` · ${dur}` : ""}
                    </span>
                  </div>
                  {r.resumo && <p className="mt-2 whitespace-pre-line text-sm text-ink">{r.resumo}</p>}
                  {Array.isArray(r.achados) && r.achados.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {r.achados.map((x, i) => (
                        <li key={i} className="text-sm text-ink">
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
  // ADMIN-5: o chat é lido só quando esta aba abre (e por agente), 50 mensagens por vez.
  const [historico, setHistorico] = useState<{ slug: string; itens: Conversa[]; temMais: boolean } | null>(null);
  const [lendoAntigas, setLendoAntigas] = useState(false);
  useEffect(() => {
    if (!slug) return;
    let vivo = true;
    carregarConversas(slug)
      .then((p) => vivo && setHistorico({ slug, ...p }))
      .catch(() => vivo && setHistorico({ slug, itens: [], temMais: false }));
    return () => {
      vivo = false;
    };
  }, [slug]);
  const carregandoChat = historico?.slug !== slug;
  const salvas = historico?.slug === slug ? historico.itens : [];
  async function verAnteriores() {
    if (!historico || !historico.itens[0] || lendoAntigas) return;
    setLendoAntigas(true);
    const el = listaRef.current;
    const altura = el?.scrollHeight ?? 0;
    try {
      const p = await carregarConversas(slug, historico.itens[0].criado_em);
      setHistorico((h) => (h && h.slug === slug ? { slug, itens: [...p.itens, ...h.itens], temMais: p.temMais } : h));
      // Mantém na tela a mensagem que estava no topo.
      setTimeout(() => {
        if (el) el.scrollTop += el.scrollHeight - altura;
      }, 0);
    } finally {
      setLendoAntigas(false);
    }
  }
  const thread = mesclarConversas(salvas, extra).filter((c) => c.agente_slug === slug);
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
      const troca = [...passos, { ...resposta, texto: feito }];
      setExtra((e) => {
        const todas = [...e, ...troca];
        // Se o chat vai para o agente alvo, a troca deste pedido vai junto (senão o balão some).
        return alvo.slug !== slug ? moverTrocaParaAgente(todas, [`p-${agoraIso}`, ...troca.map((m) => m.id)], alvo.slug) : todas;
      });
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
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left ${x.slug === slug ? "border-forest bg-sage-100" : "border-line hover:bg-surface-2"}`}
          >
            <AvatarAgente slug={x.slug} nome={x.nome} cor={COR_ESQUADRAO[x.esquadrao]} tamanho={32} />
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">{x.nome} <MarcaIA /></span>
              <span className="hidden truncate text-[11px] text-muted lg:block">{x.cargo}</span>
            </span>
          </button>
        ))}
      </aside>

      {a && (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col rounded-xl border border-line bg-white" data-testid="chat-agente">
            <div className="flex shrink-0 items-center gap-3 border-b border-line p-3">
              <AvatarAgente slug={a.slug} nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} tamanho={44} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{a.nome} <MarcaIA /></p>
                <p className="truncate text-xs text-muted">{a.cargo}</p>
              </div>
              <div className="relative">
                <button
                  type="button"
                  aria-label="Mais opções"
                  aria-haspopup="menu"
                  aria-expanded={menu}
                  onClick={() => setMenu((v) => !v)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-semibold leading-none text-ink hover:bg-surface-3"
                  data-testid="menu-chat"
                >
                  …
                </button>
                {menu && (
                  <div role="menu" className="absolute right-0 top-12 z-20 w-64 rounded-xl border border-line bg-white p-1 shadow-flutuante">
                    <button
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-3 text-left text-sm font-semibold text-forest hover:bg-surface-2 disabled:opacity-50"
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
                    <p className="px-3 pb-2 text-[11px] text-muted">Escreva a ordem na caixa de texto e depois toque aqui para acionar na hora.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              <div ref={listaRef} onScroll={aoRolar} className="h-full space-y-2 overflow-y-auto overscroll-contain px-3 py-3" aria-live="polite" data-testid="lista-mensagens">
                {!carregandoChat && historico?.temMais && (
                  <button type="button" className={`${botaoLinha} mx-auto block min-h-11`} disabled={lendoAntigas} onClick={() => void verAnteriores()} data-testid="chat-anteriores">
                    {lendoAntigas ? "Carregando…" : "Ver mensagens anteriores"}
                  </button>
                )}
                {carregandoChat && thread.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted" data-testid="chat-carregando">
                    Carregando a conversa…
                  </p>
                ) : thread.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">
                    Nenhuma conversa com {a.nome} ainda. Pergunte algo sobre as rondas, ou peça uma correção: vira ordem.
                  </p>
                ) : (
                  agruparTrilha(thread).map((g) =>
                    g.tipo === "trilha" ? (
                      <details key={g.itens[0].id} data-testid="trilha-gerente" className="ml-3 max-w-[85%] text-xs text-muted">
                        <summary className="cursor-pointer select-none py-1 text-muted">ver como apurei ({g.itens.length})</summary>
                        <div className="space-y-1">
                          {g.itens.map((c) => (
                            <div key={c.id} data-testid="passo-gerente" className="whitespace-pre-line border-l-2 border-line py-1 pl-3">
                              {c.texto}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : (
                      <div
                        key={g.itens[0].id}
                        data-testid={g.itens[0].papel === "daniel" ? "bolha-minha" : "bolha-agente"}
                        className={`max-w-[85%] whitespace-pre-line rounded-xl px-3 py-2 text-sm ${g.itens[0].papel === "daniel" ? "ml-auto rounded-br-lg bg-forest text-white" : "rounded-bl-lg bg-surface-2 text-ink"}`}
                      >
                        {(() => {
                          const { resumo, detalhes } = g.itens[0].papel === "daniel" ? { resumo: g.itens[0].texto, detalhes: "" } : dividirResposta(g.itens[0].texto);
                          return (
                            <>
                              {g.itens[0].papel === "daniel" ? resumo : <TextoSimples texto={resumo} />}
                              {detalhes && (
                                <details data-testid="resposta-detalhes" className="mt-1">
                                  <summary className="cursor-pointer select-none text-xs font-semibold text-forest">ver detalhes</summary>
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
                  <div data-testid="digitando" className="inline-flex items-center gap-1 rounded-xl rounded-bl-lg bg-surface-2 px-3 py-2 text-sm text-muted" role="status">
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
                  className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink shadow-flutuante hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                  {naoLidas > 0 && (
                    <span data-testid="nao-lidas" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-red-700 bg-white px-1 text-[11px] font-semibold text-red-700">
                      {naoLidas > 9 ? "9+" : naoLidas}
                    </span>
                  )}
                </button>
              )}
            </div>

            <div className="shrink-0 space-y-2 border-t border-line p-3">
              {a.slug === "moacir" && <CartoesAprovacao versao={thread.length} />}
              {aviso && (
                <p className="rounded-lg bg-sage-100 px-3 py-2 text-sm text-forest" data-testid="aviso-ordem">
                  {aviso}{" "}
                  {linkSessao && (
                    <a href={linkSessao} target="_blank" rel="noreferrer" className="font-semibold underline">
                      Abrir a sessão
                    </a>
                  )}
                </p>
              )}
              {erro && <p className="rounded-lg bg-white px-3 py-2 text-sm text-red-700">{erro}</p>}
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
                  className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-white px-4 py-2 text-base text-ink placeholder:text-muted focus:border-forest focus:outline-none"
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
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-forest text-white hover:bg-forest-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </form>
              <p className="text-[11px] text-muted">{agora ? avisoOrdem(a, agora).replace(/^O /, "Ordem: o ") : ""}</p>
            </div>
          </div>

          <MemoriaAgente key={a.slug} slug={a.slug} nome={a.nome} />

          <div className="rounded-xl border border-line bg-white p-4">
            <h3 className="text-sm font-semibold text-ink">Ordens para {a.nome}</h3>
            {ordens.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nenhuma ordem ainda.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {ordens.map((o) => {
                  const estado = estadoDaOrdem(o);
                  const link = linkDaOrdem(o, dados.rondas);
                  return (
                  <li key={o.id} className="border-t border-line pt-3 first:border-0 first:pt-0" data-testid="ordem" data-estado={estado}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip cor={COR_ESTADO[estado]}>{ROTULO_ESTADO[estado]}</Chip>
                      {o.origem_slug && (
                        <span className="text-xs font-semibold text-red-700" data-testid="ordem-origem">
                          {o.retorno_de ? "retorno de" : "encaminhado por"} {dados.agentes.find((x) => x.slug === o.origem_slug)?.nome ?? o.origem_slug}
                          {o.prioridade ? ` · ${o.prioridade}` : ""}
                        </span>
                      )}
                      <span className="text-xs text-muted" style={mono}>
                        {dataHora(o.criada_em)}
                      </span>
                      {rotuloAcionado(o) && (
                        <span className="text-xs text-muted" data-testid="ordem-acionado">
                          {rotuloAcionado(o)}
                        </span>
                      )}
                      {link && (
                        <a href={link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-forest hover:underline">
                          {estado === "concluida" ? "Ver PR / ronda" : "Ver sessão"}
                        </a>
                      )}
                    </div>
                    {estado === "falhou" && o.disparo_erro && <p className="mt-1 text-xs text-red-700">Disparo: {o.disparo_erro}. O Moacir aciona em até 1 hora.</p>}
                    <p className="mt-1 whitespace-pre-line text-sm text-ink">{o.texto}</p>
                    {o.resposta && <p className="mt-1 whitespace-pre-line border-l-2 border-line pl-2 text-sm text-muted">{o.resposta}</p>}
                    {estado === "aguardando_aceite" && <AceiteOrdem ordemId={o.id} podeDecidir={podeAceitarOrdem(o, dados.uid)} />}
                    {o.reaberto_motivo && estado !== "aguardando_aceite" && o.status !== "concluida" && (
                      <p className="mt-1 text-xs text-amber-800" data-testid="ordem-reaberta">Reaberta: {o.reaberto_motivo}</p>
                    )}
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

/** Aceite de quem pediu (ordem 3c3d8a9e, parte 2): "Aceito" ou "Reabrir" dizendo o que falta. Os outros só veem que aguarda. */
function AceiteOrdem({ ordemId, podeDecidir }: { ordemId: string; podeDecidir: boolean }) {
  const router = useRouter();
  const [reabrindo, setReabrindo] = useState(false);
  const [falta, setFalta] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const decidir = (decisao: "aceitar" | "reabrir") =>
    iniciar(async () => {
      setErro(null);
      const r = await responderAceiteOrdem(ordemId, decisao, falta);
      if (!r.ok) return setErro(r.erro ?? "Não foi possível registrar agora.");
      router.refresh();
    });
  if (!podeDecidir) return <p className="mt-2 text-xs text-muted" data-testid="aceite-ordem">Aguardando o aceite de quem criou a ordem.</p>;
  return (
    <div className="mt-2 rounded-lg border border-line p-3 text-sm" data-testid="aceite-ordem">
      <p className="font-semibold text-ink">Aguardando seu aceite</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => decidir("aceitar")} disabled={pendente} className={buttonClasses({ size: "sm", className: "min-h-11" })}>
          Aceito
        </button>
        <button type="button" onClick={() => setReabrindo((v) => !v)} disabled={pendente} className="min-h-[44px] rounded-lg border border-line px-4 text-sm font-semibold text-ink disabled:opacity-50">
          Reabrir
        </button>
      </div>
      {reabrindo && (
        <div className="mt-2 space-y-2">
          <label className="block text-xs text-muted" htmlFor={`falta-${ordemId}`}>
            O que falta?
          </label>
          <textarea id={`falta-${ordemId}`} value={falta} onChange={(e) => setFalta(e.target.value)} maxLength={1000} rows={3} className="w-full rounded-lg border border-line bg-white p-2 text-sm text-ink" />
          <button type="button" onClick={() => decidir("reabrir")} disabled={pendente || !falta.trim()} className={buttonClasses({ variant: "secondary", size: "sm", className: "min-h-11" })}>
            Reabrir com este texto
          </button>
        </div>
      )}
      {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
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
  // ADMIN-5: as atas são lidas quando a Sala abre, 10 por vez.
  const [atas, setAtas] = useState<{ itens: Conversa[]; temMais: boolean } | null>(null);
  const [lendoAtas, setLendoAtas] = useState(false);
  const lerAtas = useCallback(async (antesDe?: string) => {
    setLendoAtas(true);
    try {
      const p = await carregarAtas(antesDe ?? null);
      setAtas((a) => (antesDe && a ? { itens: [...a.itens, ...p.itens], temMais: p.temMais } : p));
    } catch {
      setAtas((a) => a ?? { itens: [], temMais: false });
    } finally {
      setLendoAtas(false);
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void lerAtas(), 0);
    return () => clearTimeout(t);
  }, [lerAtas]);

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
        void lerAtas();
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
    <div className="w-full space-y-4">
      <div className="space-y-3 rounded-xl border border-line bg-white p-4">
        <label className="block text-sm font-semibold text-ink" htmlFor="pauta">
          Pauta
        </label>
        <textarea id="pauta" className={`${campo} min-h-[80px]`} placeholder="O que a equipe precisa decidir?" value={pauta} maxLength={2000} onChange={(e) => setPauta(e.target.value)} />
        <p className="text-sm font-semibold text-ink">Participantes</p>
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
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm ${on ? "border-forest bg-white font-semibold text-ink" : "border-line text-muted opacity-70"}`}
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
        {erro && <p className="rounded-lg bg-white px-3 py-2 text-sm text-red-700">{erro}</p>}
      </div>

      {res && (
        <div className="space-y-3" data-testid="ata">
          {res.falas.map((f, i) => {
            const a = porSlug[f.slug];
            const chave = `f${i}`;
            return (
              <div key={chave} className="rounded-xl border border-line bg-white p-4">
                <div className="flex items-center gap-2">
                  {a && <AvatarAgente slug={a.slug} nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} tamanho={32} />}
                  <b className="text-ink">{a?.nome ?? f.slug}</b> <MarcaIA />
                  <span className="text-xs text-muted">{a?.cargo}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-ink">{f.texto}</p>
                <div className="mt-2">
                  {virou[chave] ? (
                    <p className="text-xs text-forest">{virou[chave]}</p>
                  ) : (
                    <button className="text-xs font-semibold text-forest hover:underline" onClick={() => virarOrdem(chave, f.slug, f.texto)}>
                      Virar ordem
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="rounded-xl border border-line bg-sage-100 p-4">
            <p className="text-sm font-semibold text-ink">{res.fallback ? "Reunião não concluída" : "Consolidado do Moacir"}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink">{res.consolidado.texto}</p>
            {res.consolidado.passos.length > 0 && (
              <ol className="mt-3 space-y-2">
                {res.consolidado.passos.map((p, i) => {
                  const chave = `p${i}`;
                  const dono = porSlug[p.dono];
                  return (
                    <li key={chave} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <b className="text-ink">
                        {i + 1}. {dono?.nome ?? p.dono}
                      </b>
                      <span className="text-ink">{p.acao}</span>
                      {dono &&
                        (virou[chave] ? (
                          <span className="text-xs text-forest">{virou[chave]}</span>
                        ) : (
                          <button className="text-xs font-semibold text-forest hover:underline" onClick={() => virarOrdem(chave, p.dono, p.acao)}>
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

      <div className="rounded-xl border border-line bg-white p-4">
        <h3 className="text-sm font-semibold text-ink">Atas anteriores</h3>
        {atas === null ? (
          <p className="mt-2 text-sm text-muted" data-testid="atas-carregando">
            Carregando as atas…
          </p>
        ) : atas.itens.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nenhuma reunião ainda. A ata de cada reunião fica guardada aqui.</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2" data-testid="atas-lista">
              {atas.itens.map((c) => (
                <li key={c.id}>
                  <details className="rounded-lg border border-line p-3">
                    <summary className="cursor-pointer text-sm text-ink">
                      <span className="text-xs text-muted tabular-nums">{dataHora(c.criado_em)}</span> {c.texto.split("\n")[0].replace(/^Pauta: /, "")}
                    </summary>
                    <p className="mt-2 whitespace-pre-line text-sm text-ink">{c.texto}</p>
                  </details>
                </li>
              ))}
            </ul>
            {atas.temMais && (
              <button type="button" className={`${botaoLinha} mt-3 min-h-11`} disabled={lendoAtas} onClick={() => void lerAtas(atas.itens[atas.itens.length - 1].criado_em)} data-testid="atas-mais">
                {lendoAtas ? "Carregando…" : "Ver atas anteriores"}
              </button>
            )}
          </>
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
    <div className="rounded-xl border border-line bg-white p-4">
      <button className={botaoLinha} onClick={abrir} aria-expanded={aberto} data-testid="memoria-abrir">
        O que {nome} sabe sobre você
      </button>
      {aberto && (
        <div className="mt-3" data-testid="memoria-lista">
          {erro && <p className="rounded-lg bg-white px-3 py-2 text-sm text-red-700">{erro}</p>}
          {itens && itens.length === 0 && <p className="text-sm text-muted">{nome} ainda não guardou nada sobre você.</p>}
          {itens && itens.length > 0 && (
            <ul className="space-y-2">
              {itens.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 border-t border-line pt-2 first:border-0 first:pt-0">
                  <span className="text-sm text-ink">{m.fato}</span>
                  <button className="shrink-0 text-xs font-semibold text-red-700 hover:underline" onClick={() => apagar(m.id)} aria-label={`Apagar: ${m.fato}`}>
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
