/*
  Chamada mínima à API do GitHub para os scripts do gate (base-atual, main-vermelha).
  Uso: const api = apiDoGitHub(process.env.GITHUB_TOKEN); await api("GET", "/repos/dono/repo/pulls/1");
  Lança erro com o status e o começo da resposta quando o GitHub recusa. O token nunca é impresso.
*/

/**
 * @typedef {(metodo: string, caminho: string, corpo?: unknown) => Promise<any>} Api
 * @param {string | undefined} token
 * @returns {Api}
 */
export function apiDoGitHub(token) {
  if (!token) throw new Error("GITHUB_TOKEN ausente");
  return async (metodo, caminho, corpo) => {
    const r = await fetch(`https://api.github.com${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gate-do-repositorio",
        ...(corpo === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${metodo} ${caminho}: ${texto.slice(0, 200)}`);
    return texto ? JSON.parse(texto) : null;
  };
}

/** Lê "--chave valor" e "--chave" (verdadeiro) da linha de comando. */
export function argumentos(argv) {
  /** @type {Record<string, string | true>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const proximo = argv[i + 1];
    if (proximo !== undefined && !proximo.startsWith("--")) out[argv[i].slice(2)] = argv[++i];
    else out[argv[i].slice(2)] = true;
  }
  return out;
}
