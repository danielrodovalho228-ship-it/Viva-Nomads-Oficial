# E256 — porta de QA (/qa/entrar) devolvendo 404 com a chave "válida" (diagnóstico de 08/11/2026)

## Resultado
**Não há defeito de código a corrigir.** Desde o E488 a porta só devolve **404** em dois casos; com a chave CERTA, qualquer outra recusa é **403 com o código da causa** (`perfil`, `2fa`, `padrao`, `admin_fechada`, `email`). Portanto "chave válida + 404" só acontece quando:
1. `desligada` — `QA_LOGIN_KEY_HASH` ausente ou fora do formato de hash (`qaLoginLigado()` = `hashValido(process.env.QA_LOGIN_KEY_HASH)`); ou
2. `chave` — o hash da chave digitada **não bate** com `QA_LOGIN_KEY_HASH`.
Os dois são **configuração**, não código. (Um GET deixa `metodo` no log, mas o formulário usa POST.)

## O que conferi (só leitura)
- Vercel, lista de variáveis (nomes e metadados; nenhum valor foi lido nem alterado): `QA_LOGIN_KEY_HASH` **existe** em Production (atualizada em 28/10/2026) e em Preview (28/10/2026). É do tipo *sensitive*: o valor não é legível por ninguém depois de salvo. Logo, o caso `desligada` por variável ausente está descartado; sobra "hash salvo não corresponde à chave que a QA usa" ou "valor salvo fora do formato".
- Logs de runtime de produção, últimas 24 h: **nenhuma** chamada à porta registrada; sem o código de motivo (`[qa-entrar] recusa …`) não dá para separar `chave` de `desligada` por log hoje.
- `AUTOMACOES_ATIVO` não foi tocada.

## O que resolve (Daniel ou o chat principal, sem código)
1. Gerar uma chave nova e o hash dela (o fluxo está em `docs/qa-login.md`), guardar a chave no cofre e salvar **só o hash** em `QA_LOGIN_KEY_HASH` (Production e Preview), refazendo o deploy. O formato do hash precisa passar em `hashValido`.
2. Na primeira falha depois disso, ler o motivo no log: `chave` = a chave digitada não é a do hash; `desligada` = o valor salvo está fora do formato.
Nada disso é feito por esta pista (variável da Vercel é do Daniel; sem prova ao vivo).

## E214 (QA-LOGIN-B, entrada direta sem código)
Já entregue e mesclado: v1 (migração 0251) e v2 (0252, porta por hash, admin observador e auditoria); depois E256-B (0257), E361, E488 e E674. Nada novo a codar.
