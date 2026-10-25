"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AREAS, MATRIZ, ROTULO_AREA, itemNivel, type ChaveNivel } from "@/config/niveis";
import { salvarItemNivel, type NivelDoImovelTela } from "@/lib/data/nivel-actions";
import { Extras, Ruido } from "@/components/niveis/ruido-extras";
import { ProvaNaHora } from "@/components/niveis/camera-prova";
import { AVISO_PROVA_NA_HORA, MARCA_FOTO_ANTERIOR, provaAntigaNoPrazo, textoRefazerFoto } from "@/lib/niveis/prova-camera";

const STATUS = { pendente: "Foto em análise", aceita: "Foto aceita", recusada: "Foto recusada" } as const;

export function FormNivel({ propertyId, dados, fotografar = null }: { propertyId: string; dados: NivelDoImovelTela; fotografar?: string | null }) {
  return (
    <div className="space-y-6">
      <ItensNivel propertyId={propertyId} dados={dados} fotografar={fotografar} />
      <Ruido propertyId={propertyId} inicial={dados.ruido} />
      <Extras propertyId={propertyId} inicial={dados.extras} />
    </div>
  );
}

function ItensNivel({ propertyId, dados, fotografar }: { propertyId: string; dados: NivelDoImovelTela; fotografar: string | null }) {
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
    <section id="nivel-itens" className="scroll-mt-24 rounded-xl border border-line bg-white p-4" data-testid="nivel-itens">
      <h2 className="text-base font-semibold text-ink">Itens de Conforto e Premium</h2>
      <p className="mt-1 text-sm text-ink" data-testid="prova-na-hora-aviso">
        {AVISO_PROVA_NA_HORA}
      </p>
      <p className="mt-1 text-xs text-muted">Uma foto por item, sem pessoas. Item sem foto não conta. O atendimento da Viva pode recusar uma foto que não mostra o item.</p>
      {grupos.map((g) => (
        <div key={g.area} className="mt-4">
          <p className="text-sm font-semibold text-ink">{ROTULO_AREA[g.area]}</p>
          <ul className="mt-2 space-y-3">
            {g.linhas.map(({ k, n }) => (
              <LinhaItem key={k} propertyId={propertyId} chave={k} nivel={n} item={porChave.get(k)} abrir={fotografar === k} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function LinhaItem({ propertyId, chave, nivel, item, abrir }: { propertyId: string; chave: ChaveNivel; nivel: "conforto" | "premium"; item: NivelDoImovelTela["itens"][number] | undefined; abrir: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const info = itemNivel(chave);
  // FOTO-NA-HORA-B: a foto da prova é feita na hora (ProvaNaHora); a caixa "O imóvel tem" só declara ou retira.
  const salvar = (declarado: boolean) =>
    iniciar(async () => {
      setMsg(null);
      try {
        const r = await salvarItemNivel(propertyId, chave, declarado);
        setMsg(r.ok ? { ok: true, t: r.mensagem ?? "Salvo." } : { ok: false, t: r.erro });
        if (r.ok) router.refresh();
      } catch {
        setMsg({ ok: false, t: "Não foi possível salvar agora." });
      }
    });
  const anterior = !!item && provaAntigaNoPrazo({ fotoOrigem: item.fotoOrigem, refazerAte: item.refazerAte, fotoPath: item.fotoUrl }, new Date());
  return (
    <li className="rounded-lg border border-line p-3 text-sm" data-testid={`nivel-item-${chave}`} data-declarado={item?.declarado ? "1" : "0"} data-foto={item?.fotoStatus ?? "pendente"} data-origem={item?.fotoOrigem ?? ""}>
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
        <ProvaNaHora
          propertyId={propertyId}
          chave={chave}
          rotulo={info.rotulo}
          autoAbrir={abrir}
          testid={`nivel-foto-${chave}`}
          rotuloBotao={item?.fotoUrl && !anterior ? "Fotografar de novo" : undefined}
          onRecebida={(m) => {
            setMsg({ ok: true, t: m });
            router.refresh();
          }}
        />
        {item?.fotoUrl && (
          <span className={item.fotoStatus === "recusada" ? "text-xs text-red-700" : "text-xs text-muted"} data-testid={`nivel-status-${chave}`}>
            {STATUS[item.fotoStatus]}
            {item.fotoStatus === "recusada" && item.motivoRecusa ? `: ${item.motivoRecusa}` : ""}
          </span>
        )}
      </div>
      {anterior && item?.refazerAte && (
        <p className="mt-1 text-xs text-amber-800" data-testid={`nivel-anterior-${chave}`}>
          <span className="font-semibold">{MARCA_FOTO_ANTERIOR}</span> · {textoRefazerFoto(info.rotulo, item.refazerAte)}.
        </p>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "mt-1 text-xs text-ink" : "mt-1 text-xs text-red-700"} data-testid={`nivel-msg-${chave}`}>
          {msg.t}
        </p>
      )}
    </li>
  );
}
