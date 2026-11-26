# Rapport de conformité aux vidéos — Aviator et Apple of Fortune

## Changements appliqués

### Aviator — zone de mise uniquement

- Remplacement des cinq mises rapides `65 / 130 / 260 / 520 / 1 000` par `1 / 2 / 5 / 10`, en grille 2 × 2 sous le champ de montant.
- Affichage du montant saisi à deux décimales (par exemple `1.00`) et du montant/devise sur le bouton principal `Bet`.
- Réduction de la hauteur du panneau et de ses commandes pour rapprocher la proportion du gros bouton vert, de la rangée de montant et des mises rapides de la capture vidéo (480 × 784).
- Ajustement du vert du bouton BET à `#1F9C09`, mesuré sur la vidéo. Les deux panneaux et les onglets `Bet`/`Auto` restent pressables; leur structure et leur séparation n’ont pas été modifiées.
- Aucun changement au logo, au texte `FUN MODE` ni à la zone de jeu.

**Devise :** la vidéo affiche `USD`, mais le solde et le moteur de mise de cette application utilisent `XAF` sans taux de conversion dans le projet. Pour éviter d’annoncer un montant en dollars alors que le moteur le débite comme des francs CFA, les contrôles restent libellés `XAF`. L’apparence et la structure des boutons sont rapprochées de la vidéo; le libellé de devise ne peut pas être identique sans décision explicite sur une conversion ou un changement de devise pour le jeu.

### Apple of Fortune — mise, boutons et progression du plateau

- Ajout du bouton pressable `X/2` à côté de `MIN`, `X2` et `MAX`; il divise la mise par deux sans passer sous la mise minimale.
- Ajout d’un défilement vertical animé d’un cran après chaque paire de pommes réussies. La colonne des multiplicateurs et la grille se déplacent ensemble; le décalage atteint est conservé sur l’écran de résultat puis réinitialisé au démarrage d’une nouvelle manche.
- Mise à dimensions identiques des boutons `REJOUER ?` et `NOUVELLE MISE` (38 unités de haut, même largeur max. 286) et des surfaces « gains actuels » / « récupérer les gains » (38 unités de haut, même largeur max. 286), conformément aux égalités demandées; les frames mesurent environ 285 × 38 px pour `REJOUER ?` et 285 × 39 px pour `NOUVELLE MISE`.
- Le bouton `REJOUER ?` utilise le bleu vidéo `#3D7FCB`; `NOUVELLE MISE` garde une surface transparente. Le retrait actif reprend le bleu relevé (dominante RGB 61,127,203) et son état désactivé emploie cette même teinte atténuée, plutôt qu’une autre couleur opaque.
- La pilule « gains actuels » et les surfaces d’action partagent les mêmes paramètres d’ombre dans le code; cette égalité de paramètres est testée statiquement. MIN, X2, X/2, MAX et JOUER exposent des libellés accessibles sans changement visuel.
- Les boutons et cellules interactifs sont des `Pressable` avec gestionnaires. `Auto` reste un sélecteur visuel présent dans la zone Aviator; l’automatisation des mises n’a pas été ajoutée, car son fonctionnement n’est pas établi par les extraits fournis.

### Aviator — ajustement visuel complémentaire du 23 novembre 2026

- Modification limitée au rendu visuel dans `flightProjection.ts` et `GameViewport.tsx` : la courbe monte jusqu’au repère d’environ 1,85×, puis oscille régulièrement entre deux niveaux visuels correspondant aux repères 1,80× et 2,50×.
- L’orientation de l’avion est maintenant constante : la compensation de 11,9° neutralise le cabrage intrinsèque de l’image afin que le fuselage reste horizontal pendant le vol et lors du crash.
- **Aucune modification de la logique de jeu** : multiplicateur réellement encaissable, calcul du cashout, seuil et possibilité de crash, et calcul des gains restent inchangés. Seule la projection (hauteur de la courbe et position verticale correspondante de l’avion) varie.
- Test ciblé ajouté : `tests/aviator-flight-projection.test.mjs` vérifie la montée initiale, les limites de la bande et le retour après un cycle.

## Vérifications

- `pnpm check` : réussi après les dernières corrections.
- `pnpm build:web` : réussi; les routes Aviator et Apple of Fortune figurent dans l’export.
- Suite ciblée `node --import tsx --test tests/aviator-flight-projection.test.mjs tests/aof-reference-layout.test.mjs tests/aof-visual-conformance.test.mjs tests/aof-visibility.test.mjs` : 13 tests réussis, 0 échec.

## Captures et comparaison visuelle

Les vidéos ont été relevées à leurs résolutions d’origine : Aviator 480 × 784 et Apple of Fortune 416 × 848. Les frames extraites servent à relever les dimensions et les couleurs de référence. L’aperçu de l’application reste bloqué sur le splash; aucune capture valide du jeu après les dernières corrections n’est disponible. La comparaison porte donc sur les références vidéo et l’implémentation source, pas sur un rendu exécuté comparé pixel par pixel. Une validation visuelle finale reste à faire sur un appareil ou dans un aperçu qui atteint effectivement les écrans de jeu.

Les comportements de `Auto` et les transitions de jeu non montrés dans les extraits vidéo n’ont pas été inventés; seul le sélecteur pressable déjà présent a été conservé.
