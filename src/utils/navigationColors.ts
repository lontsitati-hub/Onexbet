/** Couleurs de sélection instantanées pour les rails de navigation. */
export function getNavigationInactiveColor(backgroundMode: string): string {
  // Le gris dépend seulement du fond, jamais de la couleur de marque.
  return backgroundMode === 'light' ? '#78818B' : '#ABB3BC';
}

export function getNavigationItemColor(
  active: boolean,
  activeColor: string,
  inactiveColor: string,
): string {
  return active ? activeColor : inactiveColor;
}
