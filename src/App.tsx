import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Minus, Plus, Timer } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { io } from 'socket.io-client';

import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { v4 as uuidv4 } from 'uuid';
// Removed BACKEND_URL import as it's no longer needed with Socket.IO

type GamePhase = 'betting' | 'flying' | 'crashed' | 'wait';

// Socket.IO event interfaces
interface GameStateData {
  phase: GamePhase;
  currentRound: number;
  currentMultiplier: number;
  crashPoint: number | null;
}

interface RoundStartData {
  round: number;
  crashPoint: number;
}

interface MultiplierUpdateData {
  round: number;
  multiplier: number;
}

interface RoundCrashData {
  round: number;
  crashPoint: number;
}

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

// PreviousMultiplier interface removed - no longer needed with Socket.IO integration

// Update preset amounts
const BETTING_PHASE_DURATION = 6; // seconds
const WAIT_PHASE_DURATION = 3; // seconds for wait phase between rounds

// Socket.IO configuration
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'https://aviator-socket-server.onrender.com';

// Mock player IDs (no avatars)
const MOCK_PLAYERS = [
  '2***1', '2***2', '2***0', '2***4', '2***5',
  '2***8', '2***3', '2***7', '2***6', '2***9',
  '3***1', '3***2', '3***3', '3***4', '3***5',
  '4***1', '4***2', '4***3', '4***4', '4***5',
  '5***1', '5***2', '5***3', '5***4', '5***5',
];

// Remove localStorage functions - we get state from socket server now
// function loadRoundState() { ... }
// function saveRoundState() { ... }

// Remove local getCurrentRound and fetchMultiplierBatch implementations from this file.

