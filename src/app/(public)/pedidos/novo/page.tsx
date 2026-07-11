"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Megaphone,
  ShieldCheck,
  Info,
  Loader2,
  ChevronDown,
  Check,
  CircleCheck,
  Clock,
  MessageSquare,
  Laptop,
  HeartPulse,
  Briefcase,
  GraduationCap,
  Hammer,
  Users,
  Palmtree,
  Plane,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateFieldBR } from "@/components/ui/date-field-br";
import { MOTIVOS, contemContato, CONTATO_AVISO, calcExpiraEm } from "@/lib/pedidos/pedidos";
import { criarPedido } from "@/lib/data/pedidos-actions";
import { useAuthStore } from "@/lib/store";

/** Ícone por motivo (a lib MOTIVOS segue pura; o mapa visual vive aqui). */
const MOTIVO_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  trabalho_remoto: Laptop,
  tratamento_medico: HeartPulse,
  relocacao_corporativa: Briefcase,
  intercambio_pos: GraduationCap,
  reforma_transicao: Hammer,
  mudanca_familiar: Users,
  aposentadoria_lifestyle: Palmtree,
  viagem_longa: Plane,
  outro: MoreHorizontal,
};

const CHECKLIST = [
  { icon: MessageSquare, t: "Você publica", d: "Cidade, datas, orçamento e perfil." },
  { icon: CircleCheck, t: "Proprietários respondem", d: "Só imóveis que atendem." },
  { icon: Clock, t: "Sem custo e sem spam", d: "Contato só pela plataforma." },
];

const PASSOS = [
  "Publique o que precisa",
  "Receba respostas com imóveis reais",
  "Converse e feche pela plataforma",
];

/** /pedidos/novo — o inquilino publica o que precisa (housing request reverso). */
export default function NovoPedidoPage() {
  return (
    <Suspense fallback={<div className="container-page py-10" />}>
      <NovoPedidoSplit />
    </Suspense>
  );
}

