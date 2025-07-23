import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Minus, Plus, Plane, Timer } from 'lucide-react';
import crashMultipliers from '@/data/crashMultipliers';

type GamePhase = 'betting' | 'flying' | 'crashed';

interface Bet {
  id: string;
  playerId: string;
  amount: number;
  multiplier?: number;
  winAmount?: number;
  cashoutMultiplier?: number;
  cashedOut?: boolean;
  isUserBet?: boolean;
}

interface PreviousMultiplier {
  value: number;
  color: string;
}

const PRESET_AMOUNTS = [100, 200, 500, 20000];
const BETTING_PHASE_DURATION = 6; // seconds

// Mock player IDs (no avatars)
const MOCK_PLAYERS = [
  '2***1', '2***2', '2***0', '2***4', '2***5',
  '2***8', '2***3', '2***7', '2***6', '2***9',
  '3***1', '3***2', '3***3', '3***4', '3***5',
  '4***1', '4***2', '4***3', '4***4', '4***5',
  '5***1', '5***2', '5***3', '5***4', '5***5',
];

const INITIAL_PREVIOUS_MULTIPLIERS: PreviousMultiplier[] = [
  { value: 5.48, color: 'text-purple-400' },
  { value: 2.08, color: 'text-green-400' },
  { value: 1.51, color: 'text-green-400' },
  { value: 1.73, color: 'text-green-400' },
  { value: 12.06, color: 'text-pink-400' },
  { value: 1.44, color: 'text-green-400' },
  { value: 1.03, color: 'text-red-400' },
  { value: 3.53, color: 'text-blue-400' },
  { value: 3.23, color: 'text-blue-400' },
  { value: 3.75, color: 'text-blue-400' },
  { value: 13.84, color: 'text-pink-400' },
  { value: 1.17, color: 'text-green-400' },
  { value: 1.40, color: 'text-green-400' },
  { value: 1.32, color: 'text-green-400' },
  { value: 29.21, color: 'text-pink-500' },
  { value: 6.71, color: 'text-purple-400' },
];

