"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, ShieldCheck, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOTIVOS, contemContato, CONTATO_AVISO, calcExpiraEm } from "@/lib/pedidos/pedidos";
import { criarPedido } from "@/lib/data/pedidos-actions";

/** /pedidos/novo — o inquilino publica o que precisa (housing request reverso). */
export default function NovoPedidoPage() {
  const router = useRouter();
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [prazoMeses, setPrazoMeses] = useState(6);
  const [orcamento, setOrcamento] = useState("");
  const [ocupantes, setOcupantes] = useState(1);
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
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sage-100 text-forest">
            <Megaphone className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-title text-2xl font-bold text-ink">Publicar pedido de moradia</h1>
            <p className="text-sm text-muted">
              Diga o que você precisa — os proprietários da cidade respondem com os imóveis deles.
            </p>
          </div>
        </div>

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
            <label>
              <span className="mb-1 block text-sm font-medium text-ink">Motivo</span>
              <select
                required
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-sage"
              >
                <option value="">Selecione…</option>
                {MOTIVOS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
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
            <Link href="/dashboard/pedidos" className="text-sm text-muted hover:text-ink">
              Ver meus pedidos
            </Link>
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
  );
}
