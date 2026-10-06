"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ChevronDown, LifeBuoy, MessageSquare, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, dataBR } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { FAQ, buscarFaq } from "@/lib/atendimento/faq";
import { AVISO_EMERGENCIA, CATEGORIAS, detectarEmergencia } from "@/lib/atendimento/classificar";
import { HORARIO_HUMANO } from "@/config/atendimento";
import {
  abrirChamado,
  meuChamado,
  meusChamados,
  meusContratosAtivos,
  responderMeuChamado,
  type ChamadoLista,
  type MensagemChamado,
} from "@/lib/data/atendimento-actions";

/**
 * CENTRAL DE AJUDA — uma porta só. No SITE em /ajuda; no APP dentro de Perfil →
 * "Ajuda e contato" (mesma tela, sem tela nova). Perguntas frequentes com busca,
 * "Abrir chamado" (com contexto vindo do "Problema com isto?") e "Meus chamados".
 */
const STATUS: Record<string, string> = {
  aberto: "Aberto",
  aguardando_usuario: "Aguardando você",
  aguardando_aprovacao: "Em análise pela equipe",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  encerrado: "Encerrado",
};
const AUTOR: Record<string, string> = { usuario: "Você", admin: "Equipe Viva Nomads", ia: "Viva (assistente virtual)", sistema: "Viva Nomads" };
const CONTEXTO_ROTULO: Record<string, string> = { pedido: "seu Pedido de Moradia", contrato: "seu contrato", anuncio: "este anúncio" };

function lerParams(): URLSearchParams {
  return typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
}

