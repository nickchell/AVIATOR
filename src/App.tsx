import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Minus, Plus, Timer } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { generateCrashMultiplier } from './data/crashMultipliers';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { v4 as uuidv4 } from 'uuid';

type GamePhase = 'betting' | 'flying' | 'crashed';

interface AppProps {
  user: {
    id: string;
    phone: string;
    pin: string;
    balance: number;
    [key: string]: any;
  };
  setUser: (user: any) => void;
}

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

// Update preset amounts
const PRESET_AMOUNTS = [100, 200, 500, 1000];
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

// Utility to persist round state
function saveRoundState(state: any) {
  localStorage.setItem('aviator_round_state', JSON.stringify(state));
}
function loadRoundState() {
  const raw = localStorage.getItem('aviator_round_state');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function App({ user, setUser }: AppProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>('betting');
  const [countdown, setCountdown] = useState<number>(BETTING_PHASE_DURATION);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.00);
  // Always use user.balance from props. No local balance state.

  // Update balance in Supabase and refetch user
  const updateBalance = async (newBalance: number) => {
    const { error } = await supabase.from('users').update({ balance: newBalance }).eq('id', user.id);
    if (!error) {
      const { data: freshUser } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (freshUser) setUser(freshUser);
    } else {
      console.error('Supabase update error:', error);
    }
  };
  // Set default bet amount to 10
  const [betAmount, setBetAmount] = useState<number>(10);
  const [userBet, setUserBet] = useState<Bet | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [previousMultipliers, setPreviousMultipliers] = useState<PreviousMultiplier[]>(INITIAL_PREVIOUS_MULTIPLIERS);
  const [totalBets, setTotalBets] = useState<number>(0);
  const [displayedBetCount, setDisplayedBetCount] = useState<number>(0);
  const [progress, setProgress] = useState(0);
  const betCountIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const betCountTickRef = useRef<number>(0);
  const [showCrashUI, setShowCrashUI] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  // Add state for queued bet
  const [queuedBetAmount, setQueuedBetAmount] = useState<number|null>(null);
  // Add state for pending bet during betting phase
  const [pendingBetAmount, setPendingBetAmount] = useState<number|null>(null);
  const { toast } = useToast();
  // Track previous gamePhase to prevent unwanted multiplier reset
  // Remove the unused prevGamePhase variable

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
  const generateMockBets = useCallback((crashPointForRound: number | null): { bets: Bet[], totalBets: number } => {
    const totalBets = Math.floor(Math.random() * 2501) + 500;
    const numDisplayBets = 50;
    // Step 1: Generate unique multipliers as much as possible
    const uniqueMultipliers = new Set<number>();
    while (uniqueMultipliers.size < numDisplayBets) {
      let cashout: number;
      if (crashPointForRound) {
        cashout = getRandomCashout(crashPointForRound);
      } else {
        cashout = +(Math.random() * 4 + 1.1 + Math.random() * 0.01).toFixed(2);
      }
      uniqueMultipliers.add(cashout);
      if (uniqueMultipliers.size >= numDisplayBets) break;
    }
    const multipliersArr = Array.from(uniqueMultipliers);
    // Step 2: Generate bets and assign multipliers
    const mockBets: Bet[] = [];
    for (let i = 0; i < numDisplayBets; i++) {
      const playerId = MOCK_PLAYERS[Math.floor(Math.random() * MOCK_PLAYERS.length)];
      const amount = getWeightedBetAmount();
      const cashoutMultiplier = multipliersArr[i % multipliersArr.length];
      mockBets.push({
        id: `mock-${i}-${Date.now()}-${Math.floor(Math.random()*100000)}`,
        playerId,
        amount,
        cashoutMultiplier,
        isUserBet: false,
      });
    }
    // Step 3: Shuffle the bets to avoid adjacent duplicates
    for (let i = mockBets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mockBets[i], mockBets[j]] = [mockBets[j], mockBets[i]];
    }
    // Step 4: If any adjacent duplicates, swap with a random other bet
    for (let i = 1; i < mockBets.length; i++) {
      if (mockBets[i].cashoutMultiplier === mockBets[i-1].cashoutMultiplier) {
        const swapWith = (i+1) % mockBets.length;
        [mockBets[i], mockBets[swapWith]] = [mockBets[swapWith], mockBets[i]];
      }
    }
    return { bets: mockBets, totalBets };
  }, []);

  // Helper for weighted random bet amounts
  function getWeightedBetAmount() {
    // Realistic psychological numbers, max 5000, 300+ rare
    const pool = [10, 20, 30, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
    // More small/medium, very few large (300+)
    const weights = [30, 20, 12, 10, 12, 10, 15, 8, 10, 7, 3, 2, 2, 1, 1, 0.7, 0.5, 0.3, 0.2, 0.1, 0.05];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (Math.random() < 0.9) {
      let r = Math.random() * totalWeight;
      for (let i = 0; i < pool.length; i++) {
        if (r < weights[i]) return pool[i];
        r -= weights[i];
      }
      return 10;
    } else {
      // 10%: pick a random odd number between 300 and 5000 not in the pool
      let n;
      do {
        n = Math.floor(Math.random() * 4701) + 300;
      } while (pool.includes(n));
      return n;
    }
  }

  // Helper for random cashout multiplier (some above crashPoint)
  function getRandomCashout(crashPoint: number) {
    // 70% cash out before crash, 30% after (lose)
    if (Math.random() < 0.7) {
      return +(Math.random() * (crashPoint - 1.01) + 1.01 + Math.random() * 0.01).toFixed(2);
    } else {
      return +(Math.random() * (500 - crashPoint) + crashPoint + 0.01 + Math.random() * 0.01).toFixed(2);
    }
  }

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
      const { bets: mockBets, totalBets } = generateMockBets(null);
      setBets(_prev => {
        const allBets = [...mockBets];
        if (userBet) {
          allBets.unshift(userBet);
        }
        return allBets;
      });
      setTotalBets(totalBets);
    }
  }, [gamePhase, countdown, generateMockBets, userBet]);

  // When entering the flying phase, generate and set a new crashPoint and generate mock bets ONCE
  useEffect(() => {
    if (gamePhase === 'flying') {
      const newCrashPoint = generateCrashMultiplier();
      setCrashPoint(newCrashPoint);
      setCurrentMultiplier(1.00);
      // Generate mock bets for this round
      const { bets: mockBets, totalBets } = generateMockBets(newCrashPoint);
      setBets(_prev => {
        const allBets = [...mockBets];
        if (userBet) {
          allBets.unshift(userBet);
        }
        return allBets;
      });
      setTotalBets(totalBets);
    }
  }, [gamePhase, generateMockBets, userBet]);

  // When entering the betting phase, optionally generate new mock bets for the next round (if you want to show bets during betting phase)
  useEffect(() => {
    if (gamePhase === 'betting') {
      setCrashPoint(null);
      setCurrentMultiplier(1.00);
      // Optionally, generate mock bets for betting phase (with no crashPoint yet)
      const { bets: mockBets, totalBets } = generateMockBets(null);
      setBets(_prev => {
        const allBets = [...mockBets];
        if (userBet) {
          allBets.unshift(userBet);
        }
        return allBets;
      });
      setTotalBets(totalBets);
    }
  }, [gamePhase, generateMockBets, userBet]);

  // Use a ref for the flying phase interval
  const flyingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // In the flying phase multiplier update effect, use the ref and only depend on gamePhase, crashPoint, audioEnabled
  useEffect(() => {
    if (gamePhase === 'flying' && crashPoint !== null) {
      if (flyingIntervalRef.current) clearInterval(flyingIntervalRef.current);
      flyingIntervalRef.current = setInterval(() => {
        setCurrentMultiplier(prev => {
          if (crashPoint === null) return prev;
          const increment = Math.random() * 0.025 + 0.005;
          const newValue = prev + increment;
          // Check if we should crash
          if (newValue >= crashPoint!) {
            if (audioEnabled && crashAudioRef.current) {
              crashAudioRef.current.pause();
              crashAudioRef.current.currentTime = 0.01;
              crashAudioRef.current.play().catch(() => {});
            }
            setTimeout(() => {
              setShowCrashUI(true);
              setGamePhase('crashed');
            }, 150); // Delay UI after sound
            return crashPoint!;
          }
          return Math.round(newValue * 100) / 100;
        });
      }, 50);
      return () => {
        if (flyingIntervalRef.current) clearInterval(flyingIntervalRef.current);
        flyingIntervalRef.current = null;
      };
    } else {
      if (flyingIntervalRef.current) clearInterval(flyingIntervalRef.current);
      flyingIntervalRef.current = null;
    }
  }, [gamePhase, crashPoint, audioEnabled]);

  // Remove the duplicate crash phase effect and merge logic into a single useEffect
  useEffect(() => {
    if (gamePhase === 'crashed' && crashPoint !== null) {
      setBets(prevBets => prevBets.map(bet => {
        if (bet.isUserBet || bet.cashedOut !== undefined) return bet;
        // Win: cashed out before or at crash
        if (bet.cashoutMultiplier && bet.cashoutMultiplier <= crashPoint) {
          return {
            ...bet,
            cashedOut: true,
            multiplier: bet.cashoutMultiplier,
            winAmount: Math.floor(bet.amount * bet.cashoutMultiplier),
          };
        } else {
          // Loss: tried to cash out after crash
          return {
            ...bet,
            cashedOut: false,
            multiplier: undefined,
            winAmount: 0,
          };
        }
      }));

      // Add crash multiplier to previous multipliers, but only if it's not a duplicate of the most recent
      const color = crashPoint < 2 ? 'text-red-400' : 
                   crashPoint < 5 ? 'text-green-400' :
                   crashPoint < 10 ? 'text-blue-400' : 
                   crashPoint < 20 ? 'text-purple-400' : 'text-pink-400';
      setPreviousMultipliers(prev => {
        if (prev.length > 0 && prev[0].value === crashPoint) {
          return prev;
        }
        return [
          { value: crashPoint, color },
          ...prev.slice(0, 15)
        ];
      });

      // Start next round after crash phase
      const timer = setTimeout(() => {
        setGamePhase('betting');
        setCountdown(BETTING_PHASE_DURATION);
        setCurrentMultiplier(1.00);
        setUserBet(null);
      }, 4000); // 4 seconds

      return () => clearTimeout(timer);
    }
  }, [gamePhase, crashPoint]);

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
    setBetAmount(Math.max(10, Math.min(numValue, user.balance)));
  };

  const adjustBetAmount = (delta: number) => {
    setBetAmount(prev => Math.max(10, Math.min(prev + delta, user.balance)));
  };

  const handlePresetAmount = (amount: number) => {
    setBetAmount(Math.min(amount, user.balance));
  };

  const handleCashOut = () => {
    if (
      gamePhase === 'flying' &&
      userBet &&
      !userBet.cashedOut &&
      currentMultiplier < crashPoint // Only allow if not crashed
    ) {
      const winAmount = Math.floor(userBet.amount * currentMultiplier);
      updateBalance(user.balance + winAmount);

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

  // Add Supabase bet logic
  // Store the current bet's database id
  const [betDbId, setBetDbId] = useState<string | null>(null);

  // Place bet (when user places a bet)
  const placeBetInDb = async (amount: number) => {
    const { data } = await supabase
      .from('bets')
      .insert([{
        id: uuidv4(),
        user_id: user.id,
        amount,
        status: 'pending',
        placed_at: new Date().toISOString(),
      }])
      .select();
    if (data && data[0] && data[0].id) setBetDbId(data[0].id);
  };

  // On cashout, update the bet in Supabase
  const cashoutBetInDb = async (multiplier: number, winAmount: number) => {
    if (!betDbId) return;
    await supabase
      .from('bets')
      .update({
        cashed_out_at: new Date().toISOString(),
        cashout_multiplier: multiplier,
        win_amount: winAmount,
        status: 'cashed_out',
      })
      .eq('id', betDbId);
  };

  // On crash, update the bet in Supabase if not cashed out
  const crashBetInDb = async () => {
    if (!betDbId) return;
    await supabase
      .from('bets')
      .update({
        status: 'crashed',
        win_amount: 0,
      })
      .eq('id', betDbId);
  };

  // When placing a bet, call placeBetInDb
  useEffect(() => {
    if (userBet && userBet.isUserBet && !userBet.cashedOut) {
      placeBetInDb(userBet.amount);
    }
  }, [userBet && userBet.isUserBet && !userBet.cashedOut]);

  // When cashing out, call cashoutBetInDb
  useEffect(() => {
    if (userBet && userBet.cashedOut && userBet.isUserBet) {
      cashoutBetInDb(userBet.multiplier || 0, userBet.winAmount || 0);
    }
  }, [userBet && userBet.cashedOut && userBet.isUserBet]);

  // When the round crashes, if userBet exists and is not cashed out, mark as crashed
  useEffect(() => {
    if (gamePhase === 'crashed' && userBet && !userBet.cashedOut && userBet.isUserBet) {
      crashBetInDb();
    }
  }, [gamePhase, userBet]);

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
              {crashPoint?.toFixed(2)}x
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

  const canCashOut = gamePhase === 'flying' && userBet && !userBet.cashedOut;

  // Logout handler
  const handleLogout = () => {
    setUser(null);
  };

  // On mount, randomly determine if user joins during betting, flying, or crashed phase
  useEffect(() => {
    if (crashPoint !== null) return; // Only run on first mount
    const phases: GamePhase[] = ['betting', 'flying', 'crashed'];
    const phase = phases[Math.floor(Math.random() * phases.length)];
    if (phase === 'betting') {
      setGamePhase('betting');
      setCountdown(Math.floor(Math.random() * BETTING_PHASE_DURATION));
      setCrashPoint(null);
      setCurrentMultiplier(1.00);
    } else if (phase === 'flying') {
      const newCrashPoint = generateCrashMultiplier();
      setCrashPoint(newCrashPoint);
      // Pick a random multiplier between 1.01 and just before crashPoint
      const progress = Math.random();
      const current = +(1.01 + progress * (newCrashPoint - 1.01 - 0.01)).toFixed(2);
      setCurrentMultiplier(current);
      setGamePhase('flying');
      setCountdown(0);
    } else {
      // crashed
      const newCrashPoint = generateCrashMultiplier();
      setCrashPoint(newCrashPoint);
      setCurrentMultiplier(newCrashPoint);
      setGamePhase('crashed');
      setCountdown(0);
      setShowCrashUI(true);
    }
  }, []);

  // On phase change, persist round state
  useEffect(() => {
    if (gamePhase && crashPoint !== null) {
      const now = Date.now();
      if (gamePhase === 'betting') {
        saveRoundState({
          phase: 'betting',
          crashPoint,
          roundStartTime: now,
          bettingEndTime: now + countdown * 1000,
        });
      } else if (gamePhase === 'flying') {
        saveRoundState({
          phase: 'flying',
          crashPoint,
          roundStartTime: now - ((currentMultiplier - 1.00) / ((crashPoint - 1.00) / (BETTING_PHASE_DURATION * 1000))) || now,
          bettingEndTime: null,
        });
      } else if (gamePhase === 'crashed') {
        saveRoundState({
          phase: 'crashed',
          crashPoint,
          roundStartTime: now,
          bettingEndTime: null,
        });
      }
    }
  }, [gamePhase, crashPoint, countdown, currentMultiplier]);

  // On mount, restore round state if available
  useEffect(() => {
    const state = loadRoundState();
    if (!state) return;
    const now = Date.now();
    if (state.phase === 'betting') {
      const remaining = Math.max(0, Math.floor((state.bettingEndTime - now) / 1000));
      setCrashPoint(state.crashPoint);
      setGamePhase('betting');
      setCountdown(remaining);
      setCurrentMultiplier(1.00);
    } else if (state.phase === 'flying') {
      const elapsed = (now - state.roundStartTime) / 1000;
      setCrashPoint(state.crashPoint);
      setGamePhase('flying');
      // Estimate multiplier based on elapsed time and crashPoint
      const duration = BETTING_PHASE_DURATION; // seconds
      const maxMultiplier = state.crashPoint;
      const progress = Math.min(1, elapsed / duration);
      const multiplier = +(1.00 + progress * (maxMultiplier - 1.00)).toFixed(2);
      setCurrentMultiplier(multiplier);
      setCountdown(0);
    } else if (state.phase === 'crashed') {
      setCrashPoint(state.crashPoint);
      setGamePhase('crashed');
      setCurrentMultiplier(state.crashPoint);
      setCountdown(0);
      setShowCrashUI(true);
    }
  }, []);

  // When entering betting phase, if queuedBetAmount is set, place the bet automatically and clear queuedBetAmount
  useEffect(() => {
    if (gamePhase === 'betting' && queuedBetAmount !== null) {
      if (queuedBetAmount <= user.balance && queuedBetAmount >= 10) {
        updateBalance(user.balance - queuedBetAmount);
        const newBet: Bet = {
          id: `user-${Date.now()}`,
          playerId: 'You',
          amount: queuedBetAmount,
          isUserBet: true,
        };
        setUserBet(newBet);
      }
      setQueuedBetAmount(null);
    }
  }, [gamePhase]);

  // When the round transitions to flying, if userBet is set, clear any queued bet
  useEffect(() => {
    if (gamePhase === 'flying' && userBet) {
      setQueuedBetAmount(null);
    }
  }, [gamePhase, userBet]);

  // When the round transitions to flying, if pendingBetAmount is set, place the bet and clear pendingBetAmount
  useEffect(() => {
    if (gamePhase === 'flying' && pendingBetAmount !== null) {
      if (pendingBetAmount <= user.balance && pendingBetAmount >= 10) {
        updateBalance(user.balance - pendingBetAmount);
        const newBet: Bet = {
          id: `user-${Date.now()}`,
          playerId: 'You',
          amount: pendingBetAmount,
          isUserBet: true,
        };
        setUserBet(newBet);
      }
      setPendingBetAmount(null);
    }
  }, [gamePhase]);

  // Show a green toast when the user wins a bet
  useEffect(() => {
    if (userBet && userBet.cashedOut && userBet.winAmount && userBet.winAmount > 0) {
      toast({
        // Use a custom JSX element for the toast content
        description: (
          <div className="flex items-center justify-between bg-green-600 rounded-full px-4 py-2 w-full min-w-[180px] max-w-[260px] shadow-lg">
            <div className="flex flex-col items-start">
              <span className="text-xs text-white/80">You have cashed out</span>
              <span className="text-lg font-bold text-white">{userBet.multiplier?.toFixed(2)}x</span>
            </div>
            <div className="ml-4 flex items-center">
              <span className="bg-green-700 rounded-full px-3 py-1 text-base font-bold text-white shadow">Win KES {userBet.winAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        ),
        className: 'p-0 bg-transparent shadow-none',
        style: { top: 20, left: '50%', transform: 'translateX(-50%)', position: 'fixed', zIndex: 9999, width: 'auto', minWidth: 180 },
      });
    }
  }, [userBet]);

  // Add state for bet history modal
  const [showBetHistory, setShowBetHistory] = useState(false);
  const [betHistory, setBetHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch bet history when modal opens
  useEffect(() => {
    if (showBetHistory) {
      setLoadingHistory(true);
      supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
        .order('placed_at', { ascending: false })
        .then(({ data }) => {
          setBetHistory(data || []);
          setLoadingHistory(false);
        });
    }
  }, [showBetHistory, user.id]);

  return (
    <>
      <style>{`
        @keyframes slider-empty {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div className="min-h-screen bg-zinc-950 text-white relative">
        {/* Hamburger Menu */}
        <HamburgerMenu onLogout={handleLogout} onShowHistory={() => setShowBetHistory(true)} />
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-2 sm:p-4 border-b border-zinc-800 gap-2 sm:gap-0">
          {/* Responsive mainlogo: left on mobile, centered on large screens */}
          <div className="flex items-center w-full">
            <div className="flex-1 flex lg:justify-center justify-start">
              <img
                src="/hybridlogo.png"
                alt="Hybrid Logo"
                className="w-52 max-w-[260px] h-16 sm:h-20 object-contain"
                draggable="false"
              />
            </div>
          </div>
          <div className="flex items-center gap-1 mr-10 sm:mr-16">
            {/* Deposit button to the left */}
            <button
              className="flex items-center justify-center bg-green-500 hover:bg-green-600 text-white font-bold rounded-full w-7 h-7 shadow border border-green-700 transition"
              title="Deposit"
              onClick={() => setShowDeposit(true)}
            >
              <Plus className="w-4 h-4" />
            </button>
            {/* Cool balance display */}
            <button
              className="flex items-center bg-gradient-to-r from-green-700 via-green-500 to-yellow-400 px-2 py-0.5 rounded-full shadow text-black font-bold text-sm sm:text-base border border-green-800 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition hover:brightness-105"
              title="Withdraw"
              onClick={() => setShowWithdraw(true)}
              style={{ minWidth: 0 }}
            >
              <span className="mr-1 flex items-center">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-yellow-300 mr-0.5">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <text x="12" y="16" textAnchor="middle" fontSize="8" fill="#fde68a" fontWeight="400">KES</text>
                </svg>
                {user.balance.toFixed(2)}
              </span>
            </button>
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
                        className="bg-zinc-800 border-zinc-700"
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
                          min="10"
                          max={user.balance}
                          disabled={gamePhase !== 'betting'}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => adjustBetAmount(10)}
                        className="bg-zinc-800 border-zinc-700"
                        disabled={betAmount >= user.balance || gamePhase !== 'betting'}
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
                          className="bg-zinc-800 border-zinc-700 text-xs sm:text-sm"
                          disabled={amount > user.balance || gamePhase !== 'betting'}
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
                          ? `+KES ${(userBet.amount * (userBet.multiplier || 1)).toLocaleString()}`
                          : `-KES ${userBet.amount.toLocaleString()}`}
                      </Button>
                    )
                  ) : (
                    pendingBetAmount !== null ? (
                      <Button
                        onClick={() => setPendingBetAmount(null)}
                        className="w-full h-12 sm:h-16 text-lg sm:text-xl font-bold bg-red-600 text-white rounded-full border-none focus:outline-none"
                      >
                        Cancel
                      </Button>
                    ) : queuedBetAmount !== null ? (
                      <Button
                        onClick={() => setQueuedBetAmount(null)}
                        className="w-full h-12 sm:h-16 text-lg sm:text-xl font-bold bg-red-600 text-white rounded-full border-none focus:outline-none"
                      >
                        Queued
                      </Button>
                    ) : (
                      <Button
                        onClick={
                          gamePhase === 'betting'
                            ? () => setPendingBetAmount(betAmount)
                            : gamePhase === 'flying'
                              ? () => setQueuedBetAmount(betAmount)
                              : undefined
                        }
                        disabled={betAmount < 10 || betAmount > user.balance || pendingBetAmount !== null || queuedBetAmount !== null}
                        className="w-full h-12 sm:h-16 text-lg sm:text-xl font-bold bg-green-600 transition-all duration-200 rounded-full"
                      >
                        {`Bet ${betAmount.toFixed(2)} KES`}
                      </Button>
                    )
                  )}
                  {/* Game Status */}
                  <div className="text-center space-y-1 sm:space-y-2">
                    <div className="text-xs sm:text-sm text-zinc-400">
                      {gamePhase === 'betting' ? `Betting closes in ${countdown}s` : 
                       gamePhase === 'flying' ? 'Multiplier rising...' : 
                       ''}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Balance: {user.balance.toFixed(2)} KES
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Deposit Modal/Page */}
      {showDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-zinc-900 rounded-2xl shadow-xl p-6 w-full max-w-xs mx-2 relative">
            <button className="absolute top-2 right-2 text-zinc-400 hover:text-red-400 text-xl" onClick={() => setShowDeposit(false)}>&times;</button>
            <h2 className="text-xl font-bold mb-4 text-green-400 text-center">Deposit Funds</h2>
            <div className="mb-3 flex flex-wrap gap-2 justify-center">
              {[50, 100, 200, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  className="bg-green-700 hover:bg-green-600 text-white font-semibold rounded-full px-4 py-2 text-sm shadow border border-green-800"
                  onClick={() => setDepositAmount(amt.toString())}
                >
                  {amt} KES
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-1 text-zinc-300">Amount</label>
              <input
                type="number"
                className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="Enter amount"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                min={1}
              />
            </div>
            <button
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-2 rounded-full text-lg transition disabled:opacity-60"
              // onClick={handleDeposit} // Add deposit logic here
              disabled={!depositAmount || Number(depositAmount) < 1}
            >
              Deposit
            </button>
          </div>
        </div>
      )}

      {/* Withdraw Modal/Page */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-zinc-900 rounded-2xl shadow-xl p-6 w-full max-w-xs mx-2 relative">
            <button className="absolute top-2 right-2 text-zinc-400 hover:text-red-400 text-xl" onClick={() => setShowWithdraw(false)}>&times;</button>
            <h2 className="text-xl font-bold mb-4 text-yellow-400 text-center">Withdraw Funds</h2>
            <div className="mb-3 flex flex-wrap gap-2 justify-center">
              {[500, 1000, 2000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-full px-4 py-2 text-sm shadow border border-yellow-600"
                  onClick={() => setWithdrawAmount(amt.toString())}
                >
                  {amt} KES
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-1 text-zinc-300">Amount</label>
              <input
                type="number"
                className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="Enter amount (min 500)"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                min={500}
                max={user.balance}
              />
            </div>
            <button
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 rounded-full text-lg transition disabled:opacity-60"
              // onClick={handleWithdraw} // Add withdraw logic here
              disabled={!withdrawAmount || Number(withdrawAmount) < 500 || Number(withdrawAmount) > user.balance}
            >
              Withdraw
            </button>
          </div>
        </div>
      )}
      {showBetHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-zinc-900 rounded-2xl shadow-xl p-6 w-full max-w-lg mx-2 relative">
            <button className="absolute top-2 right-2 text-zinc-400 hover:text-red-400 text-xl" onClick={() => setShowBetHistory(false)}>&times;</button>
            <h2 className="text-xl font-bold mb-4 text-blue-400 text-center">Bet History</h2>
            {loadingHistory ? (
              <div className="text-center text-zinc-300">Loading...</div>
            ) : betHistory.length === 0 ? (
              <div className="text-center text-zinc-400">No bets found.</div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-zinc-400 border-b border-zinc-700">
                      <th className="py-1">Amount</th>
                      <th className="py-1">Multiplier</th>
                      <th className="py-1">Status</th>
                      <th className="py-1">Win/Loss</th>
                      <th className="py-1">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {betHistory.map((bet) => (
                      <tr key={bet.id} className="border-b border-zinc-800">
                        <td className="py-1 text-zinc-200">{bet.amount}</td>
                        <td className="py-1 text-zinc-200">{bet.status === 'cashed_out' && bet.cashout_multiplier ? bet.cashout_multiplier.toFixed(2) + 'x' : '-'}</td>
                        <td className="py-1 font-bold">
                          {bet.status === 'cashed_out'
                            ? (bet.win_amount > 0
                                ? <span className="text-green-400">Win</span>
                                : <span className="text-red-400">Loss</span>)
                            : <span className="text-yellow-400">Crashed</span>}
                        </td>
                        <td className="py-1 font-bold">
                          {bet.status === 'cashed_out'
                            ? (bet.win_amount > 0
                                ? <span className="text-green-400">+KES {bet.win_amount.toLocaleString()}</span>
                                : <span className="text-red-400">-KES {bet.amount.toLocaleString()}</span>)
                            : <span className="text-red-400">-KES {bet.amount.toLocaleString()}</span>}
                        </td>
                        <td className="py-1 text-zinc-400">{new Date(bet.placed_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      <Toaster />
    </>
  );
}

// HamburgerMenu component
function HamburgerMenu({ onLogout, onShowHistory }: { onLogout: () => void, onShowHistory: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute top-4 right-4 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        aria-label="Menu"
      >
        <span className="text-2xl text-white">&#8942;</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg py-2">
          <button
            onClick={() => { setOpen(false); onShowHistory(); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-blue-400 hover:bg-blue-600 hover:text-white font-semibold rounded transition focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            Bet History
          </button>
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-600 hover:text-white font-semibold rounded transition focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" /></svg>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default App;