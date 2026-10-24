"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarSync, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { LIMITE_LINKS_POR_IMOVEL, ROTULO_ORIGEM } from "@/lib/calendario/importar";
import {
  adicionarImportacao,
  atualizarImportacao,
  listarImportacoes,
  removerImportacao,
  type ImportacaoNaTela,
} from "@/lib/data/calendario-importacao-actions";

/**
 * Prompt 53 — "Importar datas de outro site": o dono cola o link .ics do Airbnb/Booking (até 3). As datas ocupadas de lá
 * viram bloqueios aqui (lidas a cada 3 h ou em "Atualizar agora"). Só datas: nunca preço nem anúncio. A tela mostra só o
 * domínio do link.
 */
export function ImportarCalendario({ propertyId, onMudou }: { propertyId: string; onMudou: () => void }) {
  const [lista, setLista] = useState<ImportacaoNaTela[] | null>(null);
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    listarImportacoes(propertyId)
      .then((l) => vivo && setLista(l))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, [propertyId, versao]);

  const rodar = (f: () => Promise<{ ok: boolean; erro?: string; mensagem?: string }>, limpar = false) =>
    iniciar(async () => {
      const r: { ok: boolean; erro?: string; mensagem?: string } = await f().catch(() => ({ ok: false, erro: "Sem conexão. Tente de novo." }));
      setMsg({ ok: r.ok, texto: (r.ok ? r.mensagem : r.erro) ?? "" });
      if (r.ok && limpar) setLink("");
      setVersao((v) => v + 1);
      onMudou();
    });

  const cheio = (lista?.length ?? 0) >= LIMITE_LINKS_POR_IMOVEL;
  return (
    <section className="mt-6 rounded-xl border border-sage-200 p-4" data-testid="importar-calendario">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarSync className="h-4 w-4 text-sage" aria-hidden /> Importar datas de outro site
      </h3>
      <p className="mt-1 text-xs text-muted">
        Cole o link de exportação do calendário (.ics) do Airbnb ou do Booking. As datas ocupadas lá ficam bloqueadas aqui e são
        lidas de novo a cada 3 horas. Só as datas: preço e anúncio não mudam. Até {LIMITE_LINKS_POR_IMOVEL} links.
      </p>

      {lista && lista.length > 0 && (
        <ul className="mt-3 divide-y divide-sage-100" data-testid="importacoes-lista">
          {lista.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-testid="importacao-item">
              <span className="min-w-0">
                <span className="block font-medium text-ink">
                  {ROTULO_ORIGEM[i.origem]} · {i.dominio}
                </span>
                <span className="block text-xs text-muted">
                  {i.ultimaLeitura ? `Última leitura: ${dataHoraBRT(i.ultimaLeitura)}` : "Ainda não lido"}
                </span>
                {i.erro && (
                  <span className="block text-xs text-red-700" data-testid="importacao-erro">
                    {i.erro}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={() => rodar(() => atualizarImportacao(i.id))} data-testid="importacao-atualizar">
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Atualizar agora
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={pendente} onClick={() => rodar(() => removerImportacao(i.id))} data-testid="importacao-remover">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remover
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!cheio && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim()) rodar(() => adicionarImportacao(propertyId, link), true);
          }}
        >
          <label className="sr-only" htmlFor="link-ics">
            Link do calendário (.ics)
          </label>
          <input
            id="link-ics"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.airbnb.com.br/calendar/ical/…"
            className="min-w-0 flex-1 rounded-lg border border-sage-200 px-3 py-2 text-base"
            data-testid="importacao-link"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={pendente || !link.trim()} data-testid="importacao-adicionar">
            {pendente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Importar
          </Button>
        </form>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "mt-2 text-sm text-ink" : "mt-2 text-sm text-red-700"} data-testid="importacao-msg">
          {msg.texto}
        </p>
      )}
    </section>
  );
}
