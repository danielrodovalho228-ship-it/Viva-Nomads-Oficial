/** Filtros da lista /admin/usuarios (ordem 61454243): o total da lista = o número do cartão. */
export type FiltrosUsuarios = {
  papel: "owner" | "tenant" | "admin" | null;
  fundador: boolean;
  desde: string | null;
  /** Até (inclusivo) — com `desde`, o mesmo período da home (cartões de cadastros novos). */
  ate: string | null;
  cadastro: "completo" | "incompleto" | null;
  q: string | null;
  /** Donos com anúncio ATIVO e real (o cartão "Donos com anúncio" da home). */
  comAnuncio: boolean;
  /** "Mostrar contas de teste": padrão não — contas is_teste ficam fora dos números (Prompt 29, item 4b). */
  teste: boolean;
};

/** Cadastro completo: a MESMA regra da Conta (nome + e-mail confirmado + documento + foto). */
export { cadastroCompleto, faltaNoCadastro, itensCadastro, type DadosCadastro } from "../perfil/cadastro-completo.ts";

/** Termo da busca por nome: sem curingas (% _ \) nem caracteres de filtro (, ( ) "), até 60 letras. */
export function termoBusca(v: string | undefined | null): string | null {
  const t = (v ?? "").replace(/[%_\\,()"]/g, "").trim().slice(0, 60).trim();
  return t || null;
}

const PAPEIS = { proprietario: "owner", inquilino: "tenant", admin: "admin" } as const;

function dataValida(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function filtrosUsuarios(sp: Record<string, string | undefined>): FiltrosUsuarios {
  const papel = sp.papel && sp.papel in PAPEIS ? PAPEIS[sp.papel as keyof typeof PAPEIS] : null;
  const de = sp.desde ?? sp.de;
  const desde = de && dataValida(de) ? de : null;
  const ate = sp.ate && dataValida(sp.ate) ? sp.ate : null;
  const cadastro = sp.cadastro === "completo" || sp.cadastro === "incompleto" ? sp.cadastro : null;
  return { papel, fundador: sp.fundador === "1", desde, ate, cadastro, q: termoBusca(sp.q), comAnuncio: sp.com_anuncio === "1", teste: sp.teste === "sim" };
}

export function hrefUsuarios(f: {
  papel?: "proprietario" | "inquilino" | "admin";
  fundador?: boolean;
  desde?: string;
  ate?: string;
  cadastro?: "completo" | "incompleto";
  q?: string;
  comAnuncio?: boolean;
  teste?: boolean;
}): string {
  const q = new URLSearchParams();
  if (f.papel) q.set("papel", f.papel);
  if (f.fundador) q.set("fundador", "1");
  if (f.comAnuncio) q.set("com_anuncio", "1");
  if (f.teste) q.set("teste", "sim");
  if (f.desde) q.set("desde", f.desde);
  if (f.ate) q.set("ate", f.ate);
  if (f.cadastro) q.set("cadastro", f.cadastro);
  if (f.q) q.set("q", f.q);
  const s = q.toString();
  return s ? `/admin/usuarios?${s}` : "/admin/usuarios";
}

export function rotuloFiltroUsuarios(f: FiltrosUsuarios): string {
  const p = [
    f.papel === "owner" ? "Proprietários" : f.papel === "tenant" ? "Inquilinos" : f.papel === "admin" ? "Admins" : null,
    f.fundador ? "Fundadores" : null,
    f.comAnuncio ? "Donos com anúncio ativo" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const extra = [
    f.desde ? `desde ${f.desde.split("-").reverse().join("/")}` : null,
    f.ate ? `até ${f.ate.split("-").reverse().join("/")}` : null,
    f.teste ? "com contas de teste" : null,
    f.cadastro ? `cadastro ${f.cadastro}` : null,
    f.q ? `busca “${f.q}”` : null,
  ].filter(Boolean);
  return [p || "Todos os usuários", ...extra].join(" · ");
}
