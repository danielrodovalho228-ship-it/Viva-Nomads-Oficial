import Link from "next/link";
import { FAQ } from "@/lib/atendimento/faq";

/** A primeira frase da resposta da Central de Ajuda (o texto curto da resposta rápida). */
export function primeiraFrase(texto: string): string {
  const t = texto.trim();
  const m = t.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : t).trim();
}

/**
 * Ajuda em 3 níveis (Prompt 43, item 9) — nível 1: a resposta rápida na própria tela (texto curto + link). O nível 2 é
 * a Central de Ajuda (/ajuda) e o 3, o "Fale com a Viva" (chat atual). O texto vem da MESMA FAQ da Central.
 */
export function RespostaRapida({ faqId, className }: { faqId: string; className?: string }) {
  const p = FAQ.find((f) => f.id === faqId);
  if (!p) return null;
  return (
    <aside className={className ?? "mt-6 rounded-xl border border-line bg-white p-4"} data-testid="resposta-rapida" data-faq={faqId}>
      <p className="text-sm font-semibold text-ink">{p.pergunta}</p>
      <p className="mt-1 text-sm text-muted">{primeiraFrase(p.resposta)}</p>
      <Link href="/ajuda" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-forest">
        Mais na Central de Ajuda
      </Link>
    </aside>
  );
}
