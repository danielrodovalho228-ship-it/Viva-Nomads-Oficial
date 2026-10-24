# CAMPOS-3: dados das 10 etapas do assistente de cadastro (Pista B)

Referência visual: mockups aprovados pelo Daniel em 23/10, às 20:48. Estão em `docs/mockups/cadastro-imovel-01..10`, na branch `mockups` (commit fe1259bf). Quem constrói as telas é a Pista A; a Pista B garante que cada campo que elas mostram tenha dado.

**Fonte única para as telas:** `src/lib/anuncio/assistente-dez-etapas.ts`.
- `ETAPAS_ASSISTENTE` diz, para cada etapa, o arquivo do mockup, os campos de `Property` que ela usa e os itens da prontidão que ela resolve. A prontidão (`src/lib/anuncio/prontidao.ts`) é a única regra de "pode publicar".
- `conferenciaAssistente(prontidao)` monta a lista de conferência da etapa 10.

**Testes:** `src/lib/anuncio/assistente-dez-etapas.test.ts` verifica três coisas:
- todo campo citado existe em `Property`;
- todo item obrigatório da prontidão cai em exatamente uma etapa;
- esta spec cita todas as telas.

**Migração:** nenhuma. "Outras regras" entra no `regras_casa` (jsonb, da 0233), e a comodidade TV entra no catálogo de comodidades, que fica no código.

## Etapa por etapa

