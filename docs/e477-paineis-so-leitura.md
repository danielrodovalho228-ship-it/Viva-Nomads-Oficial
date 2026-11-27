# E477 (resíduo, re-prova de 06/11 23:31) — a observadora da QA lê, e só lê, em Pendências, Fotos de perfil e Imóveis

**Relato:** a observadora `qa-muse-1` (só leitura) seguia vendo os controles de escrita presentes e aparentemente habilitados em três painéis, sem o aviso "Só leitura": Pendências (Aceitar/Recusar ×28 pares, todos em "Contas de teste · 30"), Fotos de perfil (Aprovar/Remover, 1 item) e Imóveis (Pausar ×11). O #3033 já corrigiu os outros sete grupos.
**Evidência (só leitura, produção):** os 11 anúncios ativos são de donos de **teste**; a própria observadora é conta de teste. Nada disso é dado real.
**Causa:** a regra do QA-LOGIN-B v2 diz "dado real → só leitura; dado de teste → liberado ao observador". Esses três painéis só tinham dado de teste, então a tela e o servidor cumpriam a regra e **liberavam** o controle. Não era buraco no dado real; era a regra mais larga do que o esperado para uma conta "só leitura".
**Correção (mesmo padrão do #3033):** nestes três painéis a observadora é só leitura em **toda** linha, de teste ou real.
- **Servidor:** as ações recusam sem olhar o alvo (`recusaObservador(uid)`): `pausarImovelAdmin`, `aprovarFotoPerfil`, `removerFotoPerfil` e as três ações da Central (`analisarFotoNivel`, decidir contestação em `agirNaPendencia`, `decidirRevisaoAvaliacao`).
- **Tela:** as linhas dos três painéis entram sem alvo em `soLeituraNaTela` (a regra do observador trata sem alvo como "proibida sempre"); a Central usa `alvosDaCentral(..., true)`. Em cada linha o controle sai e entra "Só leitura" (Fotos de perfil e Imóveis passam a mostrar o aviso em toda linha).
- Quem não é observadora nunca é afetado (a regra antes de tudo é `ehObservador`).

## O que NÃO mudou
O restante do QA-LOGIN-B v2 (dado de teste liberado nas demais telas, p.ex. Documentos, Pedidos, Parcerias): a decisão de fechar só estes três é do pedido do Muse. Se a QA quiser a observadora estritamente só leitura em **todas** as telas, é a mesma troca de regra, tela a tela; fica para decisão.

## Testes
`src/lib/qa/e477-paineis-so-leitura.test.ts` (linha sem alvo é só leitura mesmo com dono de teste; servidor sem alvo nas seis ações; as três telas). Três guardas antigos que fixavam "alvo do item" passaram a fixar o novo invariante (`e477-observador-escrita`, `observador-regras`, `observador-tela`).
