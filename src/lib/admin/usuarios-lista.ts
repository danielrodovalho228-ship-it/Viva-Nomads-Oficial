/** Filtros da lista /admin/usuarios (ordem 61454243): o total da lista = o número do cartão. */
export type FiltrosUsuarios = {
  papel: "owner" | "tenant" | null;
  fundador: boolean;
  desde: string | null;
  cadastro: "completo" | "incompleto" | null;
  q: string | null;
};

/** Cadastro completo = nome e telefone preenchidos. O telefone só entra na conta; a lista não o mostra. */
export function cadastroCompleto(p: { full_name: string | null; phone: string | null }): boolean {
  return !!p.full_name?.trim() && !!p.phone?.trim();
}

/** Termo da busca por nome: sem curingas (% _ \) nem caracteres de filtro (, ( ) "), até 60 letras. */
export function termoBusca(v: string | undefined | null): string | null {
  const t = (v ?? "").replace(/[%_\\,()"]/g, "").trim().slice(0, 60).trim();
  return t || null;
}

const PAPEIS = { proprietario: "owner", inquilino: "tenant" } as const;

function dataValida(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function filtrosUsuarios(sp: Record<string, string | undefined>): FiltrosUsuarios {
  const papel = sp.papel && sp.papel in PAPEIS ? PAPEIS[sp.papel as keyof typeof PAPEIS] : null;
  const desde = sp.desde && dataValida(sp.desde) ? sp.desde : null;
  const cadastro = sp.cadastro === "completo" || sp.cadastro === "incompleto" ? sp.cadastro : null;
  return { papel, fundador: sp.fundador === "1", desde, cadastro, q: termoBusca(sp.q) };
}

export function hrefUsuarios(f: {
  papel?: "proprietario" | "inquilino";
  fundador?: boolean;
  desde?: string;
  cadastro?: "completo" | "incompleto";
  q?: string;
}): string {
  const q = new URLSearchParams();
  if (f.papel) q.set("papel", f.papel);
  if (f.fundador) q.set("fundador", "1");
  if (f.desde) q.set("desde", f.desde);
  if (f.cadastro) q.set("cadastro", f.cadastro);
  if (f.q) q.set("q", f.q);
  const s = q.toString();
  return s ? `/admin/usuarios?${s}` : "/admin/usuarios";
}

export function rotuloFiltroUsuarios(f: FiltrosUsuarios): string {
  const p = [f.papel === "owner" ? "Proprietários" : f.papel === "tenant" ? "Inquilinos" : null, f.fundador ? "Fundadores" : null]
    .filter(Boolean)
    .join(" · ");
  const extra = [
    f.desde ? `desde ${f.desde.split("-").reverse().join("/")}` : null,
    f.cadastro ? `cadastro ${f.cadastro}` : null,
    f.q ? `busca “${f.q}”` : null,
  ].filter(Boolean);
  return [p || "Todos os usuários", ...extra].join(" · ");
}
