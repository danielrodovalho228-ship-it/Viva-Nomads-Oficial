"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { decidirVinculo, linkVinculoAdmin, type VinculoPendente } from "@/lib/data/triagem-actions";
import { MOTIVOS_RECUSA, type MotivoRecusa } from "@/lib/triagem/vinculo";
import { abrirLinkEmNovaAba } from "@/lib/abrir-aba";
import { Button } from "@/components/ui/button";
import { dataBRT } from "@/lib/datas-brasilia";

const ROTULO_MOTIVO: Record<MotivoRecusa, string> = {
  ilegivel: "Ilegível",
  sem_nome: "Sem o nome do morador",
  antigo: "Documento antigo",
  tipo_errado: "Não comprova vínculo",
  outro: "Outro",
};

/**
 * Prompt 52 — fila do comprovante de vínculo, na mesma tela de conferência de documentos. Aprovar vale 12 meses; recusar
 * exige um motivo que o morador entende (ele reenvia na hora). Contas de teste aparecem marcadas e ficam fora da contagem.
 */
export function VinculosAdmin({ itens, metricas }: { itens: VinculoPendente[]; metricas: { pendentes: number; aprovados: number; recusados: number } }) {
  return (
    <section className="mt-8" data-testid="admin-vinculos">
      <h2 className="font-title text-xl font-semibold text-ink">Comprovantes de vínculo</h2>
      <p className="text-sm text-muted" data-testid="admin-vinculos-metricas">
        {metricas.pendentes} na fila · {metricas.aprovados} aprovados · {metricas.recusados} recusados (sem contas de teste). Confira nome, instituição ou empresa e
        data. Nunca anote valores.
      </p>
      {itens.length === 0 ? (
        <p className="mt-3 rounded-xl border border-line bg-white p-4 text-sm text-muted">Nenhum comprovante de vínculo na fila.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {itens.map((i) => (
            <ItemVinculo key={i.id} item={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemVinculo({ item }: { item: VinculoPendente }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState<MotivoRecusa | "">("");
  const [complemento, setComplemento] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function decidir(d: "aprovar" | "recusar") {
    iniciar(async () => {
      const r = await decidirVinculo(item.id, d, motivo || null, complemento || null);
      if (!r.ok) return setMsg(r.error ?? "Não foi possível decidir agora.");
      router.refresh();
    });
  }
  async function abrir() {
    await abrirLinkEmNovaAba(
      () => window.open("about:blank", "_blank"),
      async () => {
        const r = await linkVinculoAdmin(item.id);
        return r.ok && r.url ? r.url : null;
      },
    );
  }

  return (
    <li className="rounded-xl border border-line bg-white p-4" data-testid="admin-vinculo" data-id={item.id}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-ink">{item.nomeCompleto ?? item.nome}</p>
        {item.teste && <span className="rounded-full border border-line bg-white px-2 py-1 text-xs text-muted">conta de teste</span>}
      </div>
      <p className="text-sm text-muted">
        {item.tipoTitulo} · enviado em {dataBRT(item.enviadoEm)}
      </p>
      {item.docUrl && item.docTipo === "imagem" && (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada de 10 min do bucket privado
        <img src={item.docUrl} alt={`Comprovante de vínculo de ${item.nome}`} className="mt-3 max-h-80 rounded-lg border border-line object-contain" />
      )}
      <button type="button" onClick={abrir} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest underline" data-testid="admin-vinculo-abrir">
        <ExternalLink className="h-4 w-4" aria-hidden /> Abrir documento (link de 10 min)
      </button>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-ink">Motivo, se recusar</span>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoRecusa)} className="w-full rounded-xl border border-sage-200 px-3 py-3 text-sm" data-testid="admin-vinculo-motivo">
            <option value="">Escolha</option>
            {(Object.keys(MOTIVOS_RECUSA) as MotivoRecusa[]).map((m) => (
              <option key={m} value={m}>
                {ROTULO_MOTIVO[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-ink">Complemento (opcional, o morador lê)</span>
          <input value={complemento} onChange={(e) => setComplemento(e.target.value)} maxLength={200} className="w-full rounded-xl border border-sage-200 px-3 py-3 text-sm" data-testid="admin-vinculo-complemento" />
        </label>
      </div>
      {motivo && <p className="mt-2 text-xs text-muted">O morador vai ler: “{MOTIVOS_RECUSA[motivo]}”</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <Button type="button" size="sm" onClick={() => decidir("aprovar")} disabled={pendente} data-testid="admin-vinculo-aprovar">
          Aprovar (12 meses)
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={() => decidir("recusar")} disabled={pendente || !motivo} data-testid="admin-vinculo-recusar">
          Recusar
        </Button>
      </div>
      {msg && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {msg}
        </p>
      )}
    </li>
  );
}
