"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apagarResposta, salvarResposta } from "@/lib/data/respostas-actions";
import { LIMITE_RESPOSTAS, TEXTO_MAX, TITULO_MAX, validarResposta, type RespostaRapida } from "@/lib/respostas/regras";
import { semQuedaDeRede } from "@/lib/erro-de-rede";
import { MODELOS_SUGERIDOS } from "@/lib/respostas/modelos-sugeridos";

export function RespostasTela({ inicial }: { inicial: RespostaRapida[] }) {
  const router = useRouter();
  const [edicao, setEdicao] = useState<{ id: string | null; titulo: string; texto: string }>({ id: null, titulo: "", texto: "" });
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const cheio = inicial.length >= LIMITE_RESPOSTAS && !edicao.id;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = validarResposta(edicao, inicial.length, !!edicao.id);
    if (!v.ok) return setMsg({ ok: false, texto: v.erro });
    iniciar(async () => {
      const r = await semQuedaDeRede(salvarResposta(edicao));
      setMsg(r.ok ? { ok: true, texto: "Resposta salva." } : { ok: false, texto: r.erro });
      if (r.ok) {
        setEdicao({ id: null, titulo: "", texto: "" });
        router.refresh();
      }
    });
  }
  function apagar(id: string) {
    iniciar(async () => {
      const r = await semQuedaDeRede(apagarResposta(id));
      setConfirmar(null);
      setMsg(r.ok ? { ok: true, texto: "Resposta apagada." } : { ok: false, texto: r.erro });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* E665: textos-modelo das perguntas frequentes. Entram no formulário para o dono conferir e editar; nunca trazem valor nem prazo. */}
      <section aria-labelledby="modelos-title" className="rounded-xl border border-line bg-white p-4 lg:col-span-2" data-testid="respostas-modelos">
        <h2 id="modelos-title" className="font-title text-base font-semibold text-ink">Modelos para começar</h2>
        <p className="mt-1 text-sm text-muted">Toque em um modelo, preencha o que está entre colchetes e salve. Nada é salvo sozinho, e os valores e prazos são seus.</p>
        <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {MODELOS_SUGERIDOS.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  setEdicao({ id: null, titulo: m.titulo, texto: m.texto });
                  setMsg(null);
                }}
                className="flex min-h-11 w-full items-center justify-center rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-ink"
                data-testid={`resposta-modelo-${m.id}`}
              >
                {m.tema}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <form onSubmit={salvar} className="rounded-xl border border-line bg-white p-4" data-testid="resposta-form">
        <h2 className="font-title text-base font-semibold text-ink">{edicao.id ? "Editar resposta" : "Nova resposta"}</h2>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium text-ink">Título</span>
          <input
            value={edicao.titulo}
            onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })}
            maxLength={TITULO_MAX}
            placeholder="Ex.: Horário de entrada"
            className="w-full rounded-xl border border-sage-200 px-3 py-3 text-sm outline-none focus:border-sage"
            data-testid="resposta-titulo"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium text-ink">Texto</span>
          <textarea
            value={edicao.texto}
            onChange={(e) => setEdicao({ ...edicao, texto: e.target.value })}
            maxLength={TEXTO_MAX}
            rows={5}
            className="w-full rounded-xl border border-sage-200 px-3 py-3 text-sm outline-none focus:border-sage"
            data-testid="resposta-texto"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pendente || cheio}
            className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-medium text-white disabled:opacity-60"
            data-testid="resposta-salvar"
          >
            Salvar
          </button>
          {edicao.id && (
            <button type="button" onClick={() => setEdicao({ id: null, titulo: "", texto: "" })} className="min-h-11 text-sm font-medium text-muted underline">
              Desistir
            </button>
          )}
          <span className="text-sm text-muted" data-testid="respostas-contagem">
            {inicial.length} de {LIMITE_RESPOSTAS}
          </span>
        </div>
        {msg && (
          <p className={msg.ok ? "mt-2 text-sm text-forest" : "mt-2 text-sm text-red-700"} role="status" data-testid="resposta-msg">
            {msg.texto}
          </p>
        )}
      </form>

      <section aria-label="Respostas salvas">
        {inicial.length === 0 ? (
          <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted" data-testid="respostas-vazio">
            Nenhuma resposta salva ainda. Comece pelas perguntas que você mais responde: horário de entrada, vaga de garagem, regras da casa.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="respostas-lista">
            {inicial.map((r) => (
              <li key={r.id} className="rounded-xl border border-line bg-white p-4" data-testid="resposta-item">
                <p className="font-semibold text-ink">{r.titulo}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.texto}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setEdicao({ id: r.id, titulo: r.titulo, texto: r.texto })} className="min-h-11 text-sm font-medium text-forest underline">
                    Editar
                  </button>
                  {confirmar === r.id ? (
                    <>
                      <button type="button" onClick={() => apagar(r.id)} disabled={pendente} className="min-h-11 text-sm font-medium text-red-700 underline" data-testid="resposta-apagar-confirmar">
                        Apagar de vez
                      </button>
                      <button type="button" onClick={() => setConfirmar(null)} className="min-h-11 text-sm font-medium text-muted underline">
                        Manter
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmar(r.id)} className="min-h-11 text-sm font-medium text-muted underline" data-testid="resposta-apagar">
                      Apagar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
