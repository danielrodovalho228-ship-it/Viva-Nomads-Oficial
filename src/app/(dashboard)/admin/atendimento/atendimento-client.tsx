"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Trash2 } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRAZOS, estadoPrazo, type Prioridade } from "@/config/atendimento";
import { PRECOS_USD } from "@/lib/atendimento/viva-custo";
import { FILAS, ORDEM_FILAS, filaDaCategoria } from "@/lib/atendimento/filas";
import { apagarMacro, salvarMacro, testarViva, type ChamadoAdmin, type Macro, type ResultadoCenario } from "@/lib/data/atendimento-actions";

const ABAS = [
  { id: "fila", rotulo: "Fila" },
  { id: "aprovacao", rotulo: "Aprovação" },
  { id: "metricas", rotulo: "Métricas" },
  { id: "respostas", rotulo: "Respostas prontas" },
] as const;

const STATUS: Record<string, string> = {
  aberto: "Aberto",
  aguardando_usuario: "Aguardando usuário",
  aguardando_aprovacao: "Aguardando aprovação interna",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  encerrado: "Encerrado",
};

export function relogio(c: ChamadoAdmin, agora: Date): { cor: string; texto: string } {
  const fmt = (m: number) => (Math.abs(m) >= 120 ? `${Math.round(Math.abs(m) / 60)} h` : `${Math.abs(m)} min`);
  const primeira = new Date(c.prazo_primeira_resposta);
  if (c.primeira_resposta_em) {
    // Respondido: atrasado fica marcado; no prazo, passa a contar o prazo de resolução.
    if (new Date(c.primeira_resposta_em).getTime() > primeira.getTime()) return { cor: "bg-red-100 text-red-800", texto: "1ª resposta fora do prazo" };
    if (c.status === "resolvido" || c.status === "encerrado") return { cor: "bg-surface-2 text-muted", texto: "respondido" };
    const estado = estadoPrazo(new Date(c.criado_em), new Date(c.prazo_resolucao), agora, false);
    const rest = Math.round((new Date(c.prazo_resolucao).getTime() - agora.getTime()) / 60000);
    if (estado === "estourado") return { cor: "bg-red-100 text-red-800", texto: `resolução estourou há ${fmt(rest)}` };
    if (estado === "em_risco") return { cor: "bg-amber-100 text-amber-800", texto: `resolução: ${fmt(rest)} restantes` };
    return { cor: "bg-surface-2 text-muted", texto: `respondido · resolver em ${fmt(rest)}` };
  }
  const estado = estadoPrazo(new Date(c.criado_em), primeira, agora, false);
  const restMin = Math.round((primeira.getTime() - agora.getTime()) / 60000);
  if (estado === "estourado") return { cor: "bg-red-100 text-red-800", texto: `estourou há ${fmt(restMin)}` };
  if (estado === "em_risco") return { cor: "bg-amber-100 text-amber-800", texto: `${fmt(restMin)} restantes` };
  return { cor: "bg-green-100 text-green-800", texto: `${fmt(restMin)} restantes` };
}

export function AtendimentoClient({
  aba,
  fila,
  aprovacao,
  metricas,
  macros,
  filtros,
  semAcesso,
  agoraISO,
}: {
  aba: (typeof ABAS)[number]["id"];
  fila: ChamadoAdmin[];
  aprovacao: ChamadoAdmin[];
  metricas: Record<string, unknown> | null;
  macros: Macro[];
  filtros: { fila?: string; prioridade?: string; tipo?: string; responsavel?: string; busca?: string; fechados?: boolean };
  semAcesso: boolean;
  agoraISO: string;
}) {
  const agora = new Date(agoraISO);
  return (
    <>
      <PageTitle title="Atendimento" subtitle="Chamados por prioridade e prazo. Simulações ficam fora." />
      {semAcesso && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sem acesso aos chamados agora (banco sem a migração 0073, sem chave de serviço ou sem permissão).
        </p>
      )}
      <nav aria-label="Seções do atendimento" className="mb-6 flex flex-wrap gap-1.5">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={`/admin/atendimento?aba=${a.id}`}
            aria-current={aba === a.id ? "page" : undefined}
            className={cn("rounded-lg px-3 py-1.5 text-sm", aba === a.id ? "bg-forest text-white" : "border border-line text-ink hover:border-forest")}
          >
            {a.rotulo}
            {a.id === "aprovacao" && aprovacao.length > 0 && <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 text-xs text-amber-900">{aprovacao.length}</span>}
          </Link>
        ))}
      </nav>

      {aba === "fila" && (
        <>
          <Filtros filtros={filtros} />
          <Tabela itens={fila} agora={agora} vazio="Nenhum chamado na fila com esses filtros." />
        </>
      )}
      {aba === "aprovacao" && (
        <Panel title="Aguardando aprovação interna">
          <p className="mb-3 text-sm text-muted">Aprovação da equipe, não do cliente (o cliente vê &ldquo;Em análise pela equipe&rdquo;). Casos preparados para decisão: estorno, exceção, documento contestado, conflito. A Viva prepara o resumo e a resposta sugerida.</p>
          <Tabela itens={aprovacao} agora={agora} vazio="Nada aguardando aprovação." />
        </Panel>
      )}
      {aba === "metricas" && (
        <>
          <Metricas m={metricas} />
          <TestarViva />
        </>
      )}
      {aba === "respostas" && <Macros macros={macros} />}
    </>
  );
}

