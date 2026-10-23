"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AREAS, EXTRAS, MATRIZ, PERGUNTAS_RUIDO, ROTULO_AREA, itemNivel, type ChaveNivel } from "@/config/niveis";
import { salvarExtras, salvarItemNivel, salvarRuido, type NivelDoImovelTela } from "@/lib/data/nivel-actions";

const STATUS = { pendente: "Foto em análise", aceita: "Foto aceita", recusada: "Foto recusada" } as const;

/** Envia a foto pelo upload do anúncio (re-codificada sem EXIF, na pasta do dono) e devolve o caminho. */
async function enviarFoto(arquivo: File): Promise<{ ok: true; path: string } | { ok: false; erro: string }> {
  const fd = new FormData();
  fd.set("file", arquivo);
  const r = await fetch("/api/upload/foto", { method: "POST", body: fd });
  const j = (await r.json().catch(() => ({}))) as { path?: string; error?: string };
  return r.ok && j.path ? { ok: true, path: j.path } : { ok: false, erro: j.error ?? "Não foi possível enviar a foto." };
}

export function FormNivel({ propertyId, dados }: { propertyId: string; dados: NivelDoImovelTela }) {
  return (
    <div className="space-y-6">
      <ItensNivel propertyId={propertyId} dados={dados} />
      <Ruido propertyId={propertyId} inicial={dados.ruido} />
      <Extras propertyId={propertyId} inicial={dados.extras} />
    </div>
  );
}

