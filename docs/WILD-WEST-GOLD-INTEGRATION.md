# Wild West Gold — intégration OneXBet

## Rendu repris du jeu individuel

L’écran de jeu est le composant individuel repris depuis `goldmines-mobile/App.tsx`, porté dans `src/components/wwg/WildWestGoldGame.tsx`. Les 95 fichiers du dossier `goldmines-mobile/assets` sont copiés sous `src/components/wwg/individual-assets/` et utilisés par ce composant : plateau et cases, désert, boutons, panneaux, solde, bannières, icônes, effets de révélation, modales Pari/Victoire et écran Bonus. Le wrapper `src/app/wild-west-gold.tsx` ne dessine aucun élément : il conserve la garde de session et l’activation du jeu.

Les contrôles, les animations, la mise, les modes 2x/3x, les six rangées jouées du bas vers le haut, la révélation des gains, le cashout, la fenêtre de victoire et Bonus gardent le même rendu et le même comportement que la version individuelle. Des vues transparentes au toucher autour de quelques images de fond ne servent qu’à assurer la compatibilité de types avec la version React Native OneXBet; elles ne changent pas les pixels affichés.

## Seule adaptation de portefeuille

Le texte du solde lit directement `useBetStore.balance`. Une perte et un cashout écrivent via `useBetStore.updateBalance`, donc dans le même solde OneXBet et sa persistance locale; il n’y a pas de portefeuille Wild West séparé. Aucune mise n’est débitée au démarrage ni lors d’un choix d’or. La mise est débitée une fois au clic sur une dynamite; le cashout ajoute les gains affichés au solde partagé.

## BotX — préparation de case (comme Apple of Fortune)

Le composant écoute `wild_west_gold_channels/{uid}` pour le compte OneXBet connecté. BotX envoie une commande bornée (`mode` 2 ou 3, rangée 0–5, colonne valide, `commandId` et horodatage). L’index interne `0` correspond à la rangée du bas et à la première rangée jouée; la grille est rendue visuellement de haut en bas. La commande n’est acceptée que pendant une manche active, sur la rangée attendue et dans le même mode. L’application remplace alors la case sûre de cette rangée et répond `prepared`; elle ne clique ni ne révèle la case automatiquement. Le joueur doit toucher précisément la case préparée dans l’écran Wild West Gold. Le statut `revealed` débloque la rangée supérieure dans BotX; une autre case reste verrouillée tant que la commande est en attente. Les commandes expirées (plus de 10 minutes), rejouées ou hors plage sont ignorées.

Les statuts de cycle sont `pending`, `prepared`, `revealed`, `lost`, `unavailable`, `round-started` et `round-ended`. Le canal est limité à l’UID propriétaire actif, refuse les listes et suppressions, et valide le schéma dans `firestore.rules` et le fragment `firestore.rules.botx-snippet`. Si l’application démarre avant que BotX ait créé son document, elle l’initialise atomiquement avec `source: onexbet-app`, `status: round-started`, le marqueur `row: 5` exigé par la règle de création, et un horodatage serveur; à la réception de `round-started`, BotX remet sa progression active à l’index `0` en bas. La règle stricte de reset `validWwgReset` n’autorise que `waiting`/`reset`, les coordonnées `0,0`, un mode `2` ou `3`, une source autorisée, un horodatage serveur et les seules clés prévues. **Le support de reset ajouté ici est local et n’est pas déployé.**

## Comparaison et résultat

Les captures de l’export Web OneXBet et de l’application individuelle ont été rendues en 400 × 816 px. Pour l’accueil, une manche active, les pertes 2x/3x, la fenêtre de mise, la victoire et Bonus, elles sont **pixel-identiques hors rectangle du solde** : erreur absolue moyenne 0 et 100 % des pixels identiques. Le seul changement visuel voulu est donc la valeur actuelle du portefeuille OneXBet dans la capsule de solde.

Les captures vidéo correspondantes et les captures OneXBet sont incluses dans le dossier de comparaison. La composition, le plateau, les textures, les boutons et les modales ont été revus dans chaque état. Il reste une différence fonctionnelle voulue après défaite : conformément à la demande, OneXBet révèle toutes les cases de chaque rangée (mode 2x : 1 or + 1 dynamite; mode 3x : 1 or + 2 dynamites). La vidéo, elle, montre les cases sûres révélées et seulement la dynamite touchée; c’est le seul écart de révélation intentionnel.

## Tests

- `npx tsc --noEmit` — TypeScript sans erreur.
- `npx expo export --platform web` — route `/wild-west-gold` présente.
- Capture Playwright — parcours visuel 2x/3x, mise, victoire et Bonus.
- Parcours portefeuille dans le composant OneXBet : solde 15 000 avant/après démarrage et case sûre, 14 500 après dynamite, inchangé après case sûre 3x, puis 16 000 après cashout de 1 500.
- Tests de logique et de protocole : `node --test tests/wild-west-gold.test.mjs tests/wild-west-compatibility.test.mjs tests/crash-point-balance.test.mjs`.
