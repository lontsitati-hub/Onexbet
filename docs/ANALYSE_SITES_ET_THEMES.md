# Analyse des sites et des thèmes

## Nombre de sites configurés

L’application contient six identités de site sélectionnables depuis l’écran de personnalisation :

1. **1xBet** — thème `blue`
2. **WinWin** — thème `light_green`
3. **Linebet** — thème `green`
4. **Paripesa** — thème `royal_blue`
5. **Melbet** — thème `gold`
6. **MegaPari / Red Mega** — thème `red_mega`

## Adaptations réalisées

- Le splash screen est désormais déterminé par le thème chargé : logo de la marque active, couleur d’accent et fond propres à la marque.
- Les logos partenaires du splash historique 1xBet ne sont plus affichés pour les autres sites.
- Les couleurs des boutons « + », des accès portefeuille et des actions de dépôt sont centralisées dans `getThemeAccentColor`.
- Le vert est conservé pour les accès « + » et dépôt de **1xBet uniquement** ; les autres sites utilisent leur accent : vert lime, vert émeraude, bleu royal, or ou rouge MegaPari.
- Les valeurs vertes codées en dur ont été retirées des jeux Aviator, Crash Point et de l’écran Historique.
- Le test de branding couvre désormais les six marques.

## Vérifications

- `pnpm exec tsc --noEmit` : OK
- Test branding : OK — 6 marques, 4 modes de fond, 144 transitions
