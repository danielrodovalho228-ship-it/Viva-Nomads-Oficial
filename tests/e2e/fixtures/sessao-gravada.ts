/**
 * Cookie em que o proxy guarda a última navegação da admin em /admin (src/lib/admin/sessao-ociosa.ts).
 * O nome é repetido aqui porque o node --test não resolve import sem extensão; o unitário em
 * tests/laboratorio/sessao-gravada.test.ts confere que ele bate com o do produto.
 */
export const COOKIE_ADMIN_ATIVO = "vn_admin_ativo";

type Estado = { cookies: { name: string }[]; origins: unknown[] };

/**
 * Tira da sessão gravada no global-setup o cookie de atividade da admin.
 * Gravado, ele fica parado na hora do setup: toda aba nova da admin parece ociosa depois de 30 min, o proxy
 * encerra a sessão (que é a MESMA em todas as abas) e o resto da suíte de admin cai no login (lab de 20 e
 * 21/10, execuções "metade"). Sem ele, cada aba começa como sessão nova e o proxy grava a hora dela.
 */
export function semCookieDeAtividade<T extends Estado>(estado: T): T {
  return { ...estado, cookies: estado.cookies.filter((c) => c.name !== COOKIE_ADMIN_ATIVO) };
}