function NovoPedidoSplit() {
  return (
    <div className="lg:grid lg:grid-cols-[44%_56%]">
      {/* LADO ESQUERDO — imagem + overlay da marca + proposta de valor.
          No desktop fica fixo ao rolar; no mobile vira um hero compacto. */}
      <aside className="relative flex min-h-[14rem] items-end overflow-hidden bg-forest text-white lg:sticky lg:top-[4.5rem] lg:h-[calc(100vh-4.5rem)] lg:min-h-0 lg:items-center">
        {/* Imagem de fundo (Daniel adiciona public/media/pedido-lateral.webp).
            Se faltar, o gradiente da marca sustenta o visual sozinho. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/media/pedido-lateral.webp)" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-forest via-forest/85 to-forest/30 lg:bg-gradient-to-br lg:from-forest lg:via-forest/85 lg:to-transparent"
        />
        <Megaphone
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 hidden h-48 w-48 rotate-12 text-white/[0.07] lg:block"
        />
        <div className="relative z-10 p-6 sm:p-8 lg:max-w-md lg:p-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
            <Megaphone className="h-3.5 w-3.5" /> Pedido de moradia
          </span>
          <h1 className="mt-4 font-title text-2xl font-bold leading-tight md:text-3xl lg:text-[2.4rem]">
            Deixe os imóveis virem até você
          </h1>
          <p className="mt-3 text-white/85 md:text-lg">
            Em vez de procurar um a um, diga o que você precisa. Os proprietários da cidade veem seu
            pedido e respondem com os imóveis que combinam — de graça, pela plataforma.
          </p>

          {/* Checklist + passos: no desktop moram aqui; no mobile vão abaixo do form. */}
          <div className="hidden lg:block">
            <Checklist />
            <Passos />
          </div>
        </div>
      </aside>

      {/* LADO DIREITO — card branco "flutua" sobre off-white; no desktop a coluna
          tem a altura da imagem e centraliza o card na vertical (sem vão branco). */}
      <div className="bg-[#F7F6F2] px-4 py-8 sm:px-8 lg:flex lg:min-h-[calc(100vh-4.5rem)] lg:items-center lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-xl">
          <PedidoForm />

          {/* Mobile: checklist + passos abaixo do formulário. */}
          <div className="mt-8 rounded-2xl border border-line bg-white p-6 lg:hidden">
            <ChecklistLight />
            <PassosLight />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Blocos reutilizáveis (versão clara p/ o painel escuro; versão light p/ mobile) ── */
function Checklist() {
  return (
    <ul className="mt-8 space-y-3.5">
      {CHECKLIST.map((s) => (
        <li key={s.t} className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
            <s.icon className="h-4 w-4 text-champagne" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{s.t}</p>
            <p className="text-xs text-white/70">{s.d}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Passos() {
  return (
    <ol className="mt-8 space-y-2.5 border-t border-white/15 pt-6">
      {PASSOS.map((p, i) => (
        <li key={p} className="flex items-center gap-3 text-sm text-white/90">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-champagne text-xs font-bold text-night">
            {i + 1}
          </span>
          {p}
        </li>
      ))}
    </ol>
  );
}

function ChecklistLight() {
  return (
    <ul className="space-y-3">
      {CHECKLIST.map((s) => (
        <li key={s.t} className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sage-100">
            <s.icon className="h-4 w-4 text-forest" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{s.t}</p>
            <p className="text-xs text-muted">{s.d}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PassosLight() {
  return (
    <ol className="mt-5 space-y-2.5 border-t border-line pt-5">
      {PASSOS.map((p, i) => (
        <li key={p} className="flex items-center gap-3 text-sm text-ink">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest text-xs font-bold text-white">
            {i + 1}
          </span>
          {p}
        </li>
      ))}
    </ol>
  );
}

function PedidoForm() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  // Pré-preenche com os parâmetros vindos da busca (Fase 4 — zero resultado →
  // pedido de moradia). URL como fonte da verdade; sem effect (evita re-render).
  const sp = useSearchParams();
  const inicioQ = sp.get("inicio") ?? "";
  const mesesQ = Number(sp.get("meses"));
  const ocupQ = Number(sp.get("adultos") || 0) + Number(sp.get("criancas") || 0);
  const orcQ = sp.get("orcamento") ?? "";

  const [cidade, setCidade] = useState(sp.get("cidade") ?? "");
  const [uf, setUf] = useState((sp.get("uf") ?? "").toUpperCase().slice(0, 2));
  const [dataInicio, setDataInicio] = useState(/^\d{4}-\d{2}-\d{2}$/.test(inicioQ) ? inicioQ : "");
  const [prazoMeses, setPrazoMeses] = useState(mesesQ >= 1 && mesesQ <= 12 ? mesesQ : 6);
  const [orcamento, setOrcamento] = useState(/^\d+$/.test(orcQ) ? orcQ : "");
  const [ocupantes, setOcupantes] = useState(ocupQ >= 1 ? ocupQ : 1);
  const [motivo, setMotivo] = useState("");
  const [apresentacao, setApresentacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Eco do filtro anti-contato no cliente (o servidor é a fonte da verdade).
  const contatoNoTexto = apresentacao.length > 0 && contemContato(apresentacao);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (contatoNoTexto) {
      setErro(CONTATO_AVISO);
      return;
    }
    // Deslogado: leva ao login guardando o destino (volta para cá após entrar).
    if (!user) {
      router.push("/auth?redirect=/pedidos/novo");
      return;
    }
    setEnviando(true);
    const res = await criarPedido({
      cidade,
      uf: uf || undefined,
      dataInicio,
      prazoMeses,
      orcamentoMensal: Number(orcamento) || 0,
      qtdOcupantes: ocupantes,
      motivo,
      apresentacao: apresentacao || undefined,
    });
    setEnviando(false);
    if (res.ok) {
      router.push("/dashboard/pedidos");
    } else {
      setErro(res.error ?? "Não foi possível publicar o pedido.");
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-lg sm:p-7">
      <h2 className="font-title text-xl font-bold text-ink">Publique seu pedido — leva 2 minutos</h2>

      {!user && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-champagne/50 bg-champagne/10 px-3.5 py-2.5 text-sm text-ink">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
          Preencha à vontade — ao publicar, pedimos um login rápido (ou cadastro) para os
          proprietários poderem responder você.
        </p>
      )}

      <form onSubmit={submit} className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-ink">Cidade</span>
            <input
              required
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Uberlândia"
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-sage"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-ink">UF</span>
            <input
              value={uf}
              onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="MG"
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm uppercase outline-none focus:border-sage"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className="mb-1 block text-sm font-medium text-ink">A partir de</span>
            <DateFieldBR
              required
              value={dataInicio}
              onChange={setDataInicio}
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-sage"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-ink">Prazo (meses)</span>
            <select
              value={prazoMeses}
              onChange={(e) => setPrazoMeses(Number(e.target.value))}
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-sage"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? "mês" : "meses"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-ink">Ocupantes</span>
            <input
              type="number"
              min={1}
              value={ocupantes}
              onChange={(e) => setOcupantes(Math.max(1, Math.round(Number(e.target.value) || 1)))}
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-sage"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-medium text-ink">Orçamento por mês (R$)</span>
            <input
              required
              inputMode="numeric"
              value={orcamento}
              onChange={(e) => setOrcamento(e.target.value.replace(/\D/g, ""))}
              placeholder="3500"
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-sage"
            />
          </label>
          <div>
            <span className="mb-1 block text-sm font-medium text-ink">Motivo</span>
            <MotivoSelect value={motivo} onChange={setMotivo} />
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Apresentação (opcional)</span>
          <textarea
            rows={4}
            value={apresentacao}
            onChange={(e) => setApresentacao(e.target.value)}
            placeholder="Conte um pouco do seu perfil e do que procura. Não inclua telefone, e-mail ou apps de mensagem."
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-sage ${
              contatoNoTexto ? "border-red-300" : "border-line"
            }`}
          />
          {contatoNoTexto && (
            <span className="mt-1 flex items-start gap-1.5 text-xs text-red-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {CONTATO_AVISO}
            </span>
          )}
        </label>

        {dataInicio && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            Seu pedido expira em{" "}
            <strong className="text-ink">
              {calcExpiraEm(dataInicio, new Date().toISOString().slice(0, 10))}
            </strong>{" "}
            (o menor entre 15 dias após o início e 60 dias após publicar).
          </p>
        )}

        <p className="flex items-start gap-2 rounded-lg border border-sage-200 bg-surface-2 px-3 py-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
          Toda a conversa acontece pela plataforma — é o que fica registrado. A Viva Nomads conecta
          e documenta; não é locadora, fiadora nem intermediária de pagamento.
        </p>

        {erro && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}{" "}
            {erro.startsWith("Entre") && (
              <Link href="/auth" className="font-medium underline">
                Entrar
              </Link>
            )}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          {user && (
            <Link href="/dashboard/pedidos" className="text-sm text-muted hover:text-ink">
              Ver meus pedidos
            </Link>
          )}
          <Button type="submit" variant="gold" disabled={enviando || contatoNoTexto}>
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Publicando…
              </>
            ) : (
              "Publicar pedido"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Seletor de motivo com ícone + rótulo + descrição por opção (dropdown, click-away). */
function MotivoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const atual = MOTIVOS.find((m) => m.key === value);
  const AtualIcon = atual ? MOTIVO_ICON[atual.key] : null;

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm outline-none ${
          open ? "border-sage" : "border-line"
        }`}
      >
        <span className={`flex items-center gap-2 ${atual ? "text-ink" : "text-muted"}`}>
          {AtualIcon && <AtualIcon className="h-4 w-4 text-forest" />}
          {atual ? atual.label : "Selecione o motivo da estadia…"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-xl border border-line bg-white py-1 shadow-xl"
        >
          {MOTIVOS.map((m) => {
            const ativo = m.key === value;
            const Icon = MOTIVO_ICON[m.key] ?? MoreHorizontal;
            return (
              <button
                key={m.key}
                type="button"
                role="option"
                aria-selected={ativo}
                onClick={() => {
                  onChange(m.key);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-2.5 px-3.5 py-2 text-left hover:bg-surface-2 ${
                  ativo ? "bg-sage-100" : ""
                }`}
              >
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sage-100 text-forest">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-forest">{m.label}</span>
                  <span className="block text-xs text-muted">{m.descricao}</span>
                </span>
                {ativo && <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
