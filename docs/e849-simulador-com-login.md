# E849: o banner do simulador diz que ele fica na conta

Foto da main: `27dbdf1`. Origem: Phoenix RELATORIO-017, A-39 (12/11/2026).

## O que a Phoenix viu × o código da main

1. **Uso livre × login.** O banner "Simulador de rentabilidade" de `/para-proprietarios` dizia "Estime… com os números que você digitar", mas o botão leva a `/dashboard/simulador`, que pede login. **Isso se confirma no código.**
2. **Simulador "expandido no primeiro carregamento", pré-preenchido com R$ 4.320 / 3 meses / "Você recebe R$ 11.404,80".** Isso **não está** no código da main. A página só tem o banner, sem números, e o card "Quanto você paga" (`ComparativoPrecos` curto), cujo exemplo fixo é 3 meses × R$ 4.320 (`config/compare-precos.ts`). Não há nenhum "Você recebe R$ 11.404,80" em `src/`. O simulador de `/dashboard/simulador` começa vazio (`entradaVazia`, E294).
   - O que a Phoenix viu na primeira carga provavelmente era uma versão antiga da página, servida de cache ou de outro deploy. Isso não se corrige em código.

## Correção (parte 1)

- **Texto:** "…com os números que você digitar, **na sua conta**. A Viva não preenche valor nenhum por você."
- **Botão:** "Calcular rentabilidade **(com login)**", no mesmo padrão do "Anunciar imóvel (com login)" do rodapé.

## Teste

`node --test src/lib/e849-simulador-com-login.test.ts`:
- **main:** 1 fail, porque o banner não avisa do login.
- **branch:** 2 pass.

Testes do escopo (E718, estilo, SEO das páginas públicas): **66 pass / 0 fail**. tsc limpo, consistência OK.