export function CentralAjuda({ canal }: { canal: "site" | "app" }) {
  const user = useAuthStore((s) => s.user);
  const [aba, setAba] = useState<"inicio" | "novo" | "chamado">("inicio");
  const [numeroAberto, setNumeroAberto] = useState<string | null>(null);
  const [contexto, setContexto] = useState<{ tipo: string; id: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [lista, setLista] = useState<ChamadoLista[] | null>(null);

  const recarregar = useCallback(() => {
    if (user) meusChamados().then(setLista).catch(() => setLista([]));
  }, [user]);

  useEffect(() => {
    const p = lerParams();
    const tipo = p.get("contexto");
    const id = p.get("id");
    // Lê a URL só no cliente (contexto do "Problema com isto?", chamado, nota).
    if (tipo && id && CONTEXTO_ROTULO[tipo]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContexto({ tipo, id });
      setAba("novo");
    }
    const chamado = p.get("chamado");
    if (chamado) {
      setNumeroAberto(chamado.toUpperCase());
      setAba("chamado");
    }
    if (p.get("avaliado") === "1") setAviso("Obrigado pela sua nota! Ela ajuda a melhorar o atendimento.");
    if (p.get("avaliacao") === "invalida") setAviso("Esse link de avaliação não é válido.");
    if (p.get("novo") === "1") setAba("novo");
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  function abrir(numero: string) {
    setNumeroAberto(numero);
    setAba("chamado");
    if (typeof window !== "undefined") window.history.replaceState(null, "", `${window.location.pathname}?chamado=${numero}`);
  }
  function voltar() {
    setAba("inicio");
    setNumeroAberto(null);
    if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname);
    recarregar();
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {aviso && <p className="mb-4 rounded-xl border border-sage-200 bg-sage-100 px-4 py-3 text-sm text-ink">{aviso}</p>}

      {aba === "chamado" && numeroAberto ? (
        <DetalheChamado numero={numeroAberto} onVoltar={voltar} />
      ) : aba === "novo" ? (
        <NovoChamado
          canal={canal}
          contexto={contexto}
          logado={!!user}
          onCancelar={() => {
            setContexto(null);
            setAba("inicio");
          }}
          onAberto={(n) => {
            setContexto(null);
            recarregar();
            if (user) abrir(n);
            else {
              setAba("inicio");
              setAviso(`Chamado ${n} aberto. Enviamos a confirmação para o seu e-mail — a resposta chega por lá.`);
            }
          }}
        />
      ) : (
        <>
          <Perguntas />
          <section className="mt-6 rounded-2xl border border-sage-200 bg-white p-4 sm:p-6">
            <h2 className="font-title text-lg font-bold text-ink">Não achou a resposta?</h2>
            <p className="mt-1 text-sm text-muted">
              Abra um chamado: você recebe um número e acompanha tudo por aqui. Atendimento humano das{" "}
              {HORARIO_HUMANO.inicio}h às {HORARIO_HUMANO.fim}h, todos os dias.
            </p>
            <Button className="mt-4" onClick={() => setAba("novo")}>
              <LifeBuoy className="h-4 w-4" /> Abrir chamado
            </Button>
          </section>
          {user && (
            <section className="mt-6 rounded-2xl border border-sage-200 bg-white p-4 sm:p-6">
              <h2 className="font-title text-lg font-bold text-ink">Meus chamados</h2>
              {lista === null ? (
                <p className="mt-2 text-sm text-muted">Carregando…</p>
              ) : lista.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Você ainda não abriu nenhum chamado.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {lista.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => abrir(c.numero_publico)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">{c.assunto}</span>
                          <span className="block text-xs text-muted">
                            {c.numero_publico} · {dataBR(c.criado_em)}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                            c.status === "aguardando_usuario" ? "bg-amber-100 text-amber-800" : c.status === "resolvido" || c.status === "encerrado" ? "bg-surface-2 text-muted" : "bg-sage-100 text-forest"
                          )}
                        >
                          {STATUS[c.status] ?? c.status}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Perguntas() {
  const [q, setQ] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const resultado = useMemo(() => buscarFaq(q), [q]);
  return (
    <section className="rounded-2xl border border-sage-200 bg-white p-4 sm:p-6">
      <h2 className="font-title text-lg font-bold text-ink">Perguntas frequentes</h2>
      <label className="relative mt-3 block">
        <span className="sr-only">Buscar nas perguntas frequentes</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ex.: caução, senha, anúncio não publica"
          className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink focus:border-forest focus:outline-none"
        />
      </label>
      {resultado.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhuma pergunta encontrada. Abra um chamado logo abaixo.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {resultado.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                aria-expanded={aberta === p.id}
                onClick={() => setAberta((a) => (a === p.id ? null : p.id))}
                className="flex w-full items-center justify-between gap-3 py-3 text-left font-medium text-ink"
              >
                {p.pergunta}
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", aberta === p.id && "rotate-180")} />
              </button>
              {aberta === p.id && <p className="pb-3 text-sm leading-relaxed text-muted">{p.resposta}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">{FAQ.length} perguntas · respostas a partir das regras oficiais da plataforma.</p>
    </section>
  );
}

function NovoChamado({
  canal,
  contexto,
  logado,
  onCancelar,
  onAberto,
}: {
  canal: "site" | "app";
  contexto: { tipo: string; id: string } | null;
  logado: boolean;
  onCancelar: () => void;
  onAberto: (numero: string) => void;
}) {
  const [cat, setCat] = useState(contexto?.tipo === "contrato" ? "contrato" : contexto?.tipo === "anuncio" ? "anuncio" : "duvida");
  const [mensagem, setMensagem] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [contratos, setContratos] = useState<{ id: string; titulo: string }[]>([]);
  const [contratoId, setContratoId] = useState<string>(contexto?.tipo === "contrato" ? contexto.id : "");
  const [urgencia, setUrgencia] = useState<"urgente" | "media" | "baixa">("media");
  const [catManut, setCatManut] = useState("outros");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emergencia = detectarEmergencia(mensagem);

  useEffect(() => {
    if (logado) meusContratosAtivos().then(setContratos).catch(() => setContratos([]));
  }, [logado]);

  const categorias = CATEGORIAS.filter((c) => !c.exigeContrato || contratos.length > 0);
  const manutencao = cat === "manutencao";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const r = await abrirChamado({
      categoria: cat,
      mensagem,
      canal,
      contextoTipo: (contexto?.tipo as "pedido" | "contrato" | "anuncio" | undefined) ?? null,
      contextoId: contexto?.id ?? null,
      contratoId: manutencao ? contratoId || null : null,
      urgencia: manutencao ? urgencia : undefined,
      categoriaManutencao: manutencao ? catManut : undefined,
      visitanteNome: logado ? undefined : nome,
      visitanteEmail: logado ? undefined : email,
    }).catch(() => ({ ok: false as const, error: "Falha de conexão. Tente de novo." }));
    setEnviando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    onAberto(r.numero);
  }

  const campo = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-forest focus:outline-none";
  return (
    <form onSubmit={enviar} className="rounded-2xl border border-sage-200 bg-white p-4 sm:p-6">
      <button type="button" onClick={onCancelar} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-forest">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h2 className="font-title text-lg font-bold text-ink">Abrir chamado</h2>
      {contexto && <p className="mt-1 text-sm text-muted">Sobre {CONTEXTO_ROTULO[contexto.tipo]} — a equipe já recebe o link.</p>}

      {emergencia && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {AVISO_EMERGENCIA}
        </p>
      )}

      <div className="mt-4 grid gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Assunto</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={campo}>
            {categorias.map((c) => (
              <option key={c.key} value={c.key}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>

        {manutencao && (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm sm:col-span-3">
              <span className="mb-1 block font-medium text-ink">Imóvel (contrato)</span>
              <select required value={contratoId} onChange={(e) => setContratoId(e.target.value)} className={campo}>
                <option value="">Escolha</option>
                {contratos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Tipo</span>
              <select value={catManut} onChange={(e) => setCatManut(e.target.value)} className={campo}>
                <option value="hidraulica">Água / encanamento</option>
                <option value="eletrica">Elétrica</option>
                <option value="eletrodomesticos">Eletrodoméstico</option>
                <option value="estrutura">Estrutura (portas, janelas, teto)</option>
                <option value="internet">Internet</option>
                <option value="outros">Outro</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-ink">Urgência</span>
              <select value={urgencia} onChange={(e) => setUrgencia(e.target.value as typeof urgencia)} className={campo}>
                <option value="urgente">Urgente — sem água, sem luz, vazamento (4 h)</option>
                <option value="media">Média — atrapalha o dia a dia (24 h)</option>
                <option value="baixa">Baixa — pode esperar (72 h)</option>
              </select>
            </label>
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">O que aconteceu?</span>
          <textarea
            required
            minLength={5}
            maxLength={4000}
            rows={5}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Conte com suas palavras. Não informe senha nem dados de cartão."
            className={campo}
          />
        </label>

        {!logado && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Seu nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className={campo} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Seu e-mail (para a resposta)</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
            </label>
            <p className="text-xs text-muted sm:col-span-2">
              Tem conta? <Link href="/auth?redirect=/ajuda" className="font-medium text-forest underline">Entre</Link> para acompanhar o chamado aqui.
            </p>
          </div>
        )}
      </div>

      {erro && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {erro}
        </p>
      )}
      <Button type="submit" className="mt-5" disabled={enviando}>
        <Send className="h-4 w-4" /> {enviando ? "Enviando…" : "Enviar chamado"}
      </Button>
      <p className="mt-3 text-xs text-muted">
        Telefone, e-mail e redes sociais escritos aqui aparecem como &quot;contato protegido&quot;. Em emergência, ligue 193 ou 190.
      </p>
    </form>
  );
}

function DetalheChamado({ numero, onVoltar }: { numero: string; onVoltar: () => void }) {
  const [dados, setDados] = useState<Awaited<ReturnType<typeof meuChamado>> | undefined>(undefined);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    meuChamado(numero).then(setDados).catch(() => setDados(null));
  }, [numero]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function responder(e: React.FormEvent) {
    e.preventDefault();
    if (!dados) return;
    setEnviando(true);
    setErro(null);
    const r = await responderMeuChamado(dados.chamado.id, texto).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
    setEnviando(false);
    if (!r.ok) setErro(r.error);
    else {
      setTexto("");
      carregar();
    }
  }

  return (
    <section className="rounded-2xl border border-sage-200 bg-white p-4 sm:p-6">
      <button type="button" onClick={onVoltar} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-forest">
        <ArrowLeft className="h-4 w-4" /> Meus chamados
      </button>
      {dados === undefined ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : dados === null ? (
        <p className="text-sm text-muted">Chamado não encontrado. Entre com a conta que abriu o chamado.</p>
      ) : (
        <>
          <h2 className="font-title text-lg font-bold text-ink">{dados.chamado.assunto}</h2>
          <p className="mt-1 text-sm text-muted">
            {dados.chamado.numero_publico} · {STATUS[dados.chamado.status] ?? dados.chamado.status}
          </p>
          <ol className="mt-4 space-y-3">
            {dados.mensagens.map((m: MensagemChamado) => (
              <li
                key={m.id}
                className={cn(
                  "rounded-xl px-4 py-3 text-sm",
                  m.autor === "usuario" ? "ml-6 bg-sage-100 text-ink" : m.autor === "sistema" ? "bg-surface-2 text-muted" : "mr-6 border border-line bg-white text-ink"
                )}
              >
                <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <MessageSquare className="h-3.5 w-3.5" /> {AUTOR[m.autor]} · {new Date(m.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className="whitespace-pre-wrap">{m.corpo}</span>
              </li>
            ))}
          </ol>
          {dados.chamado.status !== "encerrado" ? (
            <form onSubmit={responder} className="mt-4">
              <label className="block text-sm">
                <span className="sr-only">Sua resposta</span>
                <textarea
                  required
                  rows={3}
                  maxLength={4000}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={dados.chamado.status === "resolvido" ? "Algo ficou pendente? Responda para reabrir." : "Escreva sua mensagem"}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-forest focus:outline-none"
                />
              </label>
              {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
              <Button type="submit" className="mt-3" disabled={enviando}>
                <Send className="h-4 w-4" /> {enviando ? "Enviando…" : "Enviar"}
              </Button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-muted">Chamado encerrado. Se precisar, abra um novo.</p>
          )}
        </>
      )}
    </section>
  );
}