function Filtros({ filtros }: { filtros: { fila?: string; prioridade?: string; tipo?: string; responsavel?: string; busca?: string; fechados?: boolean } }) {
  const campo = "rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink";
  return (
    <form method="get" action="/admin/atendimento" className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-sage-200 bg-white p-3">
      <input type="hidden" name="aba" value="fila" />
      <label className="text-xs text-muted">
        Busca
        <input name="q" defaultValue={filtros.busca} placeholder="VN-000123 ou assunto" className={cn(campo, "mt-0.5 block w-52")} />
      </label>
      <label className="text-xs text-muted">
        Fila
        <select name="fila" defaultValue={filtros.fila ?? ""} className={cn(campo, "mt-0.5 block")}>
          <option value="">Todas</option>
          {ORDEM_FILAS.map((f) => (
            <option key={f} value={f}>
              {FILAS[f].rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted">
        Prioridade
        <select name="prioridade" defaultValue={filtros.prioridade ?? ""} className={cn(campo, "mt-0.5 block")}>
          <option value="">Todas</option>
          {(["p1", "p2", "p3", "p4"] as Prioridade[]).map((p) => (
            <option key={p} value={p}>
              {p.toUpperCase()} {PRAZOS[p].rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted">
        Tipo
        <select name="tipo" defaultValue={filtros.tipo ?? ""} className={cn(campo, "mt-0.5 block")}>
          <option value="">Todos</option>
          <option value="suporte">Suporte</option>
          <option value="manutencao">Manutenção</option>
          <option value="seguranca">Segurança</option>
        </select>
      </label>
      <label className="text-xs text-muted">
        Responsável
        <select name="responsavel" defaultValue={filtros.responsavel ?? ""} className={cn(campo, "mt-0.5 block")}>
          <option value="">Todos</option>
          <option value="humano">Pessoa</option>
          <option value="ia">IA</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" name="fechados" value="1" defaultChecked={filtros.fechados} /> Incluir resolvidos
      </label>
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}

function Tabela({ itens, agora, vazio }: { itens: ChamadoAdmin[]; agora: Date; vazio: string }) {
  if (itens.length === 0) return <p className="rounded-2xl border border-sage-200 bg-white p-4 text-sm text-muted">{vazio}</p>;
  return (
    <ul className="grid min-w-0 gap-2">
      {itens.map((c) => {
        const r = relogio(c, agora);
        return (
          <li key={c.id} className="min-w-0">
            <Link href={`/admin/atendimento/${c.id}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-sage-200 bg-white px-4 py-3 hover:border-forest">
              <span className="min-w-0 flex-1 basis-56">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-bold", c.prioridade === "p1" ? "bg-red-600 text-white" : c.prioridade === "p2" ? "bg-amber-500 text-white" : "bg-surface-2 text-ink")}>
                    {c.prioridade.toUpperCase()}
                  </span>
                  <span className="truncate font-medium text-ink">{c.assunto}</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {c.numero_publico} · {FILAS[filaDaCategoria(c.categoria)].rotulo} · {c.canal} · {STATUS[c.status] ?? c.status}
                  {c.visitante_email ? " · visitante" : ""}
                </span>
              </span>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", r.cor)}>
                <Clock className="h-3.5 w-3.5" /> {r.texto}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function n(v: unknown): number | null {
  const x = typeof v === "number" ? v : v == null ? NaN : Number(v);
  return Number.isFinite(x) ? x : null;
}
function pct(a: unknown, b: unknown): string {
  const x = n(a);
  const y = n(b);
  return x === null || y === null || y <= 0 ? "—" : `${Math.round((x / y) * 100)}%`;
}
function num(v: unknown, suf = ""): string {
  const x = n(v);
  return x === null ? "—" : `${x.toLocaleString("pt-BR")}${suf}`;
}

function Metricas({ m }: { m: Record<string, unknown> | null }) {
  if (!m) return <Panel><p className="text-sm text-muted">— sem dados (migração 0073 pendente ou sem acesso).</p></Panel>;
  const est = (m.estourados as Record<string, number>) ?? {};
  const cards: [string, string, string][] = [
    ["Chamados no período", num(m.total), "Chamados reais abertos nos últimos dias (simulação fora)."],
    ["Abertos agora", num(m.abertos), "Sem resolver nem encerrar."],
    ["1ª resposta — média", num(m.primeira_resposta_media_min, " min"), "Do abrir até a primeira resposta (da Viva ou de uma pessoa)."],
    ["1ª resposta — p90", num(m.primeira_resposta_p90_min, " min"), "9 em cada 10 respondidos até este tempo."],
    ["Resolução — média", num(m.resolucao_media_h, " h"), "Do abrir até marcar resolvido."],
    ["Resolvidos pela IA", pct(m.resolvidos_ia, m.resolvidos), "Resolvidos só pela Viva ÷ resolvidos."],
    ["Pediram uma pessoa", pct(m.pediu_humano, m.total), "Chamados em que a pessoa pediu atendimento humano."],
    ["Reabertos em 7 dias", pct(m.reabertos_7d, m.resolvidos), "Voltaram em até 7 dias depois de resolvidos."],
    ["Satisfação (4–5)", pct(m.satisfacao_4_5, m.satisfacao_notas), "Notas 4 ou 5 ÷ notas recebidas."],
    ["Nota média", num(m.satisfacao_media), "Média das notas de 1 a 5."],
    ["Chamados por 100 contratos", pct(m.total, m.contratos_periodo).replace("%", ""), "Chamados ÷ contratos do período × 100."],
    ["Manutenção — resposta do dono", num(m.manutencao_resposta_media_h, " h"), "Média até a 1ª resposta do proprietário."],
    ["Viva — boas respostas", pct(m.viva_boas, Number(m.viva_boas ?? 0) + Number(m.viva_corrigir ?? 0)), "Marcadas como \"boa resposta\" ÷ respostas avaliadas pela equipe."],
  ];
  const correcoes = (m.viva_correcoes as { numero: string; texto: string; em: string }[] | undefined) ?? [];
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([t, v, f]) => (
          <div key={t} className="rounded-xl border border-line bg-white p-3" title={f}>
            <p className="text-sm text-muted">{t}</p>
            <p className="mt-1 font-title text-2xl font-bold text-ink">{v}</p>
            <p className="mt-1 text-xs text-muted">{f}</p>
          </div>
        ))}
      </div>
      <Panel title="Prazos estourados por prioridade" className="mt-6">
        <p className="text-sm text-ink">
          {(["p1", "p2", "p3", "p4"] as const).map((p) => `${p.toUpperCase()}: ${est[p] ?? 0}`).join(" · ")} · Manutenções sem resposta: {num(m.manutencao_sem_resposta)}
        </p>
      </Panel>
      {correcoes.length > 0 && (
        <Panel title="Correções da Viva (para melhorar respostas prontas e FAQ)" className="mt-6">
          <ul className="space-y-2 text-sm">
            {correcoes.map((c, i) => (
              <li key={i} className="rounded-lg border border-line p-2">
                <span className="text-xs text-muted">{c.numero}</span>
                <p className="whitespace-pre-wrap text-ink">{c.texto}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function Macros({ macros }: { macros: Macro[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<{ id?: string; titulo: string; corpo: string }>({ titulo: "", corpo: "" });
  const [erro, setErro] = useState<string | null>(null);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const r = await salvarMacro(edit);
    if (!r.ok) setErro(r.error);
    else {
      setErro(null);
      setEdit({ titulo: "", corpo: "" });
      router.refresh();
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title={edit.id ? "Editar resposta pronta" : "Nova resposta pronta"}>
        <form onSubmit={salvar} className="grid gap-3">
          <input required maxLength={80} placeholder="Título" value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
          <textarea required maxLength={3000} rows={6} placeholder="Texto (use {nome} para o primeiro nome)" value={edit.corpo} onChange={(e) => setEdit({ ...edit, corpo: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
          {erro && <p className="text-sm text-red-700">{erro}</p>}
          <div className="flex gap-2">
            <Button type="submit">Salvar</Button>
            {edit.id && (
              <Button type="button" variant="outline" onClick={() => setEdit({ titulo: "", corpo: "" })}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Panel>
      <Panel title="Respostas prontas">
        {macros.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma ainda.</p>
        ) : (
          <ul className="divide-y divide-line">
            {macros.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
                <button type="button" onClick={() => setEdit(m)} className="min-w-0 text-left">
                  <span className="block font-medium text-ink">{m.titulo}</span>
                  <span className="block truncate text-xs text-muted">{m.corpo}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Apagar ${m.titulo}`}
                  onClick={async () => {
                    if (!window.confirm("Apagar esta resposta pronta?")) return;
                    await apagarMacro(m.id);
                    router.refresh();
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/** Roda os 14 cenários com a IA de verdade (ferramentas de mentira; nada toca o banco). */
function TestarViva() {
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<ResultadoCenario[] | null>(null);
  const [modelo, setModelo] = useState("");
  const [usado, setUsado] = useState<{ modelo: string; cotacao: number } | null>(null);
  const [porMes, setPorMes] = useState(300);
  // Custo médio só das conversas que chamaram a IA (as decididas pelo código custam zero).
  const comIA = res?.filter((r) => r.chamadas > 0 && r.custoReais !== null) ?? [];
  const media = comIA.length ? comIA.reduce((s, r) => s + (r.custoReais ?? 0), 0) / comIA.length : null;
  const brl = (n: number, casas = 2) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
  const certos = res?.filter((r) => r.falhas.length === 0).length ?? 0;
  const criticosOk = res ? res.filter((r) => r.critico).every((r) => r.falhas.length === 0) : false;
  return (
    <Panel title="Testar a Viva (14 cenários)" className="mt-6">
      <p className="text-sm text-muted">
        Roda os 14 cenários do plano de teste com a IA de verdade e dados de mentira (não cria chamado nem manda e-mail). Aprovação: pelo menos 12 de 14
        certos e nenhum erro nos cenários 6, 7, 13 e 14. Até 3 rodadas por dia.
      </p>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium text-ink">Modelo</span>
        <select value={modelo} onChange={(e) => setModelo(e.target.value)} className="w-full max-w-xs rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink">
          <option value="">O configurado (ATENDIMENTO_IA_MODELO)</option>
          {Object.entries(PRECOS_USD).map(([id, p]) => (
            <option key={id} value={id}>
              {p.rotulo} — US$ {p.entrada}/{p.saida} por milhão
            </option>
          ))}
        </select>
      </label>
      <Button
        className="mt-3"
        size="sm"
        disabled={rodando}
        onClick={async () => {
          setRodando(true);
          setErro(null);
          const r = await testarViva(modelo || undefined).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
          setRodando(false);
          if (r.ok) {
            setRes(r.resultados);
            setUsado({ modelo: r.modelo, cotacao: r.cotacao });
          } else setErro(r.error);
        }}
      >
        {rodando ? "Rodando… (até 1 minuto)" : "Rodar os 14 cenários"}
      </Button>
      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
      {res && (
        <>
          <p className={cn("mt-4 text-sm font-semibold", certos >= 12 && criticosOk ? "text-forest" : "text-red-700")}>
            {certos} de 14 certos · críticos (6, 7, 13, 14): {criticosOk ? "todos certos" : "ERRO"} → {certos >= 12 && criticosOk ? "APROVADO" : "REPROVADO"}
          </p>
          {usado && (
            <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink">
              <p>
                <strong>{PRECOS_USD[usado.modelo]?.rotulo ?? usado.modelo}</strong> · custo médio por conversa com IA:{" "}
                <strong>{media === null ? "—" : brl(media, 3)}</strong> (dólar a R$ {usado.cotacao.toFixed(2).replace(".", ",")})
              </p>
              <label className="mt-2 flex flex-wrap items-center gap-2">
                Conversas com IA por mês:
                <input
                  type="number"
                  min={0}
                  value={porMes}
                  onChange={(e) => setPorMes(Math.max(0, Number(e.target.value) || 0))}
                  className="w-24 rounded-lg border border-line bg-white px-2 py-1"
                />
                → <strong>{media === null ? "—" : brl(media * porMes)}</strong> por mês
              </label>
              <p className="mt-1 text-xs text-muted">Emergência, golpe, pedido de pessoa e de contato são decididos pelo código e não custam nada.</p>
            </div>
          )}
          <ul className="mt-3 divide-y divide-line text-sm">
            {res.map((r) => (
              <li key={r.n} className="py-2">
                <p className="font-medium text-ink">
                  {r.falhas.length === 0 ? "✓" : "✗"} {r.n}. “{r.mensagem}”{r.critico ? " · crítico" : ""}
                </p>
                <p className="text-xs text-muted">
                  Esperado: {r.quemResolve}, {r.prazo} · Obtido: {r.rota} → {r.destino}, {r.prioridade.toUpperCase()} · {r.chamadas} chamada(s) à IA
                  {r.custoReais !== null && r.chamadas > 0 ? ` · ${brl(r.custoReais, 3)}` : ""}
                </p>
                {r.resposta && <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-2 p-2 text-xs text-ink">{r.resposta}</p>}
                {r.falhas.length > 0 && <p className="mt-1 text-xs text-red-700">{r.falhas.join(" · ")}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
