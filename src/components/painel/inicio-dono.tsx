import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, CheckCircle2, ChevronRight, Circle, ReceiptText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Decisao } from "@/lib/painel/decisoes";
import { ATALHOS_INICIO_DONO, PECA_NA_VIVA, lugarDoChecklistDono, type BlocoPrincipalDono } from "@/lib/painel/inicio-dono";
import type { ChecklistAtivacao } from "@/lib/onboarding/ativacao";
import { ChecklistAtivacaoBloco } from "@/components/onboarding/checklist-ativacao";
import type { CartaoHoje } from "@/lib/painel/hoje-dono";

const ICONE = { agenda: CalendarDays, simulador: ChartNoAxesColumnIncreasing, recibos: ReceiptText } as const;

/**
 * PROP-6 — Início do dono (mockup painel-proprietario): faixa de alerta · bloco principal · "Peça na Viva" · três
 * atalhos. As regras estão em lib/painel/inicio-dono.ts. Sem foto do anúncio, o bloco principal fica sem foto.
 */
export function InicioDono({
  alerta,
  bloco,
  hoje = [],
  checklist = null,
}: {
  alerta: Decisao | null;
  bloco: BlocoPrincipalDono;
  hoje?: CartaoHoje[];
  /** E218: checklist de ativação do dono (Prompt 50) enquanto o papel não ativou. */
  checklist?: ChecklistAtivacao | null;
}) {
  const lugar = checklist ? lugarDoChecklistDono(bloco.tipo) : null;
  return (
    <div className="space-y-6" data-testid="inicio-dono">
      <h1 className="sr-only">Início</h1>
      {alerta && (
        <Link
          href={alerta.href}
          className="flex min-h-11 items-center gap-3 rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900"
          data-testid="inicio-dono-alerta"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            {alerta.texto}
            {alerta.prazoTexto ? <span className="font-normal"> — {alerta.prazoTexto}</span> : null}
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
        </Link>
      )}

      {hoje.length > 0 && <HojeNoInicio cartoes={hoje} />}

      <section className="rounded-lg border border-line bg-white p-4 sm:p-6" data-testid="inicio-dono-principal" data-tipo={bloco.tipo} aria-labelledby="inicio-dono-titulo">
        <div className={cn("grid gap-6", bloco.foto && "lg:grid-cols-2 lg:items-center")}>
          {bloco.foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bloco.foto} alt="" className="aspect-[16/10] w-full rounded-lg object-cover" data-testid="inicio-dono-foto" />
          )}
          <div className="min-w-0">
            <h2 id="inicio-dono-titulo" className="font-title text-2xl font-semibold text-ink sm:text-[28px]">
              {bloco.titulo}
            </h2>
            {bloco.pct !== null && (
              <div className="mt-2" data-testid="inicio-dono-pct" data-pct={bloco.pct}>
                <p className="text-sm font-semibold text-forest">{bloco.pct}% pronto</p>
                <div className="mt-2 h-2 w-full rounded-full bg-surface-2" aria-hidden>
                  <div className="h-2 rounded-full bg-forest" style={{ width: `${bloco.pct}%` }} />
                </div>
              </div>
            )}
            <p className="mt-3 text-sm text-ink" data-testid="inicio-dono-linha">
              {bloco.linha}
            </p>
            <ButtonLink href={bloco.botao.href} className="mt-4 w-full" data-testid="inicio-dono-botao">
              {bloco.botao.rotulo} <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            {bloco.passos.length > 0 && (
              <div className="mt-6">
                <p className="text-sm text-muted">Próximos passos</p>
                <ul className="mt-2 space-y-2" data-testid="inicio-dono-passos">
                  {bloco.passos.map((p) => (
                    <li key={p.rotulo}>
                      <Link href={p.href} className="flex min-h-11 items-center gap-3 rounded-lg bg-surface-2 px-3 text-sm text-ink">
                        {p.feito ? <CheckCircle2 className="h-5 w-5 shrink-0 text-forest" aria-hidden /> : <Circle className="h-5 w-5 shrink-0 text-muted" aria-hidden />}
                        <span className="min-w-0 flex-1">
                          <strong className="font-semibold">{p.rotulo}</strong> — {p.feito ? "Concluído" : "Pendente"}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {checklist && lugar === "dentro" && <ChecklistAtivacaoBloco checklist={checklist} embutido />}
          </div>
        </div>
      </section>
      {checklist && lugar === "abaixo" && <ChecklistAtivacaoBloco checklist={checklist} />}

      <section className="flex flex-col gap-4 rounded-lg border border-line bg-white p-4 sm:p-6 lg:flex-row lg:items-center" data-testid="inicio-dono-peca">
        <div className="min-w-0 lg:flex-1">
          <h2 className="font-title text-xl font-semibold text-ink">{PECA_NA_VIVA.titulo}</h2>
          <p className="mt-1 text-sm text-muted">{PECA_NA_VIVA.texto}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={PECA_NA_VIVA.principal.href} variant="outline" data-testid="inicio-dono-pedido">
            {PECA_NA_VIVA.principal.rotulo}
          </ButtonLink>
          <ButtonLink href={PECA_NA_VIVA.secundario.href} variant="outline" data-testid="inicio-dono-servico">
            {PECA_NA_VIVA.secundario.rotulo}
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="inicio-dono-ferramentas">
        <h2 id="inicio-dono-ferramentas" className="mb-3 font-title text-lg font-semibold text-ink lg:sr-only">
          Ferramentas
        </h2>
        <ul className="grid gap-3 lg:grid-cols-3 lg:gap-6" data-testid="inicio-dono-atalhos">
          {ATALHOS_INICIO_DONO.map((a) => {
            const Icone = ICONE[a.id];
            return (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className="flex min-h-11 items-center gap-4 rounded-lg border border-line bg-white p-4 lg:flex-col lg:p-6 lg:text-center"
                  data-testid={`inicio-dono-atalho-${a.id}`}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-sage-100 text-forest lg:h-16 lg:w-16 lg:rounded-full">
                    <Icone className="h-6 w-6 lg:h-8 lg:w-8" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-title text-base font-semibold text-ink lg:text-xl">{a.rotulo}</span>
                    <span className="hidden text-sm text-muted lg:block">{a.texto}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted lg:hidden" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
        {/* MENUS-5, item 3: as Ferramentas saíram do menu da Conta; o resto delas mora aqui. */}
        <Link href="/dashboard/ferramentas" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest underline underline-offset-4" data-testid="inicio-dono-todas-ferramentas">
          Todas as ferramentas <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}

/**
 * E190 (parte 2) — "Hoje": quem entra e quem sai hoje nos imóveis do dono (a mesma informação da Agenda, resumida). Os
 * cartões são os da própria tela (borda, fundo branco, seta), com a foto do morador ou as iniciais; cada um leva à
 * estadia. Sem nada hoje, a seção não existe.
 */
function HojeNoInicio({ cartoes }: { cartoes: CartaoHoje[] }) {
  return (
    <section aria-labelledby="inicio-dono-hoje" data-testid="inicio-dono-hoje">
      <h2 id="inicio-dono-hoje" className="mb-3 font-title text-lg font-semibold text-ink">
        Hoje
      </h2>
      {/* E219: no celular, uma coluna que não passa da tela (minmax(0,1fr)) — sem ela, um nome de imóvel longo esticava
          a coluna automática do grid e o cartão estourava a largura. No computador, as 2 colunas de sempre. */}
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-6">
        {cartoes.map((c) => (
          <li key={c.id} className="min-w-0">
            <Link
              href={c.href}
              className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg border border-line bg-white p-4 sm:gap-4"
              data-testid="inicio-dono-hoje-cartao"
              data-tipo={c.tipo}
            >
              <Avatar name={c.nome} photoUrl={c.fotoUrl ?? undefined} size={48} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-semibold", c.tipo === "entrada" ? "text-forest" : "text-ink")} data-testid="inicio-dono-hoje-rotulo">
                  {c.rotulo}
                  {c.horario ? <span className="font-normal text-muted"> · {c.horario}</span> : null}
                </span>
                <span className="block truncate font-title text-base font-semibold text-ink" data-testid="inicio-dono-hoje-nome">
                  {c.nome}
                </span>
                <span className="block truncate text-sm text-muted" data-testid="inicio-dono-hoje-imovel">
                  {c.imovel}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