function ItensNivel({ propertyId, dados }: { propertyId: string; dados: NivelDoImovelTela }) {
  const porChave = new Map(dados.itens.map((i) => [i.chave, i]));
  // Item que vale para duas áreas (ex.: ar-condicionado da sala) aparece uma vez só, na primeira.
  const vistos = new Set<string>();
  const grupos = AREAS.map((a) => ({
    area: a,
    linhas: (["conforto", "premium"] as const).flatMap((n) =>
      MATRIZ[a][n].filter((k) => itemNivel(k).prova === "foto" && !vistos.has(k) && (vistos.add(k), true)).map((k) => ({ k, n })),
    ),
  })).filter((g) => g.linhas.length > 0);
  return (
    <section className="rounded-xl border border-line bg-white p-4" data-testid="nivel-itens">
      <h2 className="text-base font-semibold text-ink">Itens de Conforto e Premium</h2>
      <p className="mt-1 text-xs text-muted">Uma foto por item, sem pessoas. Item sem foto não conta. O atendimento da Viva pode recusar uma foto que não mostra o item.</p>
      {grupos.map((g) => (
        <div key={g.area} className="mt-4">
          <p className="text-sm font-semibold text-ink">{ROTULO_AREA[g.area]}</p>
          <ul className="mt-2 space-y-3">
            {g.linhas.map(({ k, n }) => (
              <LinhaItem key={k} propertyId={propertyId} chave={k} nivel={n} item={porChave.get(k)} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function LinhaItem({ propertyId, chave, nivel, item }: { propertyId: string; chave: ChaveNivel; nivel: "conforto" | "premium"; item: NivelDoImovelTela["itens"][number] | undefined }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const info = itemNivel(chave);
  const salvar = (declarado: boolean, arquivo?: File | null) =>
    iniciar(async () => {
      setMsg(null);
      let path: string | null = null;
      if (arquivo) {
        const up = await enviarFoto(arquivo);
        if (!up.ok) return setMsg({ ok: false, t: up.erro });
        path = up.path;
      }
      const r = await salvarItemNivel(propertyId, chave, declarado, path);
      setMsg(r.ok ? { ok: true, t: r.mensagem ?? "Salvo." } : { ok: false, t: r.erro });
      if (r.ok) router.refresh();
    });
  return (
    <li className="rounded-lg border border-line p-3 text-sm" data-testid={`nivel-item-${chave}`} data-declarado={item?.declarado ? "1" : "0"} data-foto={item?.fotoStatus ?? "pendente"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="font-semibold text-ink">{info.rotulo}</span>
          <span className="ml-2 text-xs text-muted">{nivel === "conforto" ? "Conforto" : "Premium"}</span>
          <span className="block text-xs text-muted">{info.criterio}</span>
        </span>
        {item?.fotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.fotoUrl} alt={`Foto: ${info.rotulo}`} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-ink">
          <input type="checkbox" checked={!!item?.declarado} disabled={pendente} onChange={(e) => salvar(e.target.checked)} data-testid={`nivel-tenho-${chave}`} />
          O imóvel tem
        </label>
        <label className="text-xs text-forest underline">
          {item?.fotoUrl ? "Trocar a foto" : "Enviar a foto"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={pendente}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) salvar(true, f);
              e.target.value = "";
            }}
            data-testid={`nivel-foto-${chave}`}
          />
        </label>
        {item?.fotoUrl && (
          <span className={item.fotoStatus === "recusada" ? "text-xs text-red-700" : "text-xs text-muted"} data-testid={`nivel-status-${chave}`}>
            {STATUS[item.fotoStatus]}
            {item.fotoStatus === "recusada" && item.motivoRecusa ? `: ${item.motivoRecusa}` : ""}
          </span>
        )}
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "mt-1 text-xs text-ink" : "mt-1 text-xs text-red-700"} data-testid={`nivel-msg-${chave}`}>
          {msg.t}
        </p>
      )}
    </li>
  );
}

function Ruido({ propertyId, inicial }: { propertyId: string; inicial: NivelDoImovelTela["ruido"] }) {
  const router = useRouter();
  const [r, setR] = useState<Record<string, boolean | null>>(() => Object.fromEntries(PERGUNTAS_RUIDO.map((p) => [p.chave, inicial ? inicial[p.chave] : null])));
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const completo = PERGUNTAS_RUIDO.every((p) => r[p.chave] !== null);
  return (
    <section className="rounded-xl border border-line bg-white p-4" data-testid="ruido-form">
      <h2 className="text-base font-semibold text-ink">Ruído</h2>
      <p className="mt-1 text-xs text-muted">A classe sai da exposição (baixo, médio ou alto). O morador confere na entrada.</p>
      <ul className="mt-3 space-y-2">
        {PERGUNTAS_RUIDO.map((p) => (
          <li key={p.chave} className="text-sm text-ink" role="radiogroup" aria-label={p.texto}>
            <p>{p.texto}</p>
            <div className="mt-1 flex gap-4">
              <label className="flex min-h-11 items-center gap-2">
                <input type="radio" name={`ruido-${p.chave}`} checked={r[p.chave] === true} onChange={() => setR((a) => ({ ...a, [p.chave]: true }))} data-testid={`ruido-${p.chave}-sim`} />
                Sim
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="radio" name={`ruido-${p.chave}`} checked={r[p.chave] === false} onChange={() => setR((a) => ({ ...a, [p.chave]: false }))} data-testid={`ruido-${p.chave}-nao`} />
                Não
              </label>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={pendente || !completo}
          onClick={() =>
            iniciar(async () => {
              const res = await salvarRuido(propertyId, r);
              setMsg(res.ok ? { ok: true, t: res.mensagem ?? "Salvo." } : { ok: false, t: res.erro });
              if (res.ok) router.refresh();
            })
          }
          data-testid="ruido-salvar"
        >
          Salvar ruído
        </Button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-ink" : "text-sm text-red-700"} data-testid="ruido-resultado">
            {msg.t}
          </p>
        )}
      </div>
    </section>
  );
}

function Extras({ propertyId, inicial }: { propertyId: string; inicial: string[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(() => new Set(inicial));
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <section className="rounded-xl border border-line bg-white p-4" data-testid="extras-form">
      <h2 className="text-base font-semibold text-ink">Extras</h2>
      <p className="mt-1 text-xs text-muted">Aparecem na ficha como fato. Não mudam o nível.</p>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {EXTRAS.map((e) => (
          <li key={e.chave}>
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={sel.has(e.chave)}
                onChange={() => setSel((s) => (s.has(e.chave) ? new Set([...s].filter((k) => k !== e.chave)) : new Set([...s, e.chave])))}
                data-testid={`extra-${e.chave}`}
              />
              {e.rotulo}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const res = await salvarExtras(propertyId, [...sel]);
              setMsg(res.ok ? { ok: true, t: res.mensagem ?? "Salvo." } : { ok: false, t: res.erro });
              if (res.ok) router.refresh();
            })
          }
          data-testid="extras-salvar"
        >
          Salvar extras
        </Button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-ink" : "text-sm text-red-700"} data-testid="extras-resultado">
            {msg.t}
          </p>
        )}
      </div>
    </section>
  );
}
