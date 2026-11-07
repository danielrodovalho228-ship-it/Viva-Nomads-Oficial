import Link from "next/link";
import { ArrowLeft, Home, Lock } from "lucide-react";
import { AvaliacaoForm } from "@/components/avaliacao-form";
import { ButtonLink } from "@/components/ui/button";
import type { EstadiaParaAvaliar } from "@/lib/data/avaliacoes-painel";
import { periodoPorExtenso, TEXTOS_AVALIAR } from "@/lib/avaliacoes-pagina";
import { TEXTO_SIGILO } from "@/lib/conta/painel-avaliacoes";

const SIGILO_PAGINA = "Sua avaliação é secreta por enquanto: ela só aparece quando os dois avaliarem, ou em 14 dias.";

/**
 * E679 (PR 2) — "Avalie sua estadia" (morador) e "Avalie o morador" (proprietário), iguais aos mockups avaliacoes-avaliar-*:
 * cartão com a estadia, faixa de sigilo e o formulário já aberto. Só a parte visual; a página busca a estadia.
 */
export function PaginaAvaliar({ e, demo = false }: { e: EstadiaParaAvaliar; demo?: boolean }) {
  const par = e.papel === "morador" ? "morador_avalia_dono" : "dono_avalia_morador";
  const textos = TEXTOS_AVALIAR[par];
  const periodo = periodoPorExtenso(e.inicio, e.fim);
  const local = e.cidade ? `${e.titulo}, ${e.cidade}` : e.titulo;
  const nome = e.contraparte ?? (e.papel === "morador" ? "Proprietário" : "Morador");
  return (
    <div className="mx-auto w-full max-w-3xl" data-testid="pagina-avaliar" data-par={par}>
      <Link href="/dashboard/avaliacoes" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest hover:underline" data-testid="avaliar-voltar">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
      </Link>
      <h1 className="mt-2 font-title text-2xl font-semibold text-forest sm:text-[28px]">{textos.pagina}</h1>
      <section className="mt-4 rounded-xl border border-line bg-white p-4 sm:p-6">
        <div className="flex items-start gap-4">
          {e.papel === "dono" ? (
            <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-sage-100 text-xl font-semibold text-forest sm:h-20 sm:w-20">
              {nome.charAt(0)}
            </span>
          ) : (
            <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-forest sm:h-20 sm:w-20">
              <Home className="h-8 w-8" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold text-ink" data-testid="avaliar-titulo">
              {e.papel === "dono" ? `${nome} · Morador` : local}
            </p>
            <p className="mt-1 text-sm text-muted" data-testid="avaliar-estadia">
              {e.papel === "dono" ? `${local}${periodo ? ` · ${periodo}` : ""}` : `${periodo}${periodo ? " · " : ""}Proprietário: ${nome}`}
            </p>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-3 rounded-xl bg-sage-100 px-4 py-3 text-sm text-ink" data-testid="avaliar-sigilo">
          <Lock className="h-5 w-5 shrink-0 text-forest" aria-hidden /> {SIGILO_PAGINA}
        </p>
        {e.jaAvaliei ? (
          <div className="mt-4" data-testid="avaliar-ja-avaliou">
            <p className="text-base text-ink">Você já avaliou esta estadia. A avaliação não pode ser editada depois de enviada.</p>
            <p className="mt-1 text-sm text-muted">{TEXTO_SIGILO}</p>
            <div className="mt-3">
              <ButtonLink href="/dashboard/avaliacoes?aba=feitas" variant="secondary" size="sm">
                Ver minhas avaliações feitas
              </ButtonLink>
            </div>
          </div>
        ) : (
          <AvaliacaoForm
            contratoId={e.contratoId}
            alvoId={e.alvoId}
            papelAutor={e.papel === "morador" ? "inquilino" : "proprietario"}
            abrirLabel={e.papel === "morador" ? "Avaliar o proprietário" : "Avaliar o morador"}
            titulo=""
            placeholder={textos.placeholder}
            demo={demo}
            encerradoEm={e.encerradoEm}
            fechada={!e.podeAvaliar && !demo}
            abertoInicial
          />
        )}
      </section>
    </div>
  );
}
