# E929 — Backup noturno: a cópia do storage falhava sem erro no log (14/11/2026)

## Sintomas
- **#26 (12/11) e #28 (14/11):** canceladas pelo limite de 1 h do job, no meio da etapa "arquivos do storage".
- **#29 (14/11, à mão):** saiu com código 1 depois de ~39 min (20:54:31 → 21:33:30), sem nenhuma linha de erro no log.
- **Dump do banco:** sempre funcionou (9,4 MB, 260 tabelas, ~60 mil linhas).

## Diagnóstico (pelo histórico das execuções verdes)
| Execução | Etapa do storage | Storage | Pasta no Drive |
|---|---|---|---|
| #23 (09/11) | 13 min | 269 objetos, 58 189 840 bytes | 167 MB |
| #24 (10/11) | 24 min | 270 objetos, 58 192 608 bytes | 233 MB (+66) |
| #25 (11/11) | 29 min | 270 objetos, 58 192 608 bytes | 299 MB (+66) |
| #27 (13/11) | 10 min | 270 objetos, 58 192 608 bytes | 401 MB (+102 em 2 dias) |

O storage **não mudou** (270 objetos, 58 MB). Mesmo assim, a pasta do Drive cresceu **~66 MB por dia**, o que equivale ao storage inteiro (58 MB) mais o dump (9 MB). Ou seja, o `rclone sync` **recopia todos os arquivos toda noite** e, pelo `--backup-dir`, move a versão anterior de cada um para `storage/removidos/AAAA-MM-DD/`. São ~270 envios e ~270 movimentações por noite no Drive, que limita escrita por usuário. As recusas (403) viram esperas longas, a duração varia de 10 a 46 min e, quando as tentativas se esgotam, o processo sai com código 1.

Sem conteúdo nem nome repetido, o que faz o rclone achar que os arquivos mudaram é a **data**. A comparação é por tamanho + data (`--use-server-modtime`), porque o crypt não guarda hash, e a data do S3 do Supabase não bate com a gravada no Drive. Como sem hash o rclone não consegue só "acertar a data", ele recopia.

O ensaio do PR (S3 de teste + Drive local) não reproduz: lá as datas batem e só os 3 arquivos trocados vão para `removidos` (`scripts/backup/ensaio.sh`).

## Correção
1. **Erro visível, sem dado de arquivo.** O sync escreve um log próprio, privado (`$TRAB/sync.log`, nível DEBUG). Dando certo ou não, o log da Action ganha o resumo (`scripts/backup/resumo-rclone.ts`, com a regra pura em `src/lib/backup/resumo-rclone.ts`):
   - contagens (novos, substituídos, movidos para removidos, apagados);
   - o motivo de cada troca (data diferente × tamanho diferente, com a maior diferença de data);
   - os erros agrupados, sem caminho, URL, e-mail nem identificador.

   Se o sync falha, sai `::error::A cópia dos arquivos do storage falhou (resumo do rclone acima)`.
2. **Cópia incremental de verdade.**
   - `--modify-window 2s` tolera a diferença de precisão de data entre o S3 e o Drive.
   - `--checkers 8 --tpslimit 8` freia as requisições ao Drive, para não colher 403 em rajada.
3. **Folga de tempo.** O `timeout-minutes` do job passou de 60 para **120**. A etapa já levou até 46 min e o job inteiro cerca de 50.

## Se a diferença de data for maior que 2 s
O resumo da primeira execução diz a "maior diferença" de data. Se ela for de horas (fuso), ou se o S3 do Supabase devolver uma data que muda a cada leitura, a folga de 2 s não basta. Nesse caso o passo seguinte é trocar a comparação para `--size-only` (o ensaio já cobre a troca do mesmo tamanho como risco aceito), com o teste de restauração semanal conferindo o conteúdo byte a byte. Esse passo fica para depois de ler o resumo, sem adivinhar.

## Testes
- **`src/lib/backup/e929-resumo-rclone.test.ts`:**
  - o resumo conta e classifica as trocas;
  - nenhuma linha que vai para o log público tem nome de arquivo, URL ou identificador;
  - o `copia.sh` imprime o resumo sempre e transforma a falha em `::error::`;
  - o job tem 90 min ou mais.
- **`src/lib/backup/workflows.test.ts`:** as asserções do sync foram atualizadas (log próprio e flags novas).
- **O ensaio do pipeline no CI** (`scripts/backup/ensaio.sh`) roda o `copia.sh` duas vezes e confere o `--backup-dir`.
