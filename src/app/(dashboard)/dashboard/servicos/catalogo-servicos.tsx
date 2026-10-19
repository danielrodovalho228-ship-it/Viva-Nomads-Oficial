"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/dashboard/primitives";
import { pedirServico, type ServicoView } from "@/lib/data/servicos-morador-actions";
import { FAIXAS_HORARIO, MAX_OBSERVACAO, NOTA_PAGAMENTO_DIRETO, type FaixaHorario } from "@/lib/servicos-morador";

/** S1 (catálogo) e S2 (pedido): serviço sem parceiro aparece como "Em breve" e não abre pedido. */
export function CatalogoServicos({ servicos }: { servicos: ServicoView[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  if (servicos.length === 0)
    return <p className="text-sm text-muted">Nenhum serviço disponível por enquanto.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2" data-testid="servicos-lista">
      {servicos.map((s) => (
        <li key={s.id}>
          <Panel data-testid={`servico-${s.id}`} className="h-full">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-forest">
                <Wrench className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="font-title text-base font-bold text-ink">{s.nome}</h3>
                <p className="mt-1 text-sm text-muted">{s.descricao}</p>
              </div>
            </div>
            {s.aceitaPedido ? (
              aberto === s.id ? (
                <FormularioPedido servico={s} onFechar={() => setAberto(null)} />
              ) : (
                <Button variant="primary" size="md" className="mt-4 w-full sm:w-auto" onClick={() => setAberto(s.id)} data-testid={`servico-pedir-${s.id}`}>
                  Pedir este serviço
                </Button>
              )
            ) : (
              <p className="mt-4 inline-flex rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-forest" data-testid={`servico-embreve-${s.id}`}>
                Em breve
              </p>
            )}
          </Panel>
        </li>
      ))}
    </ul>
  );
}

function FormularioPedido({ servico, onFechar }: { servico: ServicoView; onFechar: () => void }) {
  const [data, setData] = useState("");
  const [faixa, setFaixa] = useState<FaixaHorario | "">("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await pedirServico(servico.id, { data, faixa, observacao });
    setEnviando(false);
    if (!r.ok) return setErro(r.error ?? "Não foi possível enviar o pedido.");
    setEnviado(true);
    // Atualiza a lista "Meus pedidos" sem depender de recarregar o cache.
    window.location.reload();
  }

  if (enviado) return <p className="mt-4 text-sm font-semibold text-forest">Pedido enviado!</p>;
  return (
    <form onSubmit={enviar} className="mt-4 grid gap-3" data-testid="servico-form">
      <label className="grid gap-1 text-sm font-medium text-ink">
        Data desejada
        <input type="date" required value={data} onChange={(e) => setData(e.target.value)} data-testid="servico-data" className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink" />
      </label>
      <label className="grid gap-1 text-sm font-medium text-ink">
        Faixa de horário
        <select required value={faixa} onChange={(e) => setFaixa(e.target.value as FaixaHorario)} data-testid="servico-faixa" className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink">
          <option value="">Escolha…</option>
          {FAIXAS_HORARIO.map((f) => (
            <option key={f.id} value={f.id}>{f.rotulo}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-ink">
        Observação (opcional)
        <textarea value={observacao} maxLength={MAX_OBSERVACAO} rows={3} onChange={(e) => setObservacao(e.target.value)} data-testid="servico-observacao" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-base text-ink" />
      </label>
      <div className="rounded-xl bg-sage-100 p-3 text-sm text-ink" data-testid="servico-resumo">
        <p><strong>Prestador:</strong> {servico.parceiro}</p>
        <p><strong>Preço:</strong> {servico.preco ?? "combinado com o prestador"}</p>
        <p><strong>Pagamento:</strong> direto ao prestador. {NOTA_PAGAMENTO_DIRETO}</p>
      </div>
      {erro && <p role="alert" className="text-sm text-red-700" data-testid="servico-erro">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="md" disabled={enviando} data-testid="servico-enviar">
          {enviando ? "Enviando…" : "Enviar pedido"}
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={onFechar}>Cancelar</Button>
      </div>
    </form>
  );
}