function App({ user, setUser }: AppProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>('betting');
  const [countdown, setCountdown] = useState<number>(BETTING_PHASE_DURATION);
  const [waitCountdown, setWaitCountdown] = useState<number>(WAIT_PHASE_DURATION);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.00);
  
  // Socket.IO connection
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentRound, setCurrentRound] = useState<number>(0);
  const currentRoundRef = useRef<number>(0); // Add ref to track current round
  
  // Always use user.balance from props. No local balance state.

  // Update balance in Supabase and refetch user
  const updateBalance = async (newBalance: number) => {
    console.log(`💰 Updating balance: ${user.balance} → ${newBalance} KES`);
    setUser((prev: any) => ({ ...prev, balance: newBalance }));
    // Update balance in database
    const { error } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', user.id);
    if (error) console.error('Error updating balance:', error);
  };

  // Handle deposit - redirect to Paystack with prefilled amount
  const handleDeposit = () => {
    if (!depositAmount || Number(depositAmount) < 1) return;
    
    // Redirect to Paystack payment page with prefilled amount
    const paystackUrl = `https://paystack.shop/pay/-gccg7xh6n?amount=${depositAmount}`;
    window.open(paystackUrl, '_blank');
    
    // Close deposit modal
    setShowDeposit(false);
    setDepositAmount('');
  };
  // Set default bet amount to 10
  const [betAmount, setBetAmount] = useState<number>(10);
  const [userBet, setUserBet] = useState<Bet | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  // Note: previousMultipliers functionality removed with Socket.IO integration
  // Will be re-implemented if needed for historical data display
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
  // Add state for autocash out
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState<boolean>(false);
  const [autoCashoutValue, setAutoCashoutValue] = useState<number>(2.00);
  const { toast } = useToast();
  // Track previous gamePhase to prevent unwanted multiplier reset
  // Remove the unused prevGamePhase variable

  // Add audio refs for flying and crash sounds
  const flyingAudioRef = useRef<HTMLAudioElement | null>(null);
  const crashAudioRef = useRef<HTMLAudioElement | null>(null);
  const crashSoundPlayedRef = useRef<boolean>(false);

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

  // Debug currentRound changes
  useEffect(() => {
    console.log(`🔄 currentRound changed to: ${currentRound}`);
    currentRoundRef.current = currentRound; // Update ref whenever currentRound changes
  }, [currentRound]);

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

  // Reset crash sound flag when entering flying phase
  useEffect(() => {
    if (gamePhase === 'flying') {
      crashSoundPlayedRef.current = false;
    }
  }, [gamePhase]);

  // Generate mock bets with realistic cashout distribution
  const generateMockBets = useCallback((crashPointForRound: number | null): { bets: Bet[], totalBets: number } => {
    const totalBets = Math.floor(Math.random() * 2501) + 500;
    const numDisplayBets = 50;
    
    // Realistic cashout distribution based on psychology
    // Most players cash out early, few take high risks
    const generateRealisticCashout = (crashPoint: number | null): number => {
      if (!crashPoint) {
        // For betting phase, generate random cashout between 1.1x and 5x
        return +(Math.random() * 3.9 + 1.1).toFixed(2);
      }
      
      // Realistic distribution: 60% cash out before 2x, 25% between 2x-5x, 10% between 5x-10x, 5% above 10x
      const rand = Math.random();
      let cashout: number;
      
      if (rand < 0.6) {
        // 60%: Cash out early (1.1x to 2x)
        cashout = +(Math.random() * 0.9 + 1.1).toFixed(2);
      } else if (rand < 0.85) {
        // 25%: Moderate risk (2x to 5x)
        cashout = +(Math.random() * 3 + 2).toFixed(2);
      } else if (rand < 0.95) {
        // 10%: High risk (5x to 10x)
        cashout = +(Math.random() * 5 + 5).toFixed(2);
      } else {
        // 5%: Very high risk (10x to 20x, but never above crash point)
        cashout = +(Math.random() * 10 + 10).toFixed(2);
      }
      
      // Ensure no bet cashes out above the crash point
      if (cashout >= crashPoint) {
        // If generated cashout is above crash point, make it lose (cashout after crash)
        cashout = +(crashPoint + Math.random() * 2 + 0.1).toFixed(2);
      }
      
      return cashout;
    };
    
    // Generate bets with realistic cashout points
    const mockBets: Bet[] = [];
    for (let i = 0; i < numDisplayBets; i++) {
      const playerId = MOCK_PLAYERS[Math.floor(Math.random() * MOCK_PLAYERS.length)];
      const amount = getWeightedBetAmount();
      const cashoutMultiplier = generateRealisticCashout(crashPointForRound);
      
      mockBets.push({
        id: `mock-${i}-${Date.now()}-${Math.floor(Math.random()*100000)}`,
        playerId,
        amount,
        cashoutMultiplier,
        isUserBet: false,
      });
    }
    
    // Shuffle bets randomly so cashouts happen at different positions
    for (let i = mockBets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mockBets[i], mockBets[j]] = [mockBets[j], mockBets[i]];
    }
    
    return { bets: mockBets, totalBets };
  }, []);

  // Real-time bet update system (runs every 100ms during flying phase)
  const betUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (gamePhase === 'flying' && crashPoint !== null) {
      betUpdateIntervalRef.current = setInterval(() => {
        setBets((prevBets: Bet[]) => {
          return prevBets.map(bet => {
            // Skip user bets and already cashed out bets
            if (bet.isUserBet || bet.cashedOut !== undefined) {
              return bet;
            }
            
            // Check if this bet should cash out at current multiplier
            if (bet.cashoutMultiplier && currentMultiplier >= bet.cashoutMultiplier) {
              return {
                ...bet,
                cashedOut: true,
                multiplier: bet.cashoutMultiplier,
                winAmount: Math.floor(bet.amount * bet.cashoutMultiplier),
              };
            }
            
            return bet;
          });
        });
        
        // Auto cashout logic for user bet
        if (autoCashoutEnabled && userBet && !userBet.cashedOut && currentMultiplier >= autoCashoutValue && crashPoint && currentMultiplier < crashPoint) {
          handleCashOut();
          toast({
            title: "Auto Cashout!",
            description: `Cashed out at ${currentMultiplier.toFixed(2)}x for ${Math.floor(userBet.amount * currentMultiplier)} KES`,
            duration: 3000,
          });
        }
      }, 100); // Update every 100ms for smooth real-time experience
      
      return () => {
        if (betUpdateIntervalRef.current) {
          clearInterval(betUpdateIntervalRef.current);
          betUpdateIntervalRef.current = null;
        }
      };
    } else {
      if (betUpdateIntervalRef.current) {
        clearInterval(betUpdateIntervalRef.current);
        betUpdateIntervalRef.current = null;
      }
    }
  }, [gamePhase, crashPoint, currentMultiplier, autoCashoutEnabled, autoCashoutValue, userBet]);

  // Helper for weighted random bet amounts
  function getWeightedBetAmount() {
    // Realistic bet amounts based on typical gambling behavior
    // Most people bet small amounts, few bet large amounts
    const betAmounts = [
      10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000
    ];
    
    // Weights: Heavy on small amounts, decreasing as amounts get larger
    const weights = [
      25, 20, 15, 12, 10, 8, 7, 6, 5, 4, 3, 3, 2, 2, 1.5, 1, 0.8, 0.6, 0.4, 0.3, 0.2, 0.15, 0.1, 0.05, 0.03, 0.02, 0.01, 0.005
    ];
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;
    
    for (let i = 0; i < betAmounts.length; i++) {
      if (r < weights[i]) return betAmounts[i];
      r -= weights[i];
    }
    
    return 10; // Fallback to minimum bet
  }

  // Robust betting phase countdown
  useEffect(() => {
    if (gamePhase === 'betting' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev: number) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gamePhase === 'betting' && countdown === 0) {
      setGamePhase('flying');
    }
  }, [gamePhase, countdown]);

  // When entering the flying phase, generate mock bets ONCE
  useEffect(() => {
    if (gamePhase === 'flying' && crashPoint) {
      setCurrentMultiplier(1.00);
      
      // Generate mock bets for this round
      const { bets: mockBets, totalBets } = generateMockBets(crashPoint);
      setBets((_prev: Bet[]) => {
        const allBets = [...mockBets];
        if (userBet) {
          allBets.unshift(userBet);
        }
        return allBets;
      });
      setTotalBets(totalBets);
    }
  }, [gamePhase, generateMockBets, userBet, crashPoint]);

  // When entering the betting phase, optionally generate new mock bets for the next round (if you want to show bets during betting phase)
  useEffect(() => {
    if (gamePhase === 'betting') {
      // Don't reset crashPoint here - keep the crash value visible
      setCurrentMultiplier(1.00);
      // Optionally, generate mock bets for betting phase (with no crashPoint yet)
      const { bets: mockBets, totalBets } = generateMockBets(null);
      setBets((_prev: Bet[]) => {
        const allBets = [...mockBets];
        if (userBet) {
          allBets.unshift(userBet);
        }
        return allBets;
      });
      setTotalBets(totalBets);
    }
  }, [gamePhase, generateMockBets, userBet]);

  // Note: flyingIntervalRef removed - Socket.IO handles multiplier updates

  // Only reset multiplier to 1.00 when entering flying phase
  useEffect(() => {
    if (gamePhase === 'flying') {
      setCurrentMultiplier(1.00);
    }
  }, [gamePhase]);

  // Handle flying phase transition (Socket.IO will handle multiplier updates)
  useEffect(() => {
    if (gamePhase === 'flying' && crashPoint !== null) {
      // Socket.IO will handle multiplier updates
      setCurrentMultiplier(1.00);
    }
  }, [gamePhase, crashPoint]);

  // Handle crash phase
  useEffect(() => {
    if (gamePhase === 'crashed' && crashPoint !== null) {
      // Process all bets including user bets
      setBets((prevBets: Bet[]) => prevBets.map(bet => {
        // Skip if already processed
        if (bet.cashedOut !== undefined) return bet;
        
        // Win: cashed out before or at crash
        if (bet.cashoutMultiplier && bet.cashoutMultiplier <= crashPoint) {
          return {
            ...bet,
            cashedOut: true,
            multiplier: bet.cashoutMultiplier,
            winAmount: Math.floor(bet.amount * bet.cashoutMultiplier),
          };
        } else {
          // Loss: didn't cash out in time (including instant crashes)
          return {
            ...bet,
            cashedOut: false,
            multiplier: undefined,
            winAmount: 0,
          };
        }
      }));

      // Handle user bet specifically for instant crashes
      if (userBet && !userBet.cashedOut) {
        // User lost their bet (including instant crashes)
        setUserBet(prev => prev ? {
          ...prev,
          cashedOut: false,
          multiplier: undefined,
          winAmount: 0,
        } : null);
        
        // Log the instant crash loss
        const lostAmount = userBet.amount;
        console.log(`💥 User lost bet of ${lostAmount} on instant crash ${crashPoint}x`);
        
        // Ensure balance is properly reflected (stake was already deducted when bet was placed)
        // Force a balance refresh to ensure UI shows correct balance
        const currentBalance = user.balance;
        console.log(`💰 Current balance after instant crash: ${currentBalance} KES`);
        
        // Show toast notification for instant crash loss
        toast({
          title: "💥 Instant Crash!",
          description: `You lost ${lostAmount.toFixed(2)} KES on ${crashPoint}x crash. Balance: ${currentBalance.toFixed(2)} KES`,
          variant: "destructive",
        });
        
        // Ensure the bet is marked as crashed in database
        crashBetInDb();
      }

      // Start next round after crash phase
      const timer = setTimeout(() => {
        setGamePhase('wait');
        setWaitCountdown(WAIT_PHASE_DURATION);
        // Don't reset multiplier here - keep crash value visible
        setUserBet(null);
      }, 2000); // 2 seconds to show crash result

      return () => clearTimeout(timer);
    }
  }, [gamePhase, crashPoint, userBet]);

  // Handle wait phase countdown
  useEffect(() => {
    if (gamePhase === 'wait' && waitCountdown > 0) {
      const timer = setTimeout(() => {
        setWaitCountdown((prev: number) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gamePhase === 'wait' && waitCountdown === 0) {
      // Transition to betting phase
      setGamePhase('betting');
      setCountdown(BETTING_PHASE_DURATION);
    }
  }, [gamePhase, waitCountdown]);

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
    setBetAmount((prev: number) => Math.max(10, Math.min(prev + delta, user.balance)));
  };

  const handleCashOut = () => {
    if (
      gamePhase === 'flying' &&
      userBet &&
      !userBet.cashedOut &&
      crashPoint && currentMultiplier < crashPoint // Only allow if not crashed
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
      setBets((prev: Bet[]) => prev.map(bet =>
        bet.id === userBet.id ? cashedOutBet : bet
      ));
      
      // Update bet in database
      if (userBet.isUserBet) {
        cashoutBetInDb(currentMultiplier, winAmount);
      }
      
      // Show success toast
      toast({
        title: "Cashout Successful!",
        description: `Cashed out at ${currentMultiplier.toFixed(2)}x for ${winAmount} KES`,
        duration: 3000,
      });
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
            <div className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-none">
              {currentMultiplier.toFixed(2)}x
            </div>
          </div>
        );
      case 'crashed':
        console.log(`🎯 CRASH UI: crashPoint = ${crashPoint}, showing ${(crashPoint ?? 0).toFixed(2)}x`);
        return (
          <div className="text-center">
            <div className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-red-400 leading-none">
              {(crashPoint ?? 0).toFixed(2)}x
            </div>
            {showCrashUI && (
              <div className="text-red-400 text-lg sm:text-xl md:text-2xl mt-2 sm:mt-4 animate-pulse">
                FLEW AWAY!
              </div>
            )}
          </div>
        );
      case 'wait':
        return (
          <div className="text-center">
            <div className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-red-400 leading-none">
              {(crashPoint ?? 0).toFixed(2)}x
            </div>
            {showCrashUI && (
              <div className="text-red-400 text-lg sm:text-xl md:text-2xl mt-2 sm:mt-4 animate-pulse">
                FLEW AWAY!
              </div>
            )}
          </div>
        );
    }
  };

  const canCashOut = gamePhase === 'flying' && userBet && !userBet.cashedOut && crashPoint && currentMultiplier < crashPoint;

  // Logout handler
  const handleLogout = () => {
    setUser(null);
  };

  // Initialize Socket.IO connection on mount
  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);

    // Connection events
    newSocket.on('connect', () => {
      console.log('🔌 Connected to Socket.IO server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from Socket.IO server');
      setIsConnected(false);
    });

    // Game state events
    newSocket.on('game:state', (data: GameStateData) => {
      console.log(`📊 Received game state: round ${data.currentRound}, phase ${data.phase}, current frontend round ${currentRound}`);
      setGamePhase(data.phase);
      setCurrentRound(data.currentRound);
      setCurrentMultiplier(data.currentMultiplier);
      setCrashPoint(data.crashPoint);
    });

    newSocket.on('round:info', (data: any) => {
      console.log(`📋 Round info: ${data.round}, phase ${data.phase}, multiplier ${data.multiplier}`);
      setCurrentRound(data.round);
      setGamePhase(data.phase);
      setCurrentMultiplier(data.multiplier);
      setCrashPoint(data.crashPoint);
    });

    newSocket.on('round:flying', (data: any) => {
      console.log(`✈️ Joining flying round: ${data.round}, multiplier ${data.multiplier}`);
      setCurrentRound(data.round);
      setGamePhase('flying');
      setCurrentMultiplier(data.multiplier);
      setCrashPoint(data.crashPoint);
      setCountdown(0);
    });

    newSocket.on('round:start', (data: RoundStartData) => {
      console.log(`🎮 Round started: ${data.round}, current frontend round ${currentRoundRef.current}`);
      console.log(`🎯 Setting currentRound from ${currentRoundRef.current} to ${data.round}`);
      setCurrentRound(data.round);
      setCrashPoint(data.crashPoint);
      setGamePhase('betting');
      setCountdown(BETTING_PHASE_DURATION);
      // Don't reset multiplier here - keep the crash value visible
      setUserBet(null);
    });

    newSocket.on('multiplier:update', (data: MultiplierUpdateData) => {
      // Debug: Log any suspicious multiplier values
      if (data.multiplier === 0 || data.multiplier < 0.1) {
        console.log(`🚨 SUSPICIOUS MULTIPLIER: round ${data.round}, multiplier ${data.multiplier}`);
      }
      
      // Only log every 10th update or significant changes to reduce console spam
      const shouldLog = data.multiplier % 0.5 < 0.02 || data.multiplier >= 2.0;
      if (shouldLog) {
        console.log(`📈 Multiplier update: round ${data.round}, multiplier ${data.multiplier}, current frontend round ${currentRoundRef.current}`);
      }
      
      if (data.round === currentRoundRef.current) {
        setCurrentMultiplier(data.multiplier);
      } else {
        console.log(`⚠️ Round mismatch: received ${data.round}, expected ${currentRoundRef.current}`);
      }
    });

    newSocket.on('round:crash', (data: RoundCrashData) => {
      if (data.round === currentRoundRef.current) {
        console.log(`💥 CRASH: Setting crash point to ${data.crashPoint}x`);
        setGamePhase('crashed');
        setCurrentMultiplier(data.crashPoint);
        setCrashPoint(data.crashPoint);
        setShowCrashUI(true);
      }
    });

    return () => {
      newSocket.close();
    };
  }, []); // Remove currentRound dependency to prevent socket reconnection

  // On mount, get current state from socket server instead of localStorage
  useEffect(() => {
    // Socket server will send current state on connection
    // No need to restore from localStorage as it can cause desync
    console.log(`📱 Connected to socket server, waiting for current state...`);
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

  // Show loading screen while connecting to Socket.IO
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <div className="text-lg">Connecting to game server...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes slider-empty {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div className="min-h-screen bg-zinc-950 text-white relative">
        {/* Header */}
        <div className="flex items-center p-2 sm:p-4 border-b border-zinc-800 gap-2">
          {/* 1st Logo */}
          <img
            src="/logo.png"
            alt="Logo"
            className="w-20 h-6 sm:w-40 sm:h-16 max-w-[100px] sm:max-w-[180px] object-contain flex-shrink-0"
            draggable="false"
          />
          
          {/* 2nd Logo */}
          <img
            src="/mainlogo.png"
            alt="Main Logo"
            className="w-16 h-6 sm:w-40 sm:h-16 max-w-[80px] sm:max-w-[180px] object-contain flex-shrink-0"
            draggable="false"
          />
          
          {/* Spacer to push remaining elements to the right */}
          <div className="flex-1"></div>
          
          {/* Deposit button */}
          <button
            className="flex items-center justify-center bg-green-500 hover:bg-green-600 text-white font-bold rounded-full w-6 h-6 sm:w-7 sm:h-7 shadow border border-green-700 transition flex-shrink-0"
            title="Deposit"
            onClick={() => setShowDeposit(true)}
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
          
          {/* Balance */}
          <button
            className="flex items-center bg-gradient-to-r from-green-700 via-green-500 to-yellow-400 px-1.5 sm:px-2 py-0.5 rounded-full shadow text-black font-bold text-xs sm:text-base border border-green-800 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition hover:brightness-105 flex-shrink-0"
            title="Withdraw"
            onClick={() => setShowWithdraw(true)}
            style={{ minWidth: 0 }}
          >
            <span className="mr-0.5 sm:mr-1 flex items-center">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-yellow-300 mr-0.5 sm:w-4 sm:h-4">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <text x="12" y="16" textAnchor="middle" fontSize="8" fill="#fde68a" fontWeight="400">KES</text>
              </svg>
              <span className="text-xs sm:text-base">{user.balance.toFixed(2)}</span>
            </span>
          </button>
          
          {/* Hamburger Menu (3 dots) */}
          <div className="flex-shrink-0">
            <HamburgerMenu onLogout={handleLogout} onShowHistory={() => setShowBetHistory(true)} />
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
                    <div className={`w-2 h-2 rounded-full ${gamePhase === 'flying' ? 'bg-green-500 animate-pulse' : gamePhase === 'betting' ? 'bg-yellow-500 animate-pulse' : gamePhase === 'wait' ? 'bg-orange-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-xs sm:text-sm font-semibold">
                      {gamePhase === 'flying' ? 'LIVE' : gamePhase === 'betting' ? 'BETTING' : gamePhase === 'wait' ? 'WAIT' : 'CRASHED'}
                    </span>
                    <span className="ml-2 text-xs sm:text-sm text-zinc-400 font-mono">Round {currentRound !== null ? currentRound : '...'}</span>
                  </div>
                  <div className="text-purple-400 text-xs sm:text-sm font-medium">
                    xTournament: Collect Highest Multiplier
                  </div>
                </div>

                {/* Previous multipliers as colored chips */}
                <div className="flex flex-row gap-1 mb-4">
                  <span className="text-zinc-500 text-xs">Live multipliers from Socket.IO</span>
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
                  {/* Autocash Out Toggle */}
                  <div>
                    <label className="text-xs sm:text-sm text-zinc-400 mb-2 block">Auto Cashout</label>
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => setAutoCashoutEnabled(!autoCashoutEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
                          autoCashoutEnabled ? 'bg-green-600' : 'bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            autoCashoutEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <label className="text-xs sm:text-sm text-zinc-300">
                        Enable Auto Cashout
                      </label>
                    </div>
                    {autoCashoutEnabled && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={autoCashoutValue}
                            onChange={(e) => setAutoCashoutValue(Math.max(1.00, parseFloat(e.target.value) || 1.00))}
                            min="1.00"
                            max="100.00"
                            step="0.01"
                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="2.00"
                          />
                          <span className="text-xs sm:text-sm text-zinc-400">x</span>
                        </div>
                        {userBet && gamePhase === 'flying' && !userBet.cashedOut && (
                          <div className="text-xs text-zinc-400">
                            {currentMultiplier >= autoCashoutValue ? (
                              <span className="text-green-400">Auto cashout triggered!</span>
                            ) : (
                              <span>Will cashout at {autoCashoutValue.toFixed(2)}x (current: {currentMultiplier.toFixed(2)}x)</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
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
                        Waiting for Next round
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
              onClick={handleDeposit}
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
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        aria-label="Menu"
      >
        <span className="text-xl sm:text-2xl text-white">&#8942;</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg py-2 z-50">
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