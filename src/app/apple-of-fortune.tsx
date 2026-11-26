/*
 * Apple of Fortune — point d'entrée de l'écran (réinitialisé à 100 % avec le
 * fichier source de l'utilisateur, version 4).
 *
 * L'écran est monté sous les providers du jeu (GameProvider + RoundSessionProvider)
 * qui gèrent intégralement le solde du jeu (100 000 initial), le bonus quotidien,
 * le mode Predictor, les sons, les vibrations et l'historique des parties.
 * La garde d'accès Fast Games (contrôlée par l'admin) reste appliquée par
 * useFocusEffect dans le composant d'écran lui-même.
 */
import React from 'react';
import { GameProvider } from '@/components/aof/v4/game-store';
import { RoundSessionProvider } from '@/components/aof/v4/round-session';
import GameScreen from '@/components/aof/v4/game-screen';

export default function AppleOfFortuneScreen() {
  return (
    <RoundSessionProvider>
      <GameProvider>
        <GameScreen />
      </GameProvider>
    </RoundSessionProvider>
  );
}
