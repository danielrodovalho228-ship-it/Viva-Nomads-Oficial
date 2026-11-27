import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoRclone, linhasDoResumo } from "./resumo-rclone.ts";

/*
  E929 🔴: o backup noturno falhava na etapa "arquivos do storage" SEM texto de erro no log — a saída do rclone ia só
  para o arquivo privado (pode ter nome de arquivo de usuário). Regra: o log da Action mostra um RESUMO do rclone —
  contagens, o motivo de cada troca (tamanho × data, com a maior diferença) e os erros — sem nome de arquivo, URL,
  e-mail nem identificador.
*/
const LOG = [
  "2026/11/14 21:00:01 DEBUG : avatars/u-1f2e/foto.jpg: Modification times differ by 3h0m0.5s: 2026-11-09 20:16:32 +0000 UTC, 2026-11-09 17:16:32 -0300 -03",
  "2026/11/14 21:00:01 DEBUG : property-photos/maria-silva/sala.webp: Modification times differ by 1.25s: x, y",
  "2026/11/14 21:00:02 DEBUG : documentos/contrato-joao.pdf: Sizes differ (src 100 vs dst 90)",
  "2026/11/14 21:00:03 INFO  : avatars/u-1f2e/foto.jpg: Moved (server-side) to: storage/removidos/2026-11-14/avatars/u-1f2e/foto.jpg",
  "2026/11/14 21:00:04 INFO  : avatars/u-1f2e/foto.jpg: Copied (replaced existing)",
  "2026/11/14 21:00:05 INFO  : avatars/novo.png: Copied (new)",
  "2026/11/14 21:00:06 INFO  : velho/x.jpg: Deleted",
  "2026/11/14 21:00:07 ERROR : property-photos/maria-silva/sala.webp: Failed to copy: googleapi: Error 403: User rate limit exceeded., userRateLimitExceeded https://www.googleapis.com/drive/v3/files/1AbCdEfGhIjKlMnOpQrStUvWxYz?x=1",
  "2026/11/14 21:00:08 ERROR : documentos/contrato-joao.pdf: Failed to copy: googleapi: Error 403: User rate limit exceeded., userRateLimitExceeded https://www.googleapis.com/drive/v3/files/9ZyXwVuTsRqPoNmLkJiHgFeDcBa",
  "2026/11/14 21:00:09 ERROR : Attempt 1/3 failed with 2 errors and: googleapi: Error 403: User rate limit exceeded., userRateLimitExceeded",
  "2026/11/14 21:00:10 NOTICE: Transferred:   	   57.000 MiB / 57.000 MiB, 100%, 1.2 MiB/s, ETA 0s",
].join("\n");

test("conta o que o sync fez e por quê (sem nome de arquivo)", () => {
  const r = resumoRclone(LOG);
  assert.deepEqual(
    { novos: r.novos, substituidos: r.substituidos, movidosParaRemovidos: r.movidosParaRemovidos, apagados: r.apagados, porData: r.porData, porTamanho: r.porTamanho },
    { novos: 1, substituidos: 1, movidosParaRemovidos: 1, apagados: 1, porData: 2, porTamanho: 1 },
  );
  assert.equal(r.maiorDiferencaData, "3h0m0.5s");
  assert.equal(r.erros, 3);
});

test("os erros saem agrupados, sem caminho, URL nem identificador", () => {
  const r = resumoRclone(LOG);
  assert.equal(r.errosDistintos.length, 2);
  for (const e of r.errosDistintos) {
    assert.doesNotMatch(e.texto, /avatars|property-photos|documentos|maria|joao|contrato|https?:|1AbCdEf|9ZyXw/);
  }
  assert.ok(r.errosDistintos.some((e) => /Failed to copy: googleapi: Error 403: User rate limit exceeded/.test(e.texto) && e.vezes === 2));
});

test("as linhas do resumo (o que vai para o log público) não têm nenhum nome de arquivo", () => {
  const linhas = linhasDoResumo(resumoRclone(LOG)).join("\n");
  assert.match(linhas, /novos: 1/);
  assert.match(linhas, /data diferente: 2 \(maior diferença 3h0m0\.5s\)/);
  assert.match(linhas, /erros: 3/);
  assert.doesNotMatch(linhas, /avatars|property-photos|documentos|maria|joao|\.jpg|\.webp|\.pdf|https?:/);
});

test("log sem nada: tudo zero, sem erro", () => {
  const r = resumoRclone("");
  assert.equal(r.erros, 0);
  assert.equal(r.novos, 0);
  assert.equal(r.maiorDiferencaData, null);
});

test("copia.sh: o sync tem log próprio, o resumo sai sempre (deu certo ou não) e a falha vira ::error::", async () => {
  const { readFileSync } = await import("node:fs");
  const s = readFileSync("scripts/backup/copia.sh", "utf8");
  const i = s.indexOf('etapa "arquivos do storage"');
  const etapa = s.slice(i, s.indexOf('etapa "contagem do storage"'));
  assert.match(etapa, /--log-file "\$SYNC_LOG" --log-level DEBUG/);
  assert.match(etapa, /\|\| sync_ok=0\nnode "\$RAIZ\/scripts\/backup\/resumo-rclone\.ts" "\$SYNC_LOG"/);
  assert.match(etapa, /::error::A cópia dos arquivos do storage falhou/);
  assert.match(etapa, /--modify-window 2s/);
  // Nada do rclone no log público: nem a linha que o DEBUG escreve no stderr antes de abrir o --log-file.
  assert.match(etapa, /--tpslimit 8 2>>"\$SYNC_LOG" \|\| sync_ok=0/);
});

test("o job do backup noturno tem folga de tempo para a cópia do storage (≥ 90 min)", async () => {
  const { readFileSync } = await import("node:fs");
  const wf = readFileSync(".github/workflows/backup-noturno.yml", "utf8");
  const min = Number(/timeout-minutes: (\d+)/.exec(wf)?.[1]);
  assert.ok(min >= 90, `timeout ${min}`);
});
