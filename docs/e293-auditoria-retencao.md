# E293 — auditoria de retenção ("a Viva só conecta", 31/10/2026)

Auditoria apenas: **nenhum código e nenhuma migração** mudam nesta etapa. As correções ficam no fim, como **propostas
para validação** antes de executar.

**Desenho aprovado:** a Viva guarda só a **chave** do fornecedor e o **resultado** (veredito). O dado bruto fica com o
fornecedor.

**Como foi feito:**
- leitura do código, com arquivo e linha de cada ponto que grava;
- leitura do esquema em `supabase/migrations`;
- consultas só de leitura em produção (contagens, idade das linhas e nomes de chaves de jsonb; nenhum valor pessoal
  foi lido);
- comparação com o inventário declarado em `src/config/retencao.ts` e `docs/ripd-retencao.md`.

## 1. Situação geral

- **Simuladores não guardam nada.** São eles `/dashboard/simulador` (`calculo-imovel.ts`, `simulador.ts`), o ROI e a
  viabilidade (que redirecionam), o simulador de imposto (`tax.ts`, `/tributario`) e o simulador do Passo 8. Não gravam
  no banco, não usam localStorage e não mandam evento com os números digitados. A tabela `eventos` guarda só tipo,
  anúncio, cidade e origem do tráfego, e as linhas saem depois de 18 meses (pg_cron `limpar-eventos-antigos`).
- **A eliminação por prazo ainda roda em modo simulado** nos itens com prazo "pendente – item 13": a rotina só conta o
  que sairia. Em produção, `eliminacoes_simulado` tem 1.004 linhas. Saem de verdade só os documentos e arquivos da fase
  1 (`eliminacoes_registro`, 103 linhas).
- **A maior parte das integrações já segue o desenho** (seção 3). O que foge do desenho está concentrado em três pontos:
  - o que o **modelo de IA leu** de documentos e matrículas;
  - o **conteúdo do Google Places**;
  - a **verificação de identidade (CAF)**, que não guarda a chave do fornecedor.

## 2. Onde a retenção foge do desenho

| # | Dado | Fornecedor | Onde grava (código) | Tabela/campo | O que fica | Quem lê | Prazo hoje | Produção (31/10) |
|---|---|---|---|---|---|---|---|---|
| A1 | Campos extraídos da **matrícula** | Modelo de IA (Anthropic) | `src/app/api/documentos/conferir/route.ts:161-178`; `src/lib/documento/conferencia-matricula.ts:303-318` (`camposParaGravar`) | `property_ownership_checks.campos_extraidos`, `onus`, `matricula_numero`, `cartorio` | **Conteúdo extraído.** Nome de cada coproprietário, final do documento, fração, endereço, áreas e vaga. Em `onus[].credor`, o nome de credores e beneficiários, que são **terceiros**. | o dono do imóvel e o admin (`0158`) | Só o arquivo sai, 30 dias depois da revisão (`src/lib/minimizacao/servidor.ts:106`). **Os campos ficam para sempre.** | 5 linhas, 3 com campos preenchidos |
| A2 | Leitura de outros documentos do imóvel (IPTU, conta, contrato) pelo modelo | Modelo de IA (Anthropic) | `src/app/api/documentos/conferir/route.ts:227-240` | `qualification_checklists.conferencia` → `leitura` | **Saída bruta do modelo:** nome do titular, trecho do meio do CPF/CNPJ, endereço completo e nomes de proprietários citados | o dono e o admin | O arquivo sai em 30 dias. **O jsonb fica para sempre.** | 3 de 30 linhas têm `leitura` |
| A3 | Espaços de trabalho próximos (coworking, café) | Google Places, busca próxima (`nearbysearch`) | `src/lib/data/actions.ts:938-947` | `property_workspaces.name`, `type`, `distance_m` | **Conteúdo do Google** (nome e distância), **sem `place_id`**. Os termos do Google só permitem guardar o `place_id` de forma permanente. | público (`0061`) | Enquanto o anúncio existir | 0 linhas |
| A4 | Verificação de identidade | CAF/Certta | `src/app/api/caf/verify/route.ts:77-82`; `notes` em `caf-resposta.ts:133-134` | `tenant_verifications.caf_result` | Resultado (sinal de risco, identidade, documento, prova de vida). Mas **não guarda o id da transação na CAF**, que é a chave do fornecedor, e `notes` copia até 8 motivos em **texto livre do fornecedor**. | só o admin (`0011`) | `valid_until` de 12 meses, mas **nada apaga as linhas vencidas** | 6 linhas, de 18 a 22/10; chaves: coversForeigners, demo, document, identity, light, liveness, notes, simulado |
| A5 | Pontos e cache de vizinhança | OSM Nominatim/Overpass; Mapbox como alternativa | `src/app/api/proximidades/route.ts:79,99` | `proximidades_cep` (cep, lat, lng, `itens`, fonte) | A lista inteira do fornecedor. OSM pode ser guardado (licença aberta); o geocoding **temporário** da Mapbox não pode. | só o servidor | Usado como fresco por 30 dias, mas **linhas velhas nunca saem** | 5 linhas (3 osm, 2 erro) |
| A6 | Coordenadas dos destinos oficiais | Google Text Search ou Nominatim | `src/lib/destinos/actions.ts:53` | `destinos.lat`, `lng` | Coordenada do fornecedor, guardada sem prazo. O Google permite guardar coordenada só por 30 dias; com Nominatim (OSM) não há restrição. | público | nenhum | 4 linhas |

