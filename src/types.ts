export type GameMode = 'classic' | 'time';

export interface BlockData {
  id: string;
  value: number;
  row: number;
  col: number;
}

export type GameStatus = 'menu' | 'playing' | 'gameover';

export interface GameState {
  grid: (BlockData | null)[][];
  score: number;
  highScore: number;
  target: number;
  selectedIds: string[];
  status: GameStatus;
  mode: GameMode;
  timeLeft: number;
  level: number;
}
