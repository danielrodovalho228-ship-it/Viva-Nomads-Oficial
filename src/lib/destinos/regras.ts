/*
  Destinos (prompt 37) — validação PURA do cadastro do admin. O ponto vem da sugestão do geocoding conferida no mapa
  (ou digitado pelo admin): nenhuma coordenada nasce no código.
*/
export const TIPOS_DESTINO = [
  { valor: "hospital", rotulo: "Hospital" },
  { valor: "universidade", rotulo: "Universidade" },
  { valor: "empresa", rotulo: "Empresa" },
  { valor: "outro", rotulo: "Outro" },
] as const;
export type TipoDestino = (typeof TIPOS_DESTINO)[number]["valor"];

export function slugDoDestino(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface DestinoValidado {
  slug: string;
  nome: string;
  artigo: "o" | "a" | "";
  tipo: TipoDestino;
  cidade: string;
  uf: string;
  lat: number | null;
  lng: number | null;
}

export function validarDestino(e: Record<string, unknown>): { ok: true; destino: DestinoValidado } | { ok: false; erro: string } {
  const nome = String(e.nome ?? "").trim().replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 80) return { ok: false, erro: "Informe o nome (2 a 80 caracteres)." };
  const slug = slugDoDestino(String(e.slug ?? "").trim() || nome);
  if (slug.length < 2) return { ok: false, erro: "O endereço da página ficou vazio: ajuste o nome." };
  const tipo = String(e.tipo ?? "") as TipoDestino;
  if (!TIPOS_DESTINO.some((t) => t.valor === tipo)) return { ok: false, erro: "Escolha o tipo." };
  const artigo = String(e.artigo ?? "o");
  if (!["o", "a", ""].includes(artigo)) return { ok: false, erro: "Escolha como se fala: o, a ou sem artigo." };
  const cidade = String(e.cidade ?? "").trim();
  const uf = String(e.uf ?? "").trim().toUpperCase();
  if (cidade.length < 2 || !/^[A-Z]{2}$/.test(uf)) return { ok: false, erro: "Informe a cidade e a UF." };
  const latTxt = String(e.lat ?? "").trim().replace(",", ".");
  const lngTxt = String(e.lng ?? "").trim().replace(",", ".");
  let lat: number | null = null;
  let lng: number | null = null;
  if (latTxt || lngTxt) {
    lat = Number(latTxt);
    lng = Number(lngTxt);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -34 || lat > 6 || lng < -75 || lng > -28) {
      return { ok: false, erro: "O ponto está fora do Brasil. Escolha pela busca e confira no mapa." };
    }
  }
  return { ok: true, destino: { slug, nome, artigo: artigo as "o" | "a" | "", tipo, cidade, uf, lat, lng } };
}

/**
 * E32: o ponto que vale ao salvar. Na EDIÇÃO, coordenadas em branco NÃO apagam o ponto gravado (antes, editar só o
 * nome limpava o ponto e desativava o destino em silêncio). Apagar o ponto é ação explícita ("Remover o ponto",
 * confirmada), e só então o destino sai dos ativos.
 */
export function pontoAoSalvar(e: {
  existente: { lat: number | null; lng: number | null } | null;
  enviado: { lat: number | null; lng: number | null };
  limparPonto: boolean;
}): { lat: number | null; lng: number | null; desativar: boolean } {
  if (e.enviado.lat != null && e.enviado.lng != null) return { lat: e.enviado.lat, lng: e.enviado.lng, desativar: false };
  if (e.existente && !e.limparPonto && e.existente.lat != null && e.existente.lng != null) {
    return { lat: e.existente.lat, lng: e.existente.lng, desativar: false };
  }
  return { lat: null, lng: null, desativar: true };
}

/** "Destinos mais buscados": soma dos últimos 30 dias por destino, do maior para o menor. Só contagem. */
export function maisBuscados(linhas: { destino_id: string; n: number }[], nomes: Map<string, string>): { nome: string; total: number }[] {
  const soma = new Map<string, number>();
  for (const l of linhas) soma.set(l.destino_id, (soma.get(l.destino_id) ?? 0) + l.n);
  return [...soma.entries()]
    .map(([id, total]) => ({ nome: nomes.get(id) ?? "Destino removido", total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}