## 3. O que já segue o desenho (chave ou resultado)

| Dado | Fornecedor | Tabela | O que fica | Prazo |
|---|---|---|---|---|
| Webhook de pagamento | Asaas | `asaas_eventos` (chave, evento, payment_id), `recebimentos`, status das cobranças | chave e resultado; **o corpo da notificação não é salvo** | sem prazo; produção: 0 linhas |
| Cobrança e contrato assinado | Asaas, ZapSign | `cobrancas_fechamento.externo_id` | só a chave | — |
| Detecção de fotos | Modelo de IA (`MODELO_DETECCAO`) | `deteccao_fotos_analises`, `deteccao_sugestoes` | hash, sim/não, confiança, modelo | sai junto com o anúncio |
| Tempo até o trabalho | Google Routes, Mapbox Matrix | `tempos_deslocamento` | minutos e metros (resultado) | válido por 30 dias na leitura; **nada apaga as linhas velhas** (ver P6); produção: 0 linhas |
| Importação de calendário | iCal do Airbnb/Booking | `property_blocks`, `calendario_importacoes` | só datas; **nenhum nome ou resumo de hóspede**. A URL do feed (que é secreta) só o servidor lê. | os bloqueios são trocados a cada leitura |
| LinkedIn | LinkedIn OIDC | `confianca_linkedin.sub_hash` | hash da chave | sai ao desconectar |
| Medição de internet | Cloudflare (no navegador) | `internet_medicoes` | mediana de Mbps, latência e distância; a posição do aparelho não é guardada | ver P6 |
| Turnstile, CEP (ViaCEP/BrasilAPI), WhatsApp (Z-API), código por telefone | — | nada gravado | — | — |
| Falhas de chamada à IA | Modelo de IA | `ia_chamadas` | metadados e `erro_resumo` (até 300 caracteres do erro do fornecedor) | **sem prazo** (ver P7); 184 linhas, desde 18/10 |
| E-mails | Resend | `emails_teste.corpo` | corpo inteiro, **só de contas de teste** | sem prazo; produção: 188 linhas, todas de contas de teste, destinatário mascarado |

Não existe no código nenhuma consulta de CPF ou CNPJ a fornecedor (Receita, BrasilAPI CNPJ).

**Saídas de IA que são a própria conversa** estão declaradas no inventário, mas sem prazo aplicado. São elas: respostas
do atendimento (`chamado_mensagens`), chat dos agentes do admin (`agentes_conversas`, `agentes_memoria`) e transcrição
da caixa dos sócios (`caixa_socios.texto_extraido`, que fica junto com o áudio). Pela proposta de prazos do E293, que
segue pendente, elas dependem da decisão sobre o item 13.

## 4. Outras divergências com o inventário (`src/config/retencao.ts`)

- `retencao.ts:176-177` diz que fica só o **veredito** em `property_ownership_checks` e `qualification_checklists`. Os
  itens A1 e A2 mostram que fica mais do que isso.
- O teste do inventário (`inventario.test.ts`) não olha as colunas **jsonb** em que entra saída de fornecedor
  (`conferencia`, `campos_extraidos`, `onus`, `caf_result`, `itens`). Foi por isso que A1 e A2 passaram.
