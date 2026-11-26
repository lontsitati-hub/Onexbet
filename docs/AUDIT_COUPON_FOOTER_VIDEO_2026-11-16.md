# Audit vidéo — coupon et footer — 16 novembre 2026

## Source examinée

Vidéo de référence `RPReplay_Final1794852634.mp4`, durée 20,68 s, format vertical 1320 × 2868 px, vidéo HEVC à fréquence variable proche de 60 i/s. Des captures ont été échantillonnées chaque seconde et des captures ciblées ont été produites autour des écrans Favoris et Menu.

## Constat important sur le coupon

La vidéo ne montre pas l’écran Coupon ouvert. Elle montre uniquement l’icône Coupon dans le footer, sans sélection, sans coupon simple, sans coupon combiné et sans ligne de pari visible. Aucun détail physique supplémentaire du ticket ne peut donc être déduit de cette vidéo sans l’inventer.

Les composants existants `BetHeader`, `BetSummary`, `EventCard` et `TicketSeparator` ont donc été conservés fonctionnellement. Les états métier Simple/Combiné et le contenu des événements n’ont pas été réécrits sur la base d’une observation absente.

## Éléments reproduits depuis la vidéo

- Footer blanc fixe à cinq sections : `Populaire`, `Favoris`, `Coupon`, `Historique`, `Menu`.
- Icônes de footer appliquées directement sur les images, avec une couleur active/inactive calculée par l’onglet courant.
- État actif observé : `Favoris` vers 14,5 s puis `Menu` vers 16,5–17,5 s ; l’ancien onglet ne conserve pas la couleur active.
- Icône Coupon centrale surélevée, avec son propre pictogramme et sans coloration forcée qui détruirait le ticket blanc.
- Typographie de type système, proche de SF Pro sur iOS : taille compacte, libellés gris inactifs et bleu actif.
- Ratios des pictogrammes alignés sur les assets de référence vidéo, environ 30–32 × 27 px.
- Badge rouge du coupon réduit à un format compact, uniquement lorsqu’un coupon brouillon contient des événements ; aucun badge n’est affiché pour le coupon vide observé dans la vidéo.

## Correction appliquée

`src/components/TabBar.tsx` a été ajusté uniquement sur la géométrie visuelle :

- icônes ordinaires fixées à 32 × 27 px pour conserver le ratio observé ;
- bouton Coupon central ramené à 56 × 56 px tout en conservant son léger dépassement ;
- badge réduit à 16 × 16 px ;
- libellés du footer harmonisés à 10 px ;
- aucune logique de navigation, aucun état métier et aucune fonctionnalité non visible n’a été ajoutée.

## Validation

- `pnpm check` : OK
- `pnpm build:web` : OK
- `pnpm test:video-controls` : OK
- le test de navigation/couleurs peut être lancé avec :

```bash
node --import tsx tests/navigation-colors.cjs ./src/utils/navigationColors.ts
```

Les captures de référence et les planches d’analyse sont conservées dans `/home/ubuntu/work/onexbet/reference-video/`.
