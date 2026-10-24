"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { meusPapeis } from "@/lib/data/papeis-actions";
import { getMeuPerfilPublico } from "@/lib/data/perfil-actions";
import { clearMyAvatar } from "@/lib/data/avatar-actions";
import { ROTULO_PAPEL, type PapelDaConta } from "@/lib/onboarding/ativacao";
import { useDisplayUser } from "@/lib/demo/demo-mode";
import { useProperties } from "@/lib/use-properties";
import { EnviarFoto, PERFIL_ATUALIZADO, avisarFotoAtualizada, useMinhaFoto } from "@/components/account/foto-perfil";

/** O H1 da Conta: o nome da pessoa; sem nome, "Sua conta". */
export const tituloDaConta = (nome: string | null | undefined) => (nome ?? "").trim() || "Sua conta";
/** Os papéis como texto: "Morador · Proprietário". */
export const linhaDePapeis = (papeis: Pick<PapelDaConta, "papel" | "ativo">[]) =>
  papeis
    .filter((p) => p.ativo)
    .map((p) => ROTULO_PAPEL[p.papel])
    .join(" · ");

/**
 * CONTA-A, item 1 — o TOPO ÚNICO da Conta (site e app, mesmo conteúdo): o avatar grande com o botão de câmera por
 * cima (sem foto: "Adicionar foto"; com foto: o lápis "Trocar foto" e "Remover"), o nome (H1), a cidade, os papéis
 * em texto e, à direita, "Ver meu perfil público". Substitui o título "Conta", o bloco "Conta" e os dois blocos de foto.
 */
export function TopoConta() {
  const user = useDisplayUser();
  const foto = useMinhaFoto();
  const { properties } = useProperties("/api/properties/mine");
  const [nome, setNome] = useState<string | null>(null);
  const [cidade, setCidade] = useState("");
  const [papeis, setPapeis] = useState<PapelDaConta[]>([]);
  const [removendo, setRemovendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const ler = () => {
      getMeuPerfilPublico()
        .then((p) => {
          if (!vivo || !p) return;
          setNome(p.nome);
          setCidade(p.cidade);
        })
        .catch(() => {});
      meusPapeis()
        .then((p) => vivo && p && setPapeis(p))
        .catch(() => {});
    };
    ler();
    window.addEventListener(PERFIL_ATUALIZADO, ler);
    return () => {
      vivo = false;
      window.removeEventListener(PERFIL_ATUALIZADO, ler);
    };
  }, []);

  const nomeAtual = nome ?? (user?.name ?? "");
  const temFoto = !!foto.url;
  // Proprietário com anúncio tem a página pública; quem ainda não tem vê o espelho do próprio perfil.
  const linkPerfil = user && properties.length > 0 ? `/proprietario/${user.id}` : "#espelho";

  async function remover() {
    setRemovendo(true);
    setMsg(null);
    try {
      await clearMyAvatar();
      avisarFotoAtualizada(null);
      setMsg("Foto removida");
    } catch {
      setMsg("Não foi possível remover agora. Tente de novo.");
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-testid="topo-conta" aria-labelledby="conta-nome">
      <div className="flex min-w-0 items-center gap-4">
        <div className="relative shrink-0">
          <Avatar name={nomeAtual} size={96} photoUrl={foto.url ?? undefined} />
          <EnviarFoto temFoto={temFoto} variante="camera" className="absolute -bottom-1 -right-1" testId="topo-foto" />
        </div>
        <div className="min-w-0">
          <h1 id="conta-nome" className="break-words font-title text-[28px] font-semibold leading-tight text-ink" data-testid="conta-h1">
            {tituloDaConta(nomeAtual)}
          </h1>
          {cidade && (
            <p className="text-sm text-muted" data-testid="topo-cidade">
              {cidade}
            </p>
          )}
          {papeis.length > 0 && (
            <p className="text-sm text-ink" data-testid="topo-papeis">
              {linhaDePapeis(papeis)}
            </p>
          )}
          {temFoto && (
            <button
              type="button"
              onClick={remover}
              disabled={removendo}
              className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-red-700 underline underline-offset-2 disabled:opacity-60"
              data-testid="topo-foto-remover"
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Remover
            </button>
          )}
          {msg && (
            <p role="status" className="text-sm text-forest" data-testid="topo-foto-remover-msg">
              {msg}
            </p>
          )}
        </div>
      </div>
      <Link href={linkPerfil} className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-forest underline underline-offset-2" data-testid="ver-meu-perfil-publico">
        <Eye className="h-4 w-4" aria-hidden /> Ver meu perfil público
      </Link>
    </section>
  );
}