- Estão fora do inventário:
  - `ai_generations` (guarda user_id);
  - `push_envios` (guarda user_id; sai em 30 dias);
  - `properties.airbnb_monthly_price` (o valor do Airbnb digitado pelo dono, que fica **público**; produção: 0 de 47
    anúncios). O selo "Preço justo" depende dessa decisão pendente e não foi tocado.
- `retencao.ts:150` diz que a medição do morador sai depois que o sinal é processado, mas nenhum código apaga essas
  linhas (produção: 0 linhas de morador).

## 5. Propostas para validação (nada disto foi executado)

Ordem de prioridade. Cada uma vira um PR próprio depois de validada. As que mexem em dado existente vêm com migração,
aplicar idempotente e rollback.

- **P1 — Matrícula guarda só o veredito (A1).**
  - Em `camposParaGravar`, guardar só `nome_confere`, `documento_confere`, `fracao` e o número de proprietários. Sair
    `nome`, `documento_final`, o endereço, as áreas e a vaga.
  - Em `onus`, guardar só o tipo, sem o `credor`.
  - Na eliminação do arquivo (`minimizacao/servidor.ts:106`), limpar também `campos_extraidos`, `onus`,
    `matricula_numero` e `cartorio`.
  - Migração para limpar as 3 linhas atuais.
  - Corrigir `retencao.ts:176`.
- **P2 — Documento do imóvel sem a leitura bruta (A2).**
  - Em `route.ts:236`, trocar `leitura` por sim/não: legível, completo, tipo, titular confere, endereço confere e número
    de sinais de edição.
  - Migração que tira `conferencia->'leitura'` das 3 linhas atuais.
- **P3 — O teste do inventário passa a olhar jsonb.** Toda coluna jsonb que recebe saída de fornecedor precisa ter uma
  entrada que diga o que fica nela.
- **P4 — Google Places (A3).** Duas opções:
  - **(a)** guardar só `place_id` e a hora da consulta, e buscar o nome quando a página for mostrada;
  - **(b)** trocar pelo OSM, que a vizinhança já usa.

  Recomendo (b): é mais simples, não tem custo por consulta e não esbarra nos termos do Google.
- **P5 — CAF (A4).**
  - Nova coluna com o id da transação na CAF (a chave do fornecedor).
  - Trocar `notes` em texto livre por códigos fixos.
  - Limpeza das linhas vencidas, mantendo só o veredito.
- **P6 — Prazos que já estão declarados passam a ser cumpridos.** Entram na rotina diária:
  - medição do morador apagada depois de processada;
  - do dono, só a última medição válida;
  - `tempos_deslocamento` e `proximidades_cep` com mais de 30 dias;
  - linhas da Mapbox que não podem ser guardadas;
  - `destinos` por Google, que passam a ser refeitos pelo OSM (A6).
- **P7 — Itens pequenos.**
  - Pôr `ai_generations`, `push_envios` e `airbnb_monthly_price` no inventário.
  - Prazo de 90 dias para `ia_chamadas`.
  - Não registrar no log o corpo da resposta de erro do fornecedor (`caf.ts:61`, `asaas.ts:35`); só o código.

**O que esta auditoria não decide:**
- os prazos do E293 (proposta 30/30/2 dias);
- o item 13 da Dra. Beatriz;
- o selo "Preço justo";
- `AUTOMACOES_ATIVO`;
- o grupo 2 do E289.

## 6. Andamento (01/11/2026)

- Feitos e mesclados: P1, P2, P3, P5 (frases fixas no lugar do texto livre da CAF) e P7.
- **Relatório simulado honesto:** os itens de fase 2 com prazo declarado (medição do morador, motivo da saída, denúncia
  resolvida, `eventos`, `push_envios`) passam a ser contados. Antes, sem coletor, apareciam com "0 vencidos" sem ninguém
  ter contado. Os coletores só contam: a fase 2 continua sem apagar nada. Uma guarda
  (`src/lib/minimizacao/relatorio-contagem.test.ts`) exige contagem ou motivo escrito para todo item com prazo.
  Produção em 01/11: os cinco dão zero vencidos.
- **Seguem esperando decisão do Daniel** (não executados):
  - P4 (Google Places: opção a ou b);
  - P5, segunda parte (coluna `caf_transacao_id` e limpeza das verificações vencidas);
  - P6 (apagar de verdade os caches de fornecedor e passar itens da fase 2 para a fase 1);
  - `airbnb_monthly_price` no inventário, que depende do E399-B parte 2 (parecer da Dra. Beatriz);
  - os prazos do item 13.
