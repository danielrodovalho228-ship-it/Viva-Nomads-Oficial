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

/**
 * E476 (i): o moderador precisa VER a foto — prévia quadrada inteira (sem cortar em círculo), abre em tamanho real em
 * nova aba, e diz quando a imagem não carrega em vez de deixar o ícone de imagem quebrada.
 */
function PreviaFoto({ url, nome }: { url: string | null; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  if (!url) {
    return (
      <span className="grid aspect-square w-full max-w-[240px] place-items-center rounded-xl border border-line bg-white text-xs text-muted" data-testid="foto-previa-erro">
        Sem arquivo
      </span>
    );
  }
  if (falhou) {
    return (
      <span role="alert" className="grid aspect-square w-full max-w-[240px] place-items-center rounded-xl border border-line bg-white p-3 text-center text-xs text-amber-800" data-testid="foto-previa-erro">
        Não foi possível carregar a imagem. Atualize a página; se continuar, não aprove nem remova esta foto.
      </span>
    );
  }
  return (
    <span className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do bucket privado, curta duração */}
      <img
        src={url}
        alt={`Foto de perfil de ${nome}`}
        onError={() => setFalhou(true)}
        className="aspect-square w-full max-w-[240px] rounded-xl border border-line bg-surface-2 object-contain"
        data-testid="foto-previa"
      />
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-forest underline" data-testid="foto-abrir">
        Abrir em tamanho real
      </a>
    </span>
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
        <div className="flex flex-col gap-3">
          <PreviaFoto url={f.url} nome={f.nome} />
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
