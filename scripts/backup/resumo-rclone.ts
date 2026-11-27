// E929 — imprime no log da Action o resumo do log PRIVADO do rclone (só números e erros sem caminho/URL/identificador).
//   node scripts/backup/resumo-rclone.ts <arquivo-de-log>
import { existsSync, readFileSync } from "node:fs";
import { linhasDoResumo, resumoRclone } from "../../src/lib/backup/resumo-rclone.ts";

const arq = process.argv[2];
const log = arq && existsSync(arq) ? readFileSync(arq, "utf8") : "";
for (const l of linhasDoResumo(resumoRclone(log))) console.log(l);
