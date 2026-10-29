"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { aprovarFotoPerfil, removerFotoPerfil, type FotoNaFila } from "@/lib/data/fotos-perfil-actions";
import { SoLeituraQa } from "@/components/admin/so-leitura-qa";
import { MOTIVOS_REMOCAO_FOTO } from "@/lib/perfil/foto-revisao";

/** `soLeitura` (pendência 3 do QA-LOGIN-B v2): fotos de conta real, que o admin observador da QA só vê. */
export function FilaFotosCliente({ fila, soLeitura = [] }: { fila: FotoNaFila[]; soLeitura?: string[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="fila-fotos" data-total={fila.length}>
      {fila.map((f) => (
        <ItemFoto key={f.id} f={f} soLeitura={soLeitura.includes(f.id)} />
      ))}
    </ul>
  );
}

function ItemFoto({ f, soLeitura }: { f: FotoNaFila; soLeitura: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [removendo, setRemovendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (acao: () => Promise<{ ok: true } | { ok: false; erro: string }>) =>
    iniciar(async () => {
      setMsg(null);
      const r = await acao().catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
      if (r.ok) router.refresh();
      else setMsg(r.erro);
    });
  return (
    <li data-testid="fila-foto" data-user={f.userId} data-denunciada={f.denunciadaEm ? "1" : "0"}>
      <Panel>
        <div className="flex items-center gap-4">
          {f.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada do bucket privado, curta duração
            <img src={f.url} alt={`Foto de perfil de ${f.nome}`} width={96} height={96} className="h-24 w-24 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-line bg-white text-xs text-muted">Sem arquivo</span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{f.nome}</p>
            <p className="text-sm text-muted">Enviada em {dataHoraBRT(f.enviadaEm)}</p>
            {f.denunciadaEm && <p className="text-sm font-semibold text-red-700">Denunciada em {dataHoraBRT(f.denunciadaEm)}</p>}
          </div>
        </div>
        {soLeitura ? (
          <SoLeituraQa className="mt-4" />
        ) : !removendo ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button size="sm" disabled={pendente} onClick={() => rodar(() => aprovarFotoPerfil(f.id))} data-testid="foto-aprovar">
              Aprovar
            </Button>
            <Button size="sm" variant="secondary" disabled={pendente} onClick={() => setRemovendo(true)} data-testid="foto-remover">
              Remover
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <label className="block text-sm font-semibold text-ink">
              Motivo
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink" data-testid="foto-motivo">
                <option value="">Escolha o motivo</option>
                {MOTIVOS_REMOCAO_FOTO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button size="sm" variant="ghost" disabled={pendente} onClick={() => setRemovendo(false)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={pendente || !motivo} onClick={() => rodar(() => removerFotoPerfil(f.id, motivo))} data-testid="foto-remover-confirmar">
                Remover a foto
              </Button>
            </div>
          </div>
        )}
        {msg && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {msg}
          </p>
        )}
      </Panel>
    </li>
  );
}
