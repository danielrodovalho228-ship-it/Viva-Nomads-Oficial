# Plano: proteger CPF, CNPJ e telefone antes do lançamento

Status: **PLANO — nada aplicado.** Escrito em 07/10/2026 (pacote de segurança, item 5).
Cada fase vira uma migração própria, com SQL mostrado ao Daniel e aplicada só com OK.

## 1. Onde estão hoje (produção, conferido em 07/10/2026)

| Coluna | Linhas preenchidas | Quem grava | Quem lê |
|---|---|---|---|
| `profiles.cpf` | 0 | tela Conta (dono do perfil) | `api/caf/verify` (cliente do usuário), `api/assinatura` (cliente do usuário), `fiscal/emitir` e `fechamento-servidor` (service_role) |
| `profiles.cnpj` | 0 | tela Conta | `api/assinatura` (cliente do usuário), `fiscal/emitir`, `fechamento-servidor` (service_role) |
| `profiles.phone` | 0 | `perfil-actions` (cliente do usuário) | `perfil-actions/getMeusDados` (cliente do usuário), `atendimento/servidor` e `pedidos-admin` (WhatsApp) |
| `properties.responsavel_local_telefone` | 0 | anúncio (dono) | dono e admin |
| `documents.doc_number` | 0 | documentos do proprietário | dono |
| `documentos_fiscais.locador_doc` / `locatario_doc` | 0 | `fiscal/emitir` (service_role) | ninguém pelo navegador (vai impresso no PDF) |

**Agora é a hora:** tudo vazio. Mudar o formato depois exige migrar dado real.

Proteções que já existem: banco criptografado em disco (Supabase), RLS por linha (cada um só
lê o próprio perfil; admin lê todos), PDF fiscal só por URL assinada de 10 min, `/conferir`
mostra só iniciais, chat mascara telefone/e-mail.

O que falta: anon e authenticated ainda têm **SELECT de coluna** em `cpf`, `cnpj` e `phone`
(só o RLS por linha segura); a coluna guarda texto puro (quem tiver acesso ao banco ou a um
backup lê tudo); nada impede um admin comprometido de exportar todos os CPFs.

## 2. Opções

| Opção | O que é | Prós | Contras |
|---|---|---|---|
| **A. Fechar colunas + leitura pelo servidor** | `revoke select (cpf, cnpj, phone) on profiles from anon, authenticated`; o navegador nunca recebe o dado; o servidor lê com service_role depois de checar o login; a tela mostra mascarado (`***.456.789-**`). | Barato, sem chave para gerenciar, resolve o vazamento pelo navegador/API. | Texto puro continua no banco e nos backups. |
| **B. Criptografia de coluna (pgcrypto + chave no Vault)** | Coluna `cpf_cifrado bytea` com `pgp_sym_encrypt`; chave no Supabase Vault; só funções `security definer` do servidor (service_role) cifram/decifram. Para buscar/evitar duplicado: `cpf_hash` = HMAC-SHA256 com outra chave. | Backup e dump não revelam nada; admin pelo SQL vê só bytes. | Mais código; chave precisa de rotação e backup; não dá para filtrar por CPF sem o hash. |
| C. pgsodium / TCE | Criptografia transparente do Supabase. | — | **Descartada**: o Supabase está descontinuando o pgsodium. |
| D. Só mascarar na tela | Mostrar `***` na interface. | Trivial. | Não protege nada: a API devolve o dado inteiro. |

## 3. Recomendação: A antes do lançamento, B logo depois

**Fase 1 (antes do lançamento) — opção A**
1. Código: as 3 leituras pelo cliente do usuário (`api/caf/verify`, `api/assinatura`,
   `perfil-actions/getMeusDados`) passam a ler `cpf`/`cnpj`/`phone` com service_role, filtrando
   pelo `user.id` já validado. Gravação continua pela server action (com validação de formato
   e dígito verificador).
2. Tela Conta mostra o dado mascarado; para trocar, digita de novo inteiro.
3. Migração: `revoke select (cpf, cnpj, phone) on public.profiles from anon, authenticated;`
   e o mesmo para `properties.responsavel_local_telefone` (lido pelo servidor).
   Atenção: depois disso `select("*")` em `profiles` pelo navegador quebra — hoje não há
   nenhum (conferido), e o teste vai garantir.
4. Teste: logado lendo `profiles.cpf` pelo PostgREST recebe `permission denied`; Conta,
   assinatura, CAF e recibo continuam funcionando (lab).

**Fase 2 (até 30 dias depois do lançamento) — opção B**
1. Chave `pii_chave` e `pii_hmac` no Vault (criadas pelo Daniel no painel; nunca no repositório).
2. Colunas `cpf_cifrado`, `cnpj_cifrado`, `phone_cifrado` (bytea) + `cpf_hash`, `cnpj_hash`.
3. Funções `pii_gravar(...)` e `pii_ler(...)` `security definer`, `search_path` fixo, EXECUTE
   só para service_role. Migra o que houver, confere contagem, apaga as colunas em texto.
4. `documentos_fiscais.locador_doc/locatario_doc`: mesmo tratamento (o PDF continua com o
   documento, que é exigido no recibo; a cópia no banco fica cifrada).
5. Teste: dump da tabela não contém nenhum CPF em texto; lab emite recibo com o CPF certo.

**Sempre:** logs e e-mails nunca levam CPF inteiro; o agente Bruno confere toda noite que
nenhuma coluna nova com nome `cpf|cnpj|phone|telefone|_doc` apareceu sem estar neste plano.
