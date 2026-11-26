import React, { createContext, useContext, useState } from 'react';

/**
 * Shared round-session state used by both the game screen and the tab bar.
 * When a round is active (or finished and awaiting REPLAY / NEW BET), the
 * bottom tab bar ("Jeu | Historique") stays hidden, like the reference
 * screenshots where only the game chrome is visible during play.
 */
type RoundSessionState = {
  inRound: boolean;
  setInRound: (inRound: boolean) => void;
};

const RoundSessionContext = createContext<RoundSessionState>({
  inRound: false,
  setInRound: () => {},
});

export function RoundSessionProvider({ children }: { children: React.ReactNode }) {
  const [inRound, setInRound] = useState(false);
  return (
    <RoundSessionContext.Provider value={{ inRound, setInRound }}>
      {children}
    </RoundSessionContext.Provider>
  );
}

export function useRoundSession() {
  return useContext(RoundSessionContext);
}