| # | Tela | Campo na tela → dado | Situação |
|---|---|---|---|
| 1 | `cadastro-imovel-01-tipo` | Casa / Apartamento / Quarto → `propertyType` (`PROPERTY_TYPES`: apartamento, studio, loft, cobertura, casa, casa_condominio, flat, quarto) | Existe. O mockup mostra 3 cartões e o catálogo tem 8. Sugestão: os 3 cartões grandes e "Outros tipos" abrindo os demais. A qualificação "Antes de anunciar", quando pendente, aparece nesta etapa |
| 2 | `cadastro-imovel-02-fotos` | Fotos → `photos` (`property_photos`); "Foto principal" → `sort_order` 0; etiqueta Quarto/Cozinha/Banheiro → `property_photos.comodo` | Existe. O mockup mostra 4 fotos, mas publicar exige **8** (`MIN_FOTOS`). A tela deve dizer quantas faltam |
| 3 | `cadastro-imovel-03-endereco` | Endereço completo → `exactAddress` (privado até o aceite); bairro/cidade/UF → `neighborhood`/`city`/`state`; mapa → `lat`/`lng` (aproximado em público); "local exato só após a reserva" | Existe. **Fora do mockup, mas obrigatório:** comprovante do imóvel (`documento`) e, para sublocado ou administrado, a autorização (`sublocacao`). Ficam nesta etapa, como hoje |
| 4 | `cadastro-imovel-04-detalhes` | Quartos, banheiros, área, "Recebe até N pessoas" → `bedrooms`, `bathrooms`, `areaM2`, `maxGuests` | Existe (quartos podem ser 0, como num studio). Os chips "Comodidades principais" gravam no mesmo `amenities` da etapa 5: são um atalho, não um dado à parte |
| 5 | `cadastro-imovel-05-comodidades` | Wi-Fi → `internet_fibra`; Ar-condicionado → `ar_condicionado`; Cozinha completa → `cozinha_equipada`; **TV → `tv` (novo)**; Máquina de lavar → `maquina_lavar`; Mesa de trabalho → `mesa_trabalho`; Garagem → `vaga_garagem`; Piscina → `piscina` | **TV faltava** e foi criada agora, com ícone e reconhecida na importação. **Fora do mockup, mas obrigatório:** velocidade da internet em Mbps (`internet`), a declaração "sem câmeras dentro do imóvel" (`privacidade`) e o padrão mínimo de conforto (`conforto`). Ficam nesta etapa. Os detalhes opcionais do CAMPOS-2 (áreas do condomínio, vaga etc.) também cabem aqui |
| 6 | `cadastro-imovel-06-regras` | Horário de silêncio, visitas, pernoite, fumantes, festas → `regrasCasa` (CAMPOS-1/2, um toggle por regra); **"Outras regras (opcional)" → `regrasCasa.outras` (novo)** | **Outras regras faltava** e foi criada agora: até 280 caracteres, sem toggle; vazio não aparece. No anúncio, vira a última linha da folha "Regras da casa". No editor: campo `regras-casa-outras`. O mockup tem fumo e festas como sim/não; o dado tem 3 opções de fumo (proibido / só na área externa / permitido). **Fora do mockup, mas obrigatório para anúncio novo:** tipo de entrada (`tipo_entrada`, 61-B). Fica nesta etapa |
| 7 | `cadastro-imovel-07-descricao` | Título → `title`; Descrição → `description`; chips Mobiliado → `furnished`, Wi-Fi incluído → `detalhesAnuncio.incluidoNoPreco` (internet), Permitido pets → `petsAllowed` | Existe. A descrição exige pelo menos 60 caracteres (`MIN_DESCRICAO`) |
| 8 | `cadastro-imovel-08-preco` | Aluguel → `monthlyPrice`; Condomínio → `condoFee`; "Contas (água, luz, internet)" → `utilitiesEstimate` (só no regime `utilitiesMode = "fixed"`); Total por mês → `calcularTotalMensal` (`src/lib/precos.ts`) | Existe. **Divergências:** ver **Caução** e **Garantia** abaixo. O total deve vir de `calcularTotalMensal`, para bater com a busca e com o cartão do anúncio |
| 9 | `cadastro-imovel-09-disponibilidade` | Período disponível → `availableFrom` / `availableUntil`; Estadia mínima → `minPeriodDays`; grade → bloqueios do dono (`property_blocks`, E44 / #1210) | Existe. A grade com o link iCal já está na etapa, no #1210. **Divergência:** ver **Estadia mínima** abaixo |
| 10 | `cadastro-imovel-10-revisao` | Lista de conferência → `conferenciaAssistente`; cartão → título, quartos, banheiros, área, total | Existe. "Vaga no seu plano" vai para `pendentesNaRevisao` |

**Cartão "Visualização do anúncio"** (todas as telas): título, `bedrooms`, `areaM2`, bairro e cidade, chips (tipo, mobiliado, pets, comodidades) e o estado "Em edição / Rascunho" (`status` = draft). Todos esses dados já existem.

## Divergências do mockup com a regra do produto

Cada uma vem com uma sugestão.

- **Caução (tela 08).** O mockup tem um campo "Caução R$ 2.900" para o dono preencher. Na regra do produto o dono **não digita a caução**: ela é calculada por bloco do contrato. São 50% do bloco, com teto de 3 aluguéis, e zero com seguro-fiança (`caucaoDoBloco`, `REGRAS_CONTRATO`). Por isso não há coluna para caução no anúncio, e não criei nenhuma.
  - Sugestão: trocar o campo por uma linha só de leitura, "Caução: calculada no contrato (até 3 aluguéis)", ao lado da escolha de garantia.
- **Garantia (tela 08).** Escolher pelo menos uma garantia aceita (`garantiasAceitas`) é **obrigatório para publicar** (`garantia` na prontidão), mas o mockup não tem esse elemento. Está mapeada na etapa 8.
- **Estadia mínima (tela 09).** O exemplo seleciona de 5 a 19/10, ou seja, 15 dias de janela, com estadia mínima de 30 dias. Esse anúncio não cabe nunca. O prazo mínimo do produto é de 1 mês (`PRAZO_MIN_MESES`).
  - Sugestão: a janela vira "Disponível a partir de" mais um "até" opcional. A tela avisa quando a janela é menor que a estadia mínima. Os dias ocupados ficam na grade de bloqueios do #1210.
- **Palavras.** As telas 03 e 10 dizem "hóspedes" e "Cobrado ao hóspede". No produto é **morador**, porque não é hospedagem. A tela 10 também diz "Você recebe conforme política de pagamento". Pelo E51–E54, a taxa da Viva é cobrada à parte e nunca sai do que o morador paga.
- **Contas (tela 08).** "Contas (água, luz, internet)" só entra no total no regime de contas fixas. No regime medido, o consumo não entra no total (`contasMedidas`), e a tela precisa da escolha do regime (`utilitiesMode`).

## O que este PR muda

- `regrasCasa.outras`: normalização no servidor (`limparOutrasRegras`, máximo `MAX_OUTRAS_REGRAS` = 280), campo no formulário e no editor, e linha com ícone na folha "Regras da casa".
- Comodidade `tv` no grupo "Conforto do imóvel", com ícone e reconhecimento na importação de anúncio.
- `src/lib/anuncio/assistente-dez-etapas.ts`, com `ETAPAS_ASSISTENTE`, `etapaDoItemProntidao` e `conferenciaAssistente`, para a Pista A consumir.
