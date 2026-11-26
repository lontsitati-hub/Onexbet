# Vérification de prévisualisation — jeux et démarrage

Date : 12 novembre 2026

## Résultat

La prévisualisation Web Expo a été lancée avec `EXPO_PUBLIC_AOF_PREVIEW=1`. L’écran principal répond en HTTP 200 et reste affiché après navigation entre les onglets Populaires, Casino et 1xGames.

Les quatre routes de jeu ont été ouvertes directement et leurs composants principaux ont été vérifiés :

- Apple of Fortune : écran initial affiché, bouton `JOUER` exécuté, manche active affichée sans fermeture.
- Wild West Gold : écran initial affiché, bouton `Jouer` exécuté, plateau de manche active affiché sans fermeture.
- Aviator : écran initial affiché, bouton `Bet` exécuté, état `CASH OUT` affiché sans fermeture.
- Crash Point : écran initial affiché, bouton `PARI` exécuté, état `ACCEPTÉ` affiché sans fermeture.

Après correction, les tuiles affichent un écran de chargement animé natif pendant la préparation de la route, puis ouvrent le jeu sans charger de vidéo de transition. Aucun écran d’arrêt, erreur fatale ou page blanche n’a été observé dans le navigateur Sandbox.

## Captures

![Apple of Fortune — démarrage](qa-screenshots/apple-of-fortune-start.webp)

![Wild West Gold — démarrage](qa-screenshots/wild-west-gold-start.webp)

![Aviator — démarrage](qa-screenshots/aviator-start.webp)

![Crash Point — démarrage](qa-screenshots/crash-point-start.webp)

## Contrôles automatisés

- `pnpm check` : réussi.
- `pnpm test:game-launch` : 5 tests réussis.
- `pnpm test:video-controls` : 4 tests réussis.
- `pnpm test:game-logic` : 8 tests réussis.
- `curl http://127.0.0.1:8081/` : HTTP 200.

Le mode `EXPO_PUBLIC_AOF_PREVIEW=1` autorise uniquement les quatre jeux pour la QA visuelle locale. La garde de session normale reste inchangée lorsque cette variable n’est pas activée. Cette prévisualisation Web ne remplace pas un test sur appareil Android physique ; elle ne peut pas confirmer le comportement du système Android face à un arrêt natif de processus.
