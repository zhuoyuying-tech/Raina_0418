/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Play, 
  Clock, 
  Settings, 
  Volume2, 
  VolumeX,
  Target,
  Gamepad2,
  ChevronLeft
} from 'lucide-react';
import { 
  GRID_COLS, 
  GRID_ROWS, 
  VISIBLE_ROWS, 
  INITIAL_ROWS, 
  MAX_BLOCK_VALUE, 
  MIN_BLOCK_VALUE, 
  TIME_MODE_DURATION,
  POINTS_PER_BLOCK,
  COMBO_BONUS 
} from './constants';
import { 
  GameMode, 
  BlockData, 
  GameStatus, 
  GameState 
} from './types';

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function App() {
  const [status, setStatus] = useState<GameStatus>('menu');
  const [mode, setMode] = useState<GameMode>('classic');
  const [grid, setGrid] = useState<(BlockData | null)[][]>([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('numerix_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [target, setTarget] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [timer, setTimer] = useState(TIME_MODE_DURATION);
  const [level, setLevel] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  // Initialize/Reset Game
  const initGame = useCallback((gameMode: GameMode) => {
    const newGrid: (BlockData | null)[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    
    // Fill bottom rows
    for (let r = GRID_ROWS - 1; r >= GRID_ROWS - INITIAL_ROWS; r--) {
      for (let c = 0; c < GRID_COLS; c++) {
        newGrid[r][c] = {
          id: generateId(),
          value: getRandomInt(MIN_BLOCK_VALUE, MAX_BLOCK_VALUE),
          row: r,
          col: c
        };
      }
    }

    setGrid(newGrid);
    setScore(0);
    setMode(gameMode);
    setStatus('playing');
    setTimer(TIME_MODE_DURATION);
    setLevel(1);
    setIsNewHighScore(false);
    
    // Random target between 5 and 20
    setTarget(getRandomInt(5, 20));
    setSelectedIds([]);
  }, []);

  // Update High Score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      setIsNewHighScore(true);
      localStorage.setItem('numerix_highscore', score.toString());
    }
  }, [score, highScore]);

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'playing' && mode === 'time') {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            addNewRow();
            return TIME_MODE_DURATION;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, mode]);

  // Add new row at bottom
  const addNewRow = useCallback(() => {
    setGrid((currentGrid) => {
      const newGrid = [...currentGrid.map(row => [...row])];
      
      // Check if top row has blocks (Game Over)
      const hasTopRowBlocks = newGrid[0].some(block => block !== null);
      if (hasTopRowBlocks) {
        setStatus('gameover');
        return currentGrid;
      }

      // Shift existing blocks UP
      for (let r = 0; r < GRID_ROWS - 1; r++) {
        newGrid[r] = newGrid[r + 1].map(block => {
          if (block) {
            return { ...block, row: r };
          }
          return null;
        });
      }

      // Add new row at the bottom
      newGrid[GRID_ROWS - 1] = Array(GRID_COLS).fill(null).map((_, c) => ({
        id: generateId(),
        value: getRandomInt(MIN_BLOCK_VALUE, MAX_BLOCK_VALUE),
        row: GRID_ROWS - 1,
        col: c
      }));

      return newGrid;
    });
  }, []);

  // Apply Gravity
  const applyGravity = useCallback(() => {
    setGrid((currentGrid) => {
      const newGrid = [...currentGrid.map(row => [...row])];
      let changed = false;

      for (let c = 0; c < GRID_COLS; c++) {
        const column: (BlockData | null)[] = [];
        for (let r = 0 ; r < GRID_ROWS; r++) {
          if (newGrid[r][c]) {
            column.push(newGrid[r][c]);
          }
        }

        // Fill top with nulls
        const nullsCount = GRID_ROWS - column.length;
        const newColumn = [...Array(nullsCount).fill(null), ...column];

        // Update rows
        for (let r = 0; r < GRID_ROWS; r++) {
          if (newGrid[r][c]?.id !== (newColumn[r]?.id || null)) {
            changed = true;
          }
          newGrid[r][c] = newColumn[r] ? { ...newColumn[r]!, row: r } : null;
        }
      }

      return changed ? newGrid : currentGrid;
    });
  }, []);

  // Handle Block Click
  const handleBlockClick = (id: string) => {
    if (status !== 'playing') return;

    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(pId => pId !== id);
      }
      return [...prev, id];
    });
  };

  const [isShaking, setIsShaking] = useState(false);

  // Logic to process selection
  useEffect(() => {
    if (selectedIds.length === 0) return;

    // Find selected items
    const selectedBlocks = grid.flat().filter(b => b && selectedIds.includes(b.id)) as BlockData[];
    const currentSum = selectedBlocks.reduce((acc, b) => acc + b.value, 0);

    if (currentSum === target) {
      // SUCCESS
      const points = selectedIds.length * POINTS_PER_BLOCK + (selectedIds.length > 2 ? COMBO_BONUS * (selectedIds.length - 2) : 0);
      setScore(prev => prev + points);
      
      setGrid(currentGrid => {
        const newGrid = currentGrid.map(row => 
          row.map(block => block && selectedIds.includes(block.id) ? null : block)
        );
        return newGrid;
      });

      setSelectedIds([]);
      setTarget(getRandomInt(5, 20 + Math.floor(score / 500))); 
      setTimeout(applyGravity, 200);

      if (mode === 'classic') {
        setTimeout(addNewRow, 500);
      } else {
        setTimer(prev => Math.min(TIME_MODE_DURATION, prev + 3));
      }
    } else if (currentSum > target) {
      // FAIL (Too much) - Shake and Reset
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        setSelectedIds([]);
      }, 400);
    }
  }, [selectedIds, target, grid, applyGravity, addNewRow, mode, score]);

  // Color mapping for numbers based on the theme
  const getColor = (val: number) => {
    const colors = [
      'bg-slate-700/50 text-slate-400', // 0 (empty)
      'bg-block-1 text-white',      // 1
      'bg-block-2 text-white',      // 2
      'bg-block-3 text-white',      // 3
      'bg-block-4 text-white',      // 4
      'bg-block-5 text-white',      // 5
      'bg-block-6 text-white',      // 6
      'bg-block-7 text-white',      // 7
      'bg-block-8 text-white',      // 8
      'bg-block-9 text-white',      // 9
    ];
    return colors[val] || colors[0];
  };

  return (
    <div className="min-h-screen bg-game-bg text-game-text-p font-sans selection:bg-game-accent selection:text-black flex flex-col items-center justify-center p-4">
      {/* Wrapper to handle sidebar layout on larger screens */}
      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 items-start justify-center">
        
        {/* Sidebar / Left Panel */}
        <div className="w-full lg:w-72 flex flex-col gap-6 shrink-0">
          {status === 'playing' ? (
            <>
              {/* Target Panel */}
              <div className="glass-panel radial-target rounded-3xl p-6 text-center border-2 border-game-accent/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 px-3 py-1 bg-game-accent/10 text-game-accent border-b border-r border-game-accent/20 text-[10px] font-black tracking-widest uppercase rounded-br-lg">
                  {mode === 'classic' ? 'Classic' : 'Time Attack'}
                </div>
                
                <span className="text-[11px] uppercase tracking-[0.2em] text-game-text-s font-bold mb-2 block">Target Sum</span>
                <div className="text-7xl font-black text-game-accent drop-shadow-[0_0_15px_rgba(56,189,248,0.5)] mb-4">
                  {target}
                </div>

                {mode === 'time' && (
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-4">
                    <motion.div 
                      className="h-full bg-game-accent shadow-[0_0_10px_var(--color-game-accent)]"
                      initial={false}
                      animate={{ width: `${(timer / TIME_MODE_DURATION) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Stats Panel */}
              <div className="glass-panel rounded-3xl p-6 space-y-4">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-game-text-s font-bold block mb-1">Score</span>
                  <div className="text-4xl font-black tabular-nums text-game-text-p drop-shadow-glow">
                    {score.toLocaleString()}
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-game-text-s font-bold block mb-1">High Score</span>
                    <div className="text-xl font-black tabular-nums text-game-text-p/80">
                      {highScore.toLocaleString()}
                    </div>
                  </div>
                  <Trophy className="w-6 h-6 text-amber-500/50" />
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-2 gap-3 mt-auto">
                <button 
                  onClick={() => setStatus('menu')}
                  className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Menu
                </button>
                <button 
                  onClick={() => initGame(mode)}
                  className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors"
                >
                  Reset
                </button>
              </div>
            </>
          ) : (
            <div className="hidden lg:block h-[600px]" /> /* Spacer for alignment */
          )}
        </div>

        {/* Center / Grid Area */}
        <div className="flex-1 flex flex-col items-center">
          {/* Main Game Container */}
          <motion.div 
            animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="relative w-full max-w-md aspect-[6/9] bg-game-bg rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800/80"
          >
            <AnimatePresence mode="wait">
              {status === 'menu' && (
                <motion.div 
                  key="menu"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-game-bg via-game-surface to-indigo-950 z-20"
                >
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="mb-8 p-6 bg-game-accent rounded-[2.5rem] shadow-2xl shadow-game-accent/20"
                  >
                    <Gamepad2 className="w-16 h-16 text-black" />
                  </motion.div>
                  
                  <h1 className="text-5xl font-black mb-2 text-game-text-p tracking-tight">NUMERIX</h1>
                  <p className="text-game-text-s mb-12 text-center text-[10px] font-black tracking-[0.3em]">SUM STRIKE SYSTEM ACTIVE</p>

                  <div className="w-full space-y-4 max-w-xs">
                    <button 
                      onClick={() => initGame('classic')}
                      className="w-full py-5 px-8 bg-block-3 hover:brightness-110 text-black font-black rounded-2xl transition-all active:scale-95 flex items-center justify-between group"
                    >
                      <span className="text-sm tracking-widest uppercase">Classic Pulse</span>
                      <Play className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button 
                      onClick={() => initGame('time')}
                      className="w-full py-5 px-8 bg-block-1 hover:brightness-110 text-white font-black rounded-2xl transition-all active:scale-95 flex items-center justify-between group"
                    >
                      <span className="text-sm tracking-widest uppercase">Time Override</span>
                      <Clock className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    </button>
                  </div>

                  <div className="mt-12 flex items-center gap-2 px-6 py-2 bg-white/5 rounded-full border border-white/10">
                    <Trophy className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] font-black text-game-text-s tracking-widest uppercase">Record: {highScore.toLocaleString()}</span>
                  </div>
                </motion.div>
              )}

              {status === 'playing' && (
                <motion.div 
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 p-3 grid grid-cols-6 grid-rows-10 gap-2 bg-black/40"
                >
                  {grid.map((row, r) => 
                    row.map((block, c) => (
                      <div key={`cell-${r}-${c}`} className="relative w-full h-full bg-white/5 rounded-lg overflow-hidden">
                        <AnimatePresence>
                          {block && (
                            <motion.button
                              layoutId={block.id}
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0 }}
                              onClick={() => handleBlockClick(block.id)}
                              className={`
                                absolute inset-0 flex items-center justify-center text-xl font-black rounded-lg transition-all active:scale-95 border-b-4 border-black/30 shadow-block
                                ${getColor(block.value)}
                                ${selectedIds.includes(block.id) ? 'outline-4 outline-white -outline-offset-4 ring-4 ring-white/40 scale-95 brightness-125' : ''}
                                ${r < (GRID_ROWS - VISIBLE_ROWS) ? 'brightness-[0.15] grayscale pointer-events-none' : ''}
                              `}
                              whileHover={{ scale: 1.05 }}
                            >
                              {block.value}
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </div>
                    ))
                  )}

                  {/* Grid Top Indicator */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-block-1/40 blur-[1px] z-10" />
                </motion.div>
              )}

              {status === 'gameover' && (
                <motion.div 
                  key="gameover"
                  initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                  animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
                  className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-black/80 z-30"
                >
                  <div className="mb-6 p-4 bg-block-1 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                    <Trophy className="w-12 h-12 text-white" />
                  </div>

                  <h2 className="text-4xl font-black mb-2 text-white italic tracking-tighter">CIRCUIT BREAKER</h2>
                  <p className="text-game-text-s mb-8 font-black text-[10px] tracking-[0.2em] uppercase">Stack depth exceeded</p>

                  <div className="w-full p-8 bg-game-surface rounded-3xl border border-white/10 mb-8 text-center shadow-2xl">
                    <div className="mb-4">
                      <span className="text-[10px] uppercase tracking-[0.3em] text-game-text-s font-bold">Final Payload</span>
                      <div className="text-6xl font-black tabular-nums text-white mt-2 drop-shadow-glow">
                        {score.toLocaleString()}
                      </div>
                    </div>
                    
                    {isNewHighScore && (
                      <div className="inline-block px-4 py-1 bg-game-accent text-black text-[10px] font-black rounded-full mb-4 animate-[pulse_1s_infinite]">
                        NEW SYSTEM RECORD
                      </div>
                    )}
                  </div>

                  <div className="w-full flex gap-4 max-w-xs">
                    <button 
                      onClick={() => setStatus('menu')}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest border border-white/10 transition-all"
                    >
                      Exit
                    </button>
                    <button 
                      onClick={() => initGame(mode)}
                      className="flex-[2] py-4 bg-game-accent hover:brightness-110 text-black font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                    >
                      Reboot
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Selection Bar / Selection Tray Aesthetic */}
          {status === 'playing' && (
            <div className="w-full max-w-md mt-6 glass-panel rounded-2xl p-4 flex flex-col items-center gap-3">
              <span className="text-[9px] uppercase tracking-[0.2em] text-game-text-s font-bold">Current Selection Buffer</span>
              <div className="flex gap-3 overflow-x-auto w-full justify-center scrollbar-hide">
                {selectedIds.length === 0 ? (
                  <div className="text-game-text-s font-black italic text-[11px] uppercase tracking-widest opacity-30 py-2">
                    Awaiting input signals...
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {grid.flat().filter(b => b && selectedIds.includes(b.id)).map((block, idx) => (
                      <React.Fragment key={block!.id}>
                        {idx > 0 && <span className="text-white/30 font-black">+</span>}
                        <motion.div 
                          initial={{ scale: 0, y: 10 }}
                          animate={{ scale: 1, y: 0 }}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg font-black text-sm shadow-lg ${getColor(block!.value)}`}
                        >
                          {block!.value}
                        </motion.div>
                      </React.Fragment>
                    ))}
                    <span className="text-white/30 font-black">=</span>
                    <div className={`
                      px-4 h-10 flex items-center justify-center rounded-lg font-black text-lg min-w-[3rem]
                      ${grid.flat().filter(b => b && selectedIds.includes(b.id)).reduce((acc, b) => acc + (b ? b.value : 0), 0) < target ? 'bg-white/5 text-game-text-s border border-white/10' : 'bg-game-accent text-black shadow-[0_0_15px_var(--color-game-accent)]'}
                    `}>
                      {grid.flat().filter(b => b && selectedIds.includes(b.id)).reduce((acc, b) => acc + (b ? b.value : 0), 0)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Instructions / Mobile Tips */}
      <div className="mt-12 text-game-text-s text-[9px] uppercase tracking-[0.4em] font-black text-center max-w-xs space-y-2 opacity-50">
        <p>IDENTIFY SUMS TO PURGE BLOCKS</p>
        <p>TERMINATE STACK BEFORE HAZARD THRESHOLD</p>
      </div>
    </div>
  );
}
