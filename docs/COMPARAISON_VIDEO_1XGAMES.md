# Comparaison vidéo de référence / projet OneXBet

## Captures de référence

La vidéo fournie dure environ 62 secondes, en format vertical 416 × 848, à 60 i/s. Une planche de captures représentatives est disponible ici :

![Captures de référence de la vidéo](video-reference/reference-contact-sheet.jpg)

L’analyse automatique complète est conservée dans [`video-reference/reference-analysis.md`](video-reference/reference-analysis.md).

## Éléments comparés

La vidéo montre une interface mobile 1xBET claire, avec une barre supérieure contenant le profil, le solde, la recherche et le bouton « Déposer », une navigation secondaire avec « Populaires », « Sports », « E-sport », « Casino », « 1xGames » et « Autre », puis une navigation basse avec « Populaire », « Favoris », « Coupon », « Historique » et « Menu ».

Le projet contient déjà plusieurs éléments correspondants : barre de navigation basse, navigation de sports, catégories Casino, navigation 1xGames, cartes de matchs, sections de jeux et loader sans vidéo. Les éléments dépendant d’un compte, de données distantes ou d’écrans non présents n’ont pas été recréés.

## Modifications appliquées dans 1xGames

L’ordre des sections et les libellés ont été rapprochés de la vidéo :

1. `Tendance`
2. `Pour vous`
3. `Meilleur`
4. `Machines à sous`
5. `Escalier du succès`
6. `Dés`
7. `Jeux de cartes`
8. `Loteries`
9. `Autres jeux`

Les libellés disponibles et compatibles avec les assets du projet ont été conservés avec leur casse et leurs accents :

- `Apple Of Fortune`
- `Plinko`
- `Royal Crystals`
- `Crystal`
- `Crash`
- `Burning Hot`
- `Lucky Wheel`
- `Faire tourner la roue` — déjà intégré dans l’image de la bannière Lucky Wheel
- `Wild West Gold`
- `Under and Over 7`
- `Yahtzee`
- `Dice`
- `Five Dice Poker`
- `Solitaire`
- `21`
- `Crash Point`
- `Spin and Win`
- `Thimbles`
- `Dominoes`
- `Fruit Blast`

## Éléments volontairement non inventés

La vidéo présente aussi `X-Keno`, `Relics of Zeus`, `Gems & Mines`, `Kamikaze`, `Lucky Card` et `Solitaire Battle Arena`. Ces éléments n’ont pas d’asset ou d’écran correspondant dans le projet analysé. Ils n’ont donc pas été ajoutés artificiellement et aucune fausse route n’a été créée pour eux.

Le projet utilise encore certains équivalents disponibles lorsque la catégorie de la vidéo existe mais que le jeu exact manque, par exemple `Gems Odyssey` ou `Eastern Nights` dans les sections correspondantes. Ces différences sont documentées plutôt que masquées.

## Typographie et style des libellés

Les libellés ont été rapprochés du rendu de la vidéo. Les titres de catégories sont maintenant du texte bleu foncé simple, avec une graisse forte et sans capsule bordée. Le bouton `Tout` est une petite pastille claire sans contour bleu. Les noms des jeux sont des libellés simples centrés sous les images, sans fond, sans bordure et sans capsule ; leur graisse est normale/semi-moyenne et leur interligne permet les retours à la ligne comme dans `Under and Over 7` ou `Solitaire Battle Arena`.

Les captures zoomées utilisées pour cette comparaison sont disponibles dans [`video-reference/1xgames-headings-reference.jpg`](video-reference/1xgames-headings-reference.jpg) et [`video-reference/1xgames-labels-reference.jpg`](video-reference/1xgames-labels-reference.jpg).

## Adaptations hors jeux

Après comparaison avec les captures de l’écran Menu, le bouton de dépôt affiche maintenant exactement `Déposer` pour un utilisateur standard, sans l’icône supplémentaire qui n’apparaît pas dans la vidéo. La carte `Assistance client` a été renommée `Assistance`, conformément au libellé visible dans la vidéo. Les cartes du menu sont désormais organisées en deux colonnes, tandis que la carte promo reste pleine largeur, comme dans la capture de référence.

Les autres différences qui dépendent d’éléments absents, de données utilisateur ou d’un écran non montré dans la vidéo n’ont pas été modifiées.

## Complétion des rangées 1xGames

Chaque section 1xGames contient maintenant exactement quatre assets : `Tendance`, `Pour vous`, `Meilleur`, `Machines à sous`, `Escalier du succès`, `Dés`, `Jeux de cartes`, `Loteries` et `Autres jeux`. Les emplacements supplémentaires réutilisent uniquement des assets déjà présents dans le projet. Les jeux sans asset de référence, notamment X-Keno, Lucky Card et Solitaire Battle Arena, n’ont pas été fabriqués.

## Transparence des icônes Coupon

Les six icônes Coupon utilisées par les styles `blue`, `light_green`, `green`, `gold`, `red_mega` et `royal_blue` ont été contrôlées en RGBA : elles possèdent toutes des pixels transparents dans les coins afin de laisser apparaître le fond dynamique de l’application. L’ancien asset `icon_coupon_tab_royal.png` était une image RGB opaque avec un carré blanc intégré. Il est conservé comme référence, mais le rendu utilise désormais `icon_coupon_tab_royal_transparent.png`, dont le contour circulaire est transparent à l’extérieur du badge. La prévisualisation des thèmes utilise le même asset corrigé.

## Splash MegaParis

Le splash du thème `red_mega` utilise maintenant un fond noir. Le logo de démarrage est une variante dédiée claire, `megapari-splash-horizontal.png`, avec `MEGA` et `PARI` sur une seule ligne horizontale et les deux points bleu et rouge superposés comme séparateur central. Pour garantir une bonne visibilité sur mobile, le logo MegaPari utilise une largeur de 94 % et une hauteur de 24 % de l’écran. Le loader reste rouge et est positionné plus bas pour conserver un espace visuel proche du splash de référence noir. Le logo des pages de l’application, notamment Populaire, reste volontairement l’ancien `megapari-logo-transparent.png` ; la variante horizontale est réservée au splash.

## Validation

- TypeScript : OK.
- Tests de lancement : 10 réussis.
- Tests vidéo : 5 réussis.
- Prévisualisation Web : HTTP 200.
- Les vidéos de démarrage restent absentes.
- Les modifications sont limitées aux catégories/libellés 1xGames et à la documentation de comparaison.
