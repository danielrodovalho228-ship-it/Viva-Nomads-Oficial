"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getPrivacidade, setPrivacidade } from "@/lib/data/privacidade-actions";
import { CHAVES_PRIVACIDADE, RODAPE_PRIVACIDADE, type ChavePrivacidade, type Privacidade } from "@/lib/conta/tela-privacidade";

/**
 * A5 — Conta › Privacidade (mockup perfil-05): o cartão das três chaves (gravam no toque), "Baixar meus dados",
 * "Excluir minha conta" (abre "Sair da Viva") e o rodapé. Embaixo, a lista de confiança já aprovada.
 */
export function TelaPrivacidade() {
  const [p, setP] = useState<Privacidade | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    getPrivacidade()
      .then((v) => vivo && setP(v))
      .catch(() => vivo && setP({ mostrar_perfil: true, aparecer_busca: true, dados_uso: false }));
    return () => {
      vivo = false;
    };
  }, []);

  async function alternar(chave: ChavePrivacidade, v: boolean) {
    if (!p) return;
    const antes = p;
    const nova = { ...p, [chave]: v };
    setP(nova);
    setErro(null);
    const r = await setPrivacidade(nova).catch(() => ({ ok: false, error: "Sem conexão. Tente de novo." }));
    if (!r.ok) {
      setP(antes);
      setErro(r.error ?? "Não foi possível salvar.");
    }
  }

  return (
    <div className="grid gap-6" data-testid="tela-privacidade">
      {/* E170: as três permissões aparecem na hora; só a chave de cada uma espera a leitura (antes, o cartão inteiro
          ficava em branco até a resposta do servidor). */}
      <section className="rounded-xl bg-white px-4 sm:px-6" aria-label="Permissões" aria-busy={!p}>
        <ul className="divide-y divide-line">
          {CHAVES_PRIVACIDADE.map((c) => (
            <li key={c.chave} className="flex items-center justify-between gap-4 py-4">
              <span className="min-w-0">
                <span className="block text-lg font-semibold text-ink">{c.titulo}</span>
                <span className="block text-sm text-ink">{c.texto}</span>
              </span>
              {p ? (
                <Switch checked={p[c.chave]} onChange={(v) => void alternar(c.chave, v)} label={c.titulo} testId={`privacidade-${c.chave}`} />
              ) : (
                <span className="block h-6 w-11 shrink-0 rounded-full bg-surface-2" aria-hidden data-testid={`privacidade-${c.chave}-carregando`} />
              )}
            </li>
          ))}
        </ul>
      </section>
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <a href="/api/conta/meus-dados" download className={buttonClasses({ variant: "secondary", size: "lg" })} data-testid="privacidade-baixar">
          <Download className="h-4 w-4" aria-hidden /> Baixar meus dados
        </a>
        <Link href="/dashboard/conta/excluir" className="inline-flex min-h-11 items-center text-base font-semibold text-red-700 underline underline-offset-4" data-testid="privacidade-excluir">
          Excluir minha conta
        </Link>
      </div>
      {/* E66: a segurança (senha, duas etapas e verificações) fica na rota própria; daqui, só o caminho até ela. */}
      <Link href="/dashboard/conta/seguranca" className="inline-flex min-h-11 items-center text-base font-semibold text-ink underline underline-offset-4 hover:text-forest" data-testid="privacidade-seguranca">
        Segurança e verificações
      </Link>
      <p className="text-sm text-ink" data-testid="privacidade-rodape">
        {RODAPE_PRIVACIDADE}
      </p>
    </div>
  );
}
