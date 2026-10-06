/*
  FONTE ÚNICA: quais telas existem no APP. Tudo o que não está aqui é "só site".

  Daqui saem, sem cópia à mão:
    • o arquivo da Apple (/.well-known/apple-app-site-association) — iPhone;
    • o filtro de links do Android (AndroidManifest; um teste confere que bate);
    • o aviso "Esta parte fica no site" dentro do app;
    • a faixa "Abrir no app" no site do celular.

  Regra de um link só: o e-mail manda https://vivanomads.com.br/<caminho exato>.
  Se o caminho é do app e o app está instalado, o sistema abre o app na tela
  certa; senão, abre o site. Confirmar e-mail e trocar senha (AUTH) SEMPRE
  ficam no navegador: o código de segurança desses links é do aparelho/navegador
  em que a pessoa se cadastrou.

  Puro (sem imports): roda no proxy, no cliente e no node --test.
*/

export type Destino = "app" | "site" | "auth";

interface Regra {
  caminho: string;
  /** true = o caminho e tudo abaixo dele; false = só o caminho exato. */
  abaixo: boolean;
}

const exato = (caminho: string): Regra => ({ caminho, abaixo: false });
const ramo = (caminho: string): Regra => ({ caminho, abaixo: true });

/** Telas do app (primordiais). Proposta a partir do que o app mostra hoje (abas + painel). */
export const ROTAS_APP: Regra[] = [
  exato("/auth"), // entrar / criar conta
  ramo("/app"), // boas-vindas do app
  ramo("/buscar"),
  ramo("/imoveis"), // anúncio público
  ramo("/pedidos"), // mural e "Publicar pedido"
  ramo("/ajuda"), // Central de Ajuda e chamados
  exato("/dashboard"), // painel
  ramo("/dashboard/mensagens"),
  ramo("/dashboard/favoritos"),
  ramo("/dashboard/candidaturas"),
  ramo("/dashboard/leads"), // interessados (proprietário)
  ramo("/dashboard/pedidos"),
  ramo("/dashboard/pedidos-cidade"),
  ramo("/dashboard/contratos"),
  ramo("/dashboard/locacoes"),
  ramo("/dashboard/solicitacoes"), // manutenção
  ramo("/dashboard/buscas"), // buscas salvas
  exato("/dashboard/imoveis"), // lista "Meus imóveis" (criar/editar fica no site)
  ramo("/dashboard/conta"), // perfil
  exato("/excluir-conta"), // as lojas exigem excluir a conta DENTRO do app
  exato("/privacidade"),
  exato("/termos"),
  exato("/seguranca"),
];

/** Autenticação: SEMPRE no navegador (nunca o app assume estes links). */
export const ROTAS_AUTH: Regra[] = [ramo("/auth/confirm"), ramo("/auth/callback"), ramo("/auth/reset"), ramo("/excluir-conta/confirmar"), ramo("/api")];

function casa(r: Regra, caminho: string): boolean {
  return caminho === r.caminho || (r.abaixo && caminho.startsWith(r.caminho + "/"));
}

/** Só o pathname, sem query/hash, sem barra final (exceto a raiz). */
export function soCaminho(url: string): string {
  const p = url.split(/[?#]/)[0] || "/";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

/** Para onde vai este caminho: app, site ou navegador obrigatório (auth). */
export function destinoDaRota(url: string): Destino {
  const p = soCaminho(url);
  if (ROTAS_AUTH.some((r) => casa(r, p))) return "auth";
  if (ROTAS_APP.some((r) => casa(r, p))) return "app";
  return "site";
}

/** Atalhos do esquema vivanomads:// (ex.: vivanomads://perfil no "Voltar para o app"). */
const ATALHOS: Record<string, string> = {
  perfil: "/dashboard/conta",
  conta: "/dashboard/conta",
  mensagens: "/dashboard/mensagens",
  contratos: "/dashboard/contratos",
  pedidos: "/dashboard/pedidos",
  candidaturas: "/dashboard/candidaturas",
  ajuda: "/ajuda",
  painel: "/dashboard",
  inicio: "/app/boas-vindas",
};

export const DOMINIO_APP = "vivanomads.com.br";

/**
 * Link recebido pelo app → caminho interno para abrir na WebView (ou null).
 * Aceita https://vivanomads.com.br/..., https://www.vivanomads.com.br/... e
 * vivanomads://caminho. Qualquer outro domínio/esquema é recusado.
 */
export function caminhoDoLink(link: string): string | null {
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    return null;
  }
  let caminho: string;
  if (u.protocol === "vivanomads:") {
    // vivanomads://perfil → host "perfil"; vivanomads:///dashboard/conta → pathname.
    const bruto = `${u.host ? `/${u.host}` : ""}${u.pathname}`.replace(/\/{2,}/g, "/") || "/";
    const chave = bruto.replace(/^\//, "").split("/")[0];
    caminho = bruto === `/${chave}` && ATALHOS[chave] ? ATALHOS[chave] : bruto;
  } else if (u.protocol === "https:" && (u.hostname === DOMINIO_APP || u.hostname === `www.${DOMINIO_APP}`)) {
    caminho = u.pathname;
  } else {
    return null;
  }
  const completo = `${caminho}${u.search}${u.hash}`;
  // Mesmo critério do redirecionamento seguro: só caminho interno.
  if (!completo.startsWith("/") || completo.startsWith("//") || /[\u0000-\u001F\u007F\\]/.test(completo)) return null;
  return completo;
}

// ── Arquivos de verificação de domínio ──────────────────────────────────────

/** apple-app-site-association: inclui só as telas do app e exclui auth. */
export function aasa(appIds: string[]): unknown {
  const exclusoes = ROTAS_AUTH.flatMap((r) => [{ "/": r.caminho, exclude: true }, { "/": `${r.caminho}/*`, exclude: true }]);
  const inclusoes = ROTAS_APP.flatMap((r) => (r.abaixo ? [{ "/": r.caminho }, { "/": `${r.caminho}/*` }] : [{ "/": r.caminho }]));
  return {
    applinks: { details: [{ appIDs: appIds, components: [...exclusoes, ...inclusoes] }] },
    webcredentials: { apps: appIds },
  };
}

/** assetlinks.json (Android App Links). */
export function assetlinks(pacote: string, fingerprints: string[]): unknown {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: pacote, sha256_cert_fingerprints: fingerprints },
    },
  ];
}

/** Entradas <data> do intent-filter do Android, na mesma ordem da lista. */
export function filtrosAndroid(): { atributo: "path" | "pathPrefix"; valor: string }[] {
  return ROTAS_APP.flatMap((r) =>
    r.abaixo
      ? [
          { atributo: "path" as const, valor: r.caminho },
          { atributo: "pathPrefix" as const, valor: `${r.caminho}/` },
        ]
      : [{ atributo: "path" as const, valor: r.caminho }]
  );
}
