"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Megaphone, ShieldCheck, Info, Loader2, ChevronDown, Check, CircleCheck, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOTIVOS, contemContato, CONTATO_AVISO, calcExpiraEm } from "@/lib/pedidos/pedidos";
import { criarPedido } from "@/lib/data/pedidos-actions";
import { useAuthStore } from "@/lib/store";

/** /pedidos/novo — o inquilino publica o que precisa (housing request reverso). */
export default function NovoPedidoPage() {
  return (
    <Suspense fallback={<div className="container-page py-10" />}>
      <NovoPedidoForm />
    </Suspense>
  );
}

function NovoPedidoForm() {
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
    <div className="pb-16">
      {/* HERO — banner de topo com proposta de valor e "como funciona" em 3 passos. */}
      <section className="relative overflow-hidden bg-gradient-to-br from-forest via-forest to-[#123a2e] text-white">
        <Megaphone
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rotate-12 text-white/[0.07]"
        />
        <div className="container-page py-12 md:py-16">
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
              <Megaphone className="h-3.5 w-3.5" /> Pedido de moradia
            </span>
            <h1 className="mt-4 font-title text-3xl font-bold leading-tight md:text-[2.6rem]">
              Deixe os imóveis virem até você
            </h1>
            <p className="mt-3 max-w-2xl text-white/85 md:text-lg">
              Em vez de procurar um a um, diga o que você precisa. Os proprietários da cidade veem
              seu pedido e respondem com os imóveis que combinam — de graça, pela plataforma.
            </p>
            <div className="mt-7 grid gap-2.5 sm:grid-cols-3">
              {[
                { icon: MessageSquare, t: "Você publica", d: "Cidade, datas, orçamento e perfil." },
                { icon: CircleCheck, t: "Proprietários respondem", d: "Só imóveis que atendem." },
                { icon: Clock, t: "Sem custo e sem spam", d: "Contato só pela plataforma." },
              ].map((s) => (
                <div
                  key={s.t}
                  className="flex items-start gap-2 rounded-xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-sm"
                >
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-champagne" />
                  <div>
                    <p className="text-sm font-semibold text-white">{s.t}</p>
                    <p className="text-xs text-white/70">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="container-page">
        <div className="relative z-10 mx-auto -mt-8 max-w-2xl">
        {!user && (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-champagne/50 bg-champagne/10 px-3.5 py-2.5 text-sm text-ink">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
            Preencha à vontade — ao publicar, pedimos um login rápido (ou cadastro) para os
            proprietários poderem responder você.
          </p>
        )}

        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-line bg-white p-6">
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
              <input
                required
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
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
              Seu pedido expira em <strong className="text-ink">{calcExpiraEm(dataInicio, new Date().toISOString().slice(0, 10))}</strong>{" "}
              (o menor entre 15 dias após o início e 60 dias após publicar).
            </p>
          )}

          <p className="flex items-start gap-2 rounded-lg border border-sage-200 bg-surface-2 px-3 py-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
            Toda a conversa acontece pela plataforma — é o que fica registrado. A Viva Nomads
            conecta e documenta; não é locadora, fiadora nem intermediária de pagamento.
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
      </div>
    </div>
  );
}

/** Seletor de motivo com rótulo + descrição por opção (dropdown, click-away). */
function MotivoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const atual = MOTIVOS.find((m) => m.key === value);

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
        <span className={atual ? "text-ink" : "text-muted"}>
          {atual ? atual.label : "Selecione o motivo da estadia…"}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-xl border border-line bg-white py-1 shadow-xl"
        >
          {MOTIVOS.map((m) => {
            const ativo = m.key === value;
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
                className={`flex w-full items-start justify-between gap-2 px-3.5 py-2 text-left hover:bg-surface-2 ${
                  ativo ? "bg-sage-100" : ""
                }`}
              >
                <span>
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
