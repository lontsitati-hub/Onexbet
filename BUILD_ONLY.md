# OneXBet — archive principale prête à compiler

Cette archive contient uniquement le projet principal OneXBet. L’interface et le projet BotX ne sont pas inclus.

## Installation

```bash
pnpm install --frozen-lockfile
```

## Contrôles

```bash
pnpm run check
pnpm run build
```

## Prévisualisation Web

```bash
pnpm run dev:metro
```

## Compilation Android de prévisualisation

```bash
pnpm run build:apk
```

Les fichiers `node_modules`, `.expo`, `dist` et les captures temporaires ont été retirés pour garder une archive source propre. Le canal de communication Firebase présent dans l’application reste inclus, car il fait partie du fonctionnement du projet principal.
