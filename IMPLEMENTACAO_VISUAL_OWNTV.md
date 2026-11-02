# Hypeou - atualização visual inspirada no OwnTV

## O que foi alterado

- Criada a camada `src/styles/owntv-inspired.css`, carregada depois dos estilos principais.
- Home com fundo mais neutro, destaque cinematográfico, fileiras e cartões mais próximos da linguagem visual do OwnTV.
- Em modo TV (`.modo-tv`), a navegação superior passa a ser uma barra lateral fixa, com rótulos visíveis e alvos maiores para D-pad.
- No mobile, o destaque e as prateleiras foram ajustados para telas estreitas e a navegação inferior ganhou acabamento mais consistente.
- Cores de foco próprias para controle remoto e destaque de foco acessível.

## O que foi preservado

Nenhum componente funcional, rota, serviço, player, parser de listas, integração, estado ou armazenamento foi substituído. A alteração é uma camada CSS de apresentação aplicada ao app React/Vite atual.

## Arquivos modificados/adicionados

- Modificado: `src/App.tsx` (importa a nova folha de estilos).
- Adicionado: `src/styles/owntv-inspired.css`.

## Validação

A conferência estática dos delimitadores CSS e do import foi concluída. A compilação TypeScript/Vite não pôde ser executada neste ambiente porque as dependências npm não estavam instaladas e `npm ci` excedeu o tempo disponível. Execute localmente:

```bash
npm ci
npm run build
```

## Teste recomendado

- Desktop: `http://localhost:5173/?modo=tv` para inspecionar a navegação lateral e o foco de controle remoto.
- Celular: abrir pelo navegador ou emulador Android em largura de 360-430 px.
- Android TV: testar com controle remoto real, principalmente foco entre menu, hero e fileiras.
