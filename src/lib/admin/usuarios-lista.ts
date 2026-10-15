/** Filtros da lista /admin/usuarios (ordem 61454243): o total da lista = o número do cartão. */
export type FiltrosUsuarios = { papel: "owner" | "tenant" | null; fundador: boolean; desde: string | null };

const PAPEIS = { proprietario: "owner", inquilino: "tenant" } as const;

function dataValida(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function filtrosUsuarios(sp: Record<string, string | undefined>): FiltrosUsuarios {
  const papel = sp.papel && sp.papel in PAPEIS ? PAPEIS[sp.papel as keyof typeof PAPEIS] : null;
  const desde = sp.desde && dataValida(sp.desde) ? sp.desde : null;
  return { papel, fundador: sp.fundador === "1", desde };
}

export function hrefUsuarios(f: { papel?: "proprietario" | "inquilino"; fundador?: boolean; desde?: string }): string {
  const q = new URLSearchParams();
  if (f.papel) q.set("papel", f.papel);
  if (f.fundador) q.set("fundador", "1");
  if (f.desde) q.set("desde", f.desde);
  const s = q.toString();
  return s ? `/admin/usuarios?${s}` : "/admin/usuarios";
}

export function rotuloFiltroUsuarios(f: FiltrosUsuarios): string {
  const p = [f.papel === "owner" ? "Proprietários" : f.papel === "tenant" ? "Inquilinos" : null, f.fundador ? "Fundadores" : null]
    .filter(Boolean)
    .join(" · ");
  const base = p || "Todos os usuários";
  return f.desde ? `${base} · desde ${f.desde.split("-").reverse().join("/")}` : base;
}