function App() {
  const [gamePhase, setGamePhase] = useState<GamePhase>('betting');
  const [countdown, setCountdown] = useState<number>(BETTING_PHASE_DURATION);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.00);
  const [balance, setBalance] = useState<number>(50000);
  const [betAmount, setBetAmount] = useState<number>(100);
  const [userBet, setUserBet] = useState<Bet | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [previousMultipliers, setPreviousMultipliers] = useState<PreviousMultiplier[]>(INITIAL_PREVIOUS_MULTIPLIERS);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [multiplierIndex, setMultiplierIndex] = useState<number>(0);
  const [totalBets, setTotalBets] = useState<number>(0);
  const [displayedBetCount, setDisplayedBetCount] = useState<number>(0);
  const [progress, setProgress] = useState(0);
  const betCountIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const betCountTickRef = useRef<number>(0);
  const [showCrashUI, setShowCrashUI] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Add audio refs for flying and crash sounds
  const flyingAudioRef = useRef<HTMLAudioElement | null>(null);
  const crashAudioRef = useRef<HTMLAudioElement | null>(null);

  // Use public/ directory for audio files
  useEffect(() => {
    if (!flyingAudioRef.current) {
      flyingAudioRef.current = new Audio('/flying.mp3');
      flyingAudioRef.current.loop = true;
    }
    if (!crashAudioRef.current) {
      crashAudioRef.current = new Audio('/crash.mp3');
    }
  }, []);

  useEffect(() => {
    if (gamePhase === 'flying') {
      if (audioEnabled && flyingAudioRef.current && flyingAudioRef.current.paused) {
        flyingAudioRef.current.play().catch(() => {});
      }
    } else {
      flyingAudioRef.current?.pause();
      if (flyingAudioRef.current) flyingAudioRef.current.currentTime = 0;
    }
    if (gamePhase === 'crashed') {
      if (audioEnabled && crashAudioRef.current) {
        crashAudioRef.current.pause();
        crashAudioRef.current.currentTime = 0.01; // Start at 0.01s
        crashAudioRef.current.play().catch(() => {});
      }
    }
  }, [gamePhase, audioEnabled]);

  useEffect(() => {
    if (gamePhase !== 'crashed') setShowCrashUI(false);
  }, [gamePhase]);

  useEffect(() => {
    if (!audioEnabled) {
      if (flyingAudioRef.current) {
        flyingAudioRef.current.pause();
        flyingAudioRef.current.currentTime = 0;
      }
      if (crashAudioRef.current) {
        crashAudioRef.current.pause();
        crashAudioRef.current.currentTime = 0.01;
      }
    }
  }, [audioEnabled]);

  // Generate mock bets for other players
  const generateMockBets = useCallback((crashMultiplier: number): { bets: Bet[], totalBets: number } => {
    const totalBets = Math.floor(Math.random() * 2501) + 500;
    const numDisplayBets = 50;
    const mockBets: Bet[] = [];
    for (let i = 0; i < numDisplayBets; i++) {
      const playerId = MOCK_PLAYERS[Math.floor(Math.random() * MOCK_PLAYERS.length)];
      const amount = Math.floor(Math.random() * 991) + 10; // 10 - 1000
      let cashoutMultiplier: number;
      if (i < numDisplayBets * 0.2) {
        // Early: 1.1–1.3x
        cashoutMultiplier = +(Math.random() * 0.2 + 1.1).toFixed(2);
      } else if (i < numDisplayBets * 0.6) {
        // Medium: 1.3–2x
        cashoutMultiplier = +(Math.random() * 0.7 + 1.3).toFixed(2);
      } else {
        // Greedy: 2–5x
        cashoutMultiplier = +(Math.random() * 3 + 2).toFixed(2);
      }
      mockBets.push({
        id: `mock-${i}-${Date.now()}`,
        playerId,
        amount,
        cashoutMultiplier,
        isUserBet: false,
      });
    }
    // Shuffle the bets for randomness
    for (let i = mockBets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mockBets[i], mockBets[j]] = [mockBets[j], mockBets[i]];
    }
    return { bets: mockBets, totalBets };
  }, []);

  // Handle betting phase countdown
  useEffect(() => {
    if (gamePhase === 'betting' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gamePhase === 'betting' && countdown === 0) {
      // Start flying phase
      setGamePhase('flying');
      setCurrentMultiplier(1.00);
      
      // Generate mock bets for this round
      const { bets: mockBets, totalBets } = generateMockBets(crashMultipliers[multiplierIndex % crashMultipliers.length]);
      setBets(prev => {
        const allBets = [...mockBets];
        if (userBet) {
          allBets.unshift(userBet);
        }
        return allBets;
      });
      setTotalBets(totalBets);
    }
  }, [gamePhase, countdown, generateMockBets, userBet]);

  // Handle flying phase multiplier updates
  useEffect(() => {
    if (gamePhase === 'flying') {
      const crashPoint = crashMultipliers[multiplierIndex % crashMultipliers.length];
      setCurrentMultiplier(prev => {
        const increment = Math.random() * 0.025 + 0.005;
        const newValue = prev + increment;

        // Update mock bets for cashout
        setBets(prevBets => prevBets.map(bet => {
          if (bet.isUserBet || bet.cashedOut !== undefined) return bet;
          if (newValue >= (bet.cashoutMultiplier || 0) && (bet.cashoutMultiplier || 0) <= crashPoint && newValue < crashPoint) {
            // Cashed out before crash
            return {
              ...bet,
              cashedOut: true,
              multiplier: bet.cashoutMultiplier,
              winAmount: Math.floor(bet.amount * (bet.cashoutMultiplier || 1)),
            };
          }
          return bet;
        }));

        // Check if we should crash
        if (newValue >= crashPoint) {
          if (audioEnabled && crashAudioRef.current) {
            crashAudioRef.current.pause();
            crashAudioRef.current.currentTime = 0.01;
            crashAudioRef.current.play().catch(() => {});
          }
          setTimeout(() => {
            setShowCrashUI(true);
            setGamePhase('crashed');
          }, 150); // Delay UI after sound
          return crashPoint;
        }

        return Math.round(newValue * 100) / 100;
      });

      // Generate new mock bets for this round based on crashPoint
      const { bets: mockBets, totalBets } = generateMockBets(crashMultipliers[multiplierIndex % crashMultipliers.length]);
      setBets(prev => {
        const allBets = [...mockBets];
        if (userBet) {
          allBets.unshift(userBet);
        }
        return allBets;
      });
      setTotalBets(totalBets);
      setDisplayedBetCount(0); // reset animated count for new round

      const interval = setInterval(() => {
        setCurrentMultiplier(prev => {
          const increment = Math.random() * 0.025 + 0.005;
          const newValue = prev + increment;

          // Update mock bets for cashout
          setBets(prevBets => prevBets.map(bet => {
            if (bet.isUserBet || bet.cashedOut !== undefined) return bet;
            if (newValue >= (bet.cashoutMultiplier || 0) && (bet.cashoutMultiplier || 0) <= crashMultipliers[multiplierIndex % crashMultipliers.length] && newValue < crashMultipliers[multiplierIndex % crashMultipliers.length]) {
              // Cashed out before crash
              return {
                ...bet,
                cashedOut: true,
                multiplier: bet.cashoutMultiplier,
                winAmount: Math.floor(bet.amount * (bet.cashoutMultiplier || 1)),
              };
            }
            return bet;
          }));

          // Check if we should crash
          if (newValue >= crashMultipliers[multiplierIndex % crashMultipliers.length]) {
            if (audioEnabled && crashAudioRef.current) {
              crashAudioRef.current.pause();
              crashAudioRef.current.currentTime = 0.01;
              crashAudioRef.current.play().catch(() => {});
            }
            setTimeout(() => {
              setShowCrashUI(true);
              setGamePhase('crashed');
            }, 150); // Delay UI after sound
            return crashMultipliers[multiplierIndex % crashMultipliers.length];
          }

          return Math.round(newValue * 100) / 100;
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [gamePhase, crashMultipliers, multiplierIndex, audioEnabled]);

  // Handle crash phase
  useEffect(() => {
    if (gamePhase === 'crashed') {
      // Calculate winnings for all bets
      setBets(prevBets => prevBets.map(bet => {
        if (bet.isUserBet || bet.cashedOut !== undefined) return bet;
        
        // Check if bet won (multiplier reached before crash)
        const won = crashMultipliers[multiplierIndex % crashMultipliers.length] >= 1.0;
        if (won && !bet.cashedOut) {
          const winAmount = Math.floor(bet.amount * crashMultipliers[multiplierIndex % crashMultipliers.length]);
          
          // Update user balance if it's their bet
          if (bet.isUserBet) {
            setBalance(prev => prev + winAmount);
          }
          
          return {
            ...bet,
            multiplier: crashMultipliers[multiplierIndex % crashMultipliers.length],
            winAmount,
          };
        }
        
        return {
          ...bet,
          multiplier: undefined,
          winAmount: 0,
        };
      }));

      // Add crash multiplier to previous multipliers
      const color = crashMultipliers[multiplierIndex % crashMultipliers.length] < 2 ? 'text-red-400' : 
                   crashMultipliers[multiplierIndex % crashMultipliers.length] < 5 ? 'text-green-400' :
                   crashMultipliers[multiplierIndex % crashMultipliers.length] < 10 ? 'text-blue-400' : 
                   crashMultipliers[multiplierIndex % crashMultipliers.length] < 20 ? 'text-purple-400' : 'text-pink-400';
      
      setPreviousMultipliers(prev => [
        { value: crashMultipliers[multiplierIndex % crashMultipliers.length], color },
        ...prev.slice(0, 15)
      ]);

      // Start next round after crash phase
      const timer = setTimeout(() => {
        setGamePhase('betting');
        setCountdown(BETTING_PHASE_DURATION);
        setCurrentMultiplier(1.00);
        setUserBet(null);
        setRoundNumber(prev => prev + 1);
        setMultiplierIndex(prev => prev + 1);
      }, 4000); // 4 seconds

      return () => clearTimeout(timer);
    }
  }, [gamePhase, crashMultipliers, multiplierIndex]);

  // Animate displayedBetCount during betting phase (robust, never overshoots, resets per round)
  useEffect(() => {
    // Clear any previous interval
    if (betCountIntervalRef.current) {
      clearInterval(betCountIntervalRef.current);
      betCountIntervalRef.current = null;
    }
    betCountTickRef.current = 0;
    if (gamePhase === 'betting') {
      setDisplayedBetCount(0);
      if (totalBets > 0 && BETTING_PHASE_DURATION > 0) {
        const updatesPerSecond = 5;
        const intervalMs = 1000 / updatesPerSecond; // 200ms
        const totalTicks = BETTING_PHASE_DURATION * updatesPerSecond;
        betCountIntervalRef.current = setInterval(() => {
          betCountTickRef.current++;
          if (betCountTickRef.current >= totalTicks) {
            setDisplayedBetCount(totalBets);
            if (betCountIntervalRef.current) clearInterval(betCountIntervalRef.current);
            betCountIntervalRef.current = null;
          } else {
            setDisplayedBetCount(Math.floor(totalBets * (betCountTickRef.current / totalTicks)));
          }
        }, intervalMs);
      }
    } else {
      setDisplayedBetCount(totalBets);
    }
    return () => {
      if (betCountIntervalRef.current) clearInterval(betCountIntervalRef.current);
      betCountIntervalRef.current = null;
    };
  }, [gamePhase, totalBets]);

  // Smooth progress bar effect for betting phase
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gamePhase === 'betting') {
      const start = Date.now();
      setProgress(0);
      interval = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        const prog = Math.min(elapsed / BETTING_PHASE_DURATION, 1);
        setProgress(prog);
        if (prog >= 1) {
          clearInterval(interval!);
        }
      }, 20);
    } else {
      setProgress(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [gamePhase]);

  const handleBetAmountChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    setBetAmount(Math.max(0, Math.min(numValue, balance)));
  };

  const adjustBetAmount = (delta: number) => {
    setBetAmount(prev => Math.max(1, Math.min(prev + delta, balance)));
  };

  const handlePresetAmount = (amount: number) => {
    setBetAmount(Math.min(amount, balance));
  };

  const handlePlaceBet = () => {
    if (gamePhase === 'betting' && betAmount <= balance && betAmount >= 1) {
      setBalance(prev => prev - betAmount);
      
      const newBet: Bet = {
        id: `user-${Date.now()}`,
        playerId: 'You',
        amount: betAmount,
        isUserBet: true,
      };
      
      setUserBet(newBet);
    }
  };

  const handleCashOut = () => {
    if (gamePhase === 'flying' && userBet && !userBet.cashedOut) {
      const winAmount = Math.floor(userBet.amount * currentMultiplier);
      setBalance(prev => prev + winAmount);
      
      const cashedOutBet = {
        ...userBet,
        multiplier: currentMultiplier,
        winAmount,
        cashedOut: true,
      };
      
      setUserBet(cashedOutBet);
      setBets(prev => prev.map(bet => 
        bet.id === userBet.id ? cashedOutBet : bet
      ));
    }
  };

  const getPhaseDisplay = () => {
    switch (gamePhase) {
      case 'betting':
        return (
          <div className="text-center">
            {/* Partner image above waiting text */}
            <img
              src="/partner.png"
              alt="Partner"
              className="mx-auto mb-2 w-16 sm:w-20"
              draggable="false"
            />
            <div className="text-xl font-bold text-yellow-400 mb-2">
              WAITING FOR NEXT ROUND
            </div>
            <div className="flex flex-col items-center justify-center">
              <Timer className="w-6 h-6" />
              {/* Smooth, liquid, left-to-right progress bar */}
              <div className="w-40 sm:w-64 h-1 bg-zinc-800 rounded-full overflow-hidden mt-4 relative">
                <div
                  className="h-full bg-red-500 absolute left-0 top-0 transition-all duration-100"
                  style={{
                    width: `${progress * 100}%`,
                  }}
                ></div>
              </div>
              {/* Spribe badge image below progress bar */}
              <img
                src="/spribe-badge.png"
                alt="Spribe Official Game Badge"
                className="mt-4 w-16 sm:w-20 mx-auto"
                draggable="false"
              />
            </div>
          </div>
        );
      case 'flying':
        return (
          <div className="text-center">
            <div className="text-8xl font-bold text-green-400 animate-pulse">
              {currentMultiplier.toFixed(2)}x
            </div>
          </div>
        );
      case 'crashed':
        return (
          <div className="text-center">
            <div className="text-8xl font-bold text-red-400 animate-bounce">
              {crashMultipliers[multiplierIndex % crashMultipliers.length].toFixed(2)}x
            </div>
            {showCrashUI && (
              <div className="text-red-400 text-2xl mt-4 animate-pulse">
                FLEW AWAY!
              </div>
            )}
          </div>
        );
    }
  };

  const canPlaceBet = gamePhase === 'betting' && betAmount <= balance && betAmount >= 1 && !userBet;
  const canCashOut = gamePhase === 'flying' && userBet && !userBet.cashedOut;

  return (
    <>
      <style>{`
        @keyframes slider-empty {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div className="min-h-screen bg-zinc-950 text-white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-2 sm:p-4 border-b border-zinc-800 gap-2 sm:gap-0">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <img src="/logo.png" alt="Logo" className="w-24 sm:w-32 object-contain" draggable="false" />
            <div className="text-xs sm:text-sm text-zinc-400">
              Round #{roundNumber}
            </div>
          </div>
          <div className="text-green-400 font-semibold text-base sm:text-lg">
            {balance.toFixed(2)} KES
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2 sm:gap-4 p-2 sm:p-4 h-auto lg:h-[calc(100vh-80px)]">
          {/* Left Panel - All Bets */}
          <div className="lg:col-span-3 order-3 lg:order-1">
            <Card className="h-full bg-zinc-900 border-zinc-800">
              <CardContent className="p-2 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base sm:text-lg font-semibold text-zinc-200">Bets</span>
                  <span className="text-xs sm:text-sm text-zinc-400">{displayedBetCount.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 sm:gap-2 text-xs text-zinc-400 mb-2 pb-2 border-b border-zinc-700">
                  <div>Player</div>
                  <div className="text-center">Bet KES</div>
                  <div className="text-center">X</div>
                  <div className="text-right">Win KES</div>
                </div>
                <ScrollArea className="h-[200px] sm:h-[500px]">
                  <div className="space-y-1 sm:space-y-2">
                    {bets.map((bet) => (
                      <div key={bet.id} className={`grid grid-cols-4 gap-1 sm:gap-2 items-center py-1 sm:py-2 text-xs sm:text-sm border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors ${bet.isUserBet ? 'bg-zinc-800/30' : ''}`}>
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <span className={`${bet.isUserBet ? 'text-yellow-400 font-semibold' : 'text-zinc-300'}`}>{bet.playerId}</span>
                        </div>
                        <div className="text-center text-zinc-300">{bet.amount.toLocaleString()}.00</div>
                        <div className="text-center">
                          {bet.cashedOut === true ? (
                            <span className="text-green-400 font-semibold">{bet.multiplier?.toFixed(2)}x</span>
                          ) : bet.cashedOut === false ? (
                            <span className="text-red-400 font-semibold">-</span>
                          ) : bet.multiplier ? (
                            <span className="text-green-400 font-semibold">{bet.multiplier.toFixed(2)}x</span>
                          ) : gamePhase === 'flying' ? (
                            <span className="text-yellow-400">-</span>
                          ) : (
                            <span className="text-red-400">-</span>
                          )}
                        </div>
                        <div className="text-right">
                          {bet.cashedOut === true ? (
                            <span className="text-green-400 font-semibold">{bet.winAmount?.toLocaleString()}.00</span>
                          ) : bet.cashedOut === false ? (
                            <span className="text-red-400 font-semibold">0.00</span>
                          ) : bet.winAmount ? (
                            <span className="text-green-400 font-semibold">{bet.winAmount.toLocaleString()}.00</span>
                          ) : (
                            <span className="text-red-400">0.00</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Center Panel - Live Game */}
          <div className="lg:col-span-6 order-1 lg:order-2">
            <Card className="h-full bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800 overflow-hidden">
              <CardContent className="p-2 sm:p-6 h-full flex flex-col">
                {/* Audio Toggle Button above xTournament */}
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setAudioEnabled((prev) => !prev)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors duration-200 ${audioEnabled ? 'bg-green-600 border-green-700 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                    aria-label={audioEnabled ? 'Disable Music' : 'Enable Music'}
                  >
                    {audioEnabled ? 'Music: On' : 'Music: Off'}
                  </button>
                </div>
                {/* Live Indicator and Tournament */}
                <div className="flex flex-col sm:flex-row items-center justify-between mb-2 sm:mb-4 gap-2 sm:gap-0">
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <div className={`w-2 h-2 rounded-full ${gamePhase === 'flying' ? 'bg-green-500 animate-pulse' : gamePhase === 'betting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-xs sm:text-sm font-semibold">
                      {gamePhase === 'flying' ? 'LIVE' : gamePhase === 'betting' ? 'BETTING' : 'CRASHED'}
                    </span>
                  </div>
                  <div className="text-purple-400 text-xs sm:text-sm font-medium">
                    xTournament: Collect Highest Multiplier
                  </div>
                </div>
                {/* Previous Multipliers */}
                <div className="mb-2 sm:mb-6 overflow-hidden">
                  <ScrollArea className="w-full">
                    <div className="flex space-x-1 sm:space-x-3 pb-2">
                      {previousMultipliers.map((mult, index) => (
                        <div
                          key={index}
                          className={`${mult.color} text-xs sm:text-sm font-semibold whitespace-nowrap px-1 sm:px-2 py-1 rounded bg-zinc-800/50`}
                        >
                          {mult.value.toFixed(2)}x
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                {/* Main Game Area */}
                <div className="flex-1 flex items-center justify-center relative min-h-[180px]">
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-700 to-transparent transform -skew-y-12 animate-pulse"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-600 to-transparent transform -skew-y-12 animate-pulse delay-1000"></div>
                  </div>
                  <div className="z-10">
                    {getPhaseDisplay()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Betting Controls */}
          <div className="lg:col-span-3 order-2 lg:order-3">
            <Card className="h-full bg-zinc-900 border-zinc-800">
              <CardContent className="p-2 sm:p-4">
                <div className="space-y-3 sm:space-y-6">
                  {/* User Bet Status */}
                  {userBet && (
                    <div className="bg-zinc-800 p-2 sm:p-3 rounded-lg border border-zinc-700">
                      <div className="text-xs sm:text-sm text-zinc-400 mb-1">Your Bet</div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm sm:text-white sm:font-semibold">{userBet.amount.toFixed(2)} KES</span>
                        {userBet.cashedOut ? (
                          <span className="text-blue-400 font-semibold">
                            Cashed out at {userBet.multiplier?.toFixed(2)}x
                          </span>
                        ) : gamePhase === 'flying' ? (
                          <span className="text-yellow-400 font-semibold">Active</span>
                        ) : (
                          <span className="text-zinc-400">Waiting</span>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Bet Amount */}
                  <div>
                    <label className="text-xs sm:text-sm text-zinc-400 mb-2 block">Bet Amount</label>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => adjustBetAmount(-10)}
                        className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                        disabled={betAmount <= 10 || gamePhase !== 'betting'}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <div className="flex-1">
                        <Input
                          type="number"
                          value={betAmount}
                          onChange={(e) => handleBetAmountChange(e.target.value)}
                          className="bg-zinc-800 border-zinc-700 text-center text-base sm:text-lg font-semibold"
                          min="1"
                          max={balance}
                          disabled={gamePhase !== 'betting'}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => adjustBetAmount(10)}
                        className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                        disabled={betAmount >= balance || gamePhase !== 'betting'}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Preset Amounts */}
                  <div>
                    <label className="text-xs sm:text-sm text-zinc-400 mb-2 block">Quick Bet</label>
                    <div className="grid grid-cols-2 gap-1 sm:gap-2">
                      {PRESET_AMOUNTS.map((amount) => (
                        <Button
                          key={amount}
                          variant="outline"
                          size="sm"
                          onClick={() => handlePresetAmount(amount)}
                          className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-xs sm:text-sm"
                          disabled={amount > balance || gamePhase !== 'betting'}
                        >
                          {amount.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {/* Action Button */}
                  {userBet && gamePhase === 'flying' ? (
                    !userBet.cashedOut ? (
                      <Button
                        onClick={canCashOut ? handleCashOut : undefined}
                        disabled={!canCashOut}
                        className="w-full h-12 sm:h-16 text-lg sm:text-xl font-bold bg-yellow-400 text-black rounded-full cursor-pointer border-none focus:outline-none"
                        style={{ boxShadow: 'none' }}
                      >
                        CASHOUT {(userBet.amount * currentMultiplier).toFixed(2)} KES
                      </Button>
                    ) : (
                      <Button
                        disabled
                        className={`w-full h-12 sm:h-16 text-lg sm:text-xl font-bold rounded-full border-none focus:outline-none ${userBet.winAmount && userBet.winAmount > 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
                        style={{ boxShadow: 'none' }}
                      >
                        {userBet.winAmount && userBet.winAmount > 0
                          ? `+KES ${userBet.winAmount.toLocaleString()}`
                          : `-KES ${userBet.amount.toLocaleString()}`}
                      </Button>
                    )
                  ) : (
                    <Button
                      onClick={handlePlaceBet}
                      disabled={!canPlaceBet}
                      className="w-full h-12 sm:h-16 text-lg sm:text-xl font-bold bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:text-zinc-500 transition-all duration-200 rounded-full"
                    >
                      {gamePhase === 'betting' ? 
                        (userBet ? 'Bet Placed' : `Bet ${betAmount.toFixed(2)} KES`) : 
                        gamePhase === 'flying' ? 'Round in Progress' : 'Round Ended'
                      }
                    </Button>
                  )}
                  {/* Game Status */}
                  <div className="text-center space-y-1 sm:space-y-2">
                    <div className="text-xs sm:text-sm text-zinc-400">
                      {gamePhase === 'betting' ? `Betting closes in ${countdown}s` : 
                       gamePhase === 'flying' ? 'Multiplier rising...' : 
                       'Calculating results...'}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Balance: {balance.toFixed(2)} KES
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;