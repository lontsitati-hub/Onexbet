export const WILD_WEST_BASE_BOARD_HEIGHT_DP = 335;
export const WILD_WEST_BASE_BOARD_WIDTH_DP = 341;

const TOPBAR_HEIGHT_DP = 39;
const TOOLS_HEIGHT_DP = 45;
const MODE_ROW_HEIGHT_DP = 36;
const CONTROL_HEIGHT_DP = 102;
const MAX_APP_WIDTH_DP = 400;
const BOARD_WIDTH_GUTTER_DP = 60;
const MIN_GAME_TOP_PADDING_DP = 8;
const MAX_GAME_TOP_PADDING_DP = 97;
const BOARD_BASE_CONTENT_HEIGHT_DP = 559;
const MIN_BOARD_SCALE = 0.45;

export interface WildWestLayoutInput {
  width: number;
  height: number;
  topInset?: number;
  bottomInset?: number;
}

export interface WildWestLayout {
  appWidth: number;
  usableHeight: number;
  gameTopPadding: number;
  boardScale: number;
  boardWidth: number;
  boardViewportHeight: number;
  boardScrollHeight: number;
}

export function getWildWestLayout({
  width,
  height,
  topInset = 0,
  bottomInset = 0,
}: WildWestLayoutInput): WildWestLayout {
  const appWidth = Math.max(0, Math.min(width, MAX_APP_WIDTH_DP));
  const usableHeight = Math.max(0, height - topInset - bottomInset);
  const gameTopPadding = Math.max(
    MIN_GAME_TOP_PADDING_DP,
    Math.min(MAX_GAME_TOP_PADDING_DP, usableHeight - BOARD_BASE_CONTENT_HEIGHT_DP),
  );
  const boardViewportHeight = Math.max(
    0,
    usableHeight - TOPBAR_HEIGHT_DP - TOOLS_HEIGHT_DP - MODE_ROW_HEIGHT_DP - CONTROL_HEIGHT_DP - gameTopPadding,
  );
  const boardScale = Math.max(
    MIN_BOARD_SCALE,
    Math.min(1, boardViewportHeight / WILD_WEST_BASE_BOARD_HEIGHT_DP),
  );
  const boardScrollHeight = Math.min(
    boardViewportHeight,
    WILD_WEST_BASE_BOARD_HEIGHT_DP * boardScale,
  );
  const boardWidth = Math.max(0, appWidth - BOARD_WIDTH_GUTTER_DP) * boardScale;

  return {
    appWidth,
    usableHeight,
    gameTopPadding,
    boardScale,
    boardWidth,
    boardViewportHeight,
    boardScrollHeight,
  };
}
