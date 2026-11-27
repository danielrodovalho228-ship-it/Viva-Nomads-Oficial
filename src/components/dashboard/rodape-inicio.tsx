import Link from "next/link";

const LINKS = [
  { href: "/ajuda", rotulo: "Central de ajuda" },
  { href: "/termos", rotulo: "Termos de uso" },
  { href: "/privacidade", rotulo: "Privacidade" },
] as const;

/**
 * E503: o Início do painel termina com um rodapé curto — ajuda e os textos legais —, em vez de acabar num vão em branco
 * sem nada. Discreto (texto, sem botão), com a mesma largura do conteúdo.
 */
export function RodapeInicio() {
  return (
    <footer className="mt-8 border-t border-line pt-4 text-sm text-muted" data-testid="inicio-rodape">
      <nav aria-label="Ajuda e termos" className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
            {l.rotulo}
          </Link>
        ))}
        <span className="ml-auto inline-flex min-h-11 items-center">© Viva Nomads</span>
      </nav>
    </footer>
  );
}
