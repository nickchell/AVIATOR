import React, { useState, useEffect, useCallback } from 'react';
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
  avatar: string;
  cashedOut?: boolean;
  isUserBet?: boolean;
}

interface PreviousMultiplier {
  value: number;
  color: string;
}

const PRESET_AMOUNTS = [100, 200, 500, 20000];
const BETTING_PHASE_DURATION = 6; // seconds
const CRASH_PHASE_DURATION = 3; // seconds

// Mock player avatars and IDs
const MOCK_PLAYERS = [
  { id: '2***1', avatar: '🎪' },
  { id: '2***2', avatar: '🎭' },
  { id: '2***0', avatar: '🎨' },
  { id: '2***4', avatar: '🎯' },
  { id: '2***5', avatar: '🎲' },
  { id: '2***8', avatar: '🎮' },
  { id: '2***3', avatar: '🎸' },
  { id: '2***7', avatar: '🎺' },
  { id: '2***6', avatar: '🎻' },
  { id: '2***9', avatar: '🎤' },
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
  const [crashMultiplier, setCrashMultiplier] = useState<number>(0);
  const [balance, setBalance] = useState<number>(50000);
  const [betAmount, setBetAmount] = useState<number>(100);
  const [userBet, setUserBet] = useState<Bet | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [previousMultipliers, setPreviousMultipliers] = useState<PreviousMultiplier[]>(INITIAL_PREVIOUS_MULTIPLIERS);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [multiplierIndex, setMultiplierIndex] = useState<number>(0);

  // Generate random crash point (weighted towards lower multipliers)
  const getCrashPoint = useCallback((): number => {
    const crashPoint = crashMultipliers[multiplierIndex % crashMultipliers.length];
    setMultiplierIndex(prev => prev + 1);
    return crashPoint;
  }, []);

  // Generate mock bets for other players
  const generateMockBets = useCallback((): Bet[] => {
    const numBets = Math.floor(Math.random() * 8) + 5; // 5-12 bets
    const mockBets: Bet[] = [];
    
    for (let i = 0; i < numBets; i++) {
      const player = MOCK_PLAYERS[Math.floor(Math.random() * MOCK_PLAYERS.length)];
      const amount = [50, 100, 200, 500, 1000, 2000, 5000, 10000][Math.floor(Math.random() * 8)];
      
      mockBets.push({
        id: `mock-${i}-${Date.now()}`,
        playerId: player.id,
        amount,
        avatar: player.avatar,
        isUserBet: false,
      });
    }
    
    return mockBets;
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
      const mockBets = generateMockBets();
      setBets(prev => {
        const allBets = [...mockBets];
        if (userBet) {
          allBets.unshift(userBet);
        }
        return allBets;
      });
    }
  }, [gamePhase, countdown, generateMockBets, userBet]);

  // Handle flying phase multiplier updates
  useEffect(() => {
    if (gamePhase === 'flying') {
      const crashPoint = getCrashPoint();
      setCrashMultiplier(crashPoint);
      
      const interval = setInterval(() => {
        setCurrentMultiplier(prev => {
          const increment = Math.random() * 0.08 + 0.02; // Faster increment
          const newValue = prev + increment;
          
          // Check if we should crash
          if (newValue >= crashPoint) {
            setGamePhase('crashed');
            return crashPoint;
          }
          
          return Math.round(newValue * 100) / 100;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [gamePhase, getCrashPoint]);

  // Handle crash phase
  useEffect(() => {
    if (gamePhase === 'crashed') {
      // Calculate winnings for all bets
      setBets(prev => prev.map(bet => {
        if (bet.cashedOut) {
          return bet; // Already cashed out
        }
        
        // Check if bet won (multiplier reached before crash)
        const won = crashMultiplier >= 1.0;
        if (won && !bet.cashedOut) {
          const winAmount = Math.floor(bet.amount * crashMultiplier);
          
          // Update user balance if it's their bet
          if (bet.isUserBet) {
            setBalance(prev => prev + winAmount);
          }
          
          return {
            ...bet,
            multiplier: crashMultiplier,
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
      const color = crashMultiplier < 2 ? 'text-red-400' : 
                   crashMultiplier < 5 ? 'text-green-400' :
                   crashMultiplier < 10 ? 'text-blue-400' : 
                   crashMultiplier < 20 ? 'text-purple-400' : 'text-pink-400';
      
      setPreviousMultipliers(prev => [
        { value: crashMultiplier, color },
        ...prev.slice(0, 15)
      ]);

      // Start next round after crash phase
      const timer = setTimeout(() => {
        setGamePhase('betting');
        setCountdown(BETTING_PHASE_DURATION);
        setCurrentMultiplier(1.00);
        setUserBet(null);
        setRoundNumber(prev => prev + 1);
      }, CRASH_PHASE_DURATION * 1000);

      return () => clearTimeout(timer);
    }
  }, [gamePhase, crashMultiplier]);

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
        avatar: '👤',
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
            <div className="text-4xl font-bold text-yellow-400 mb-2">
              WAITING FOR NEXT ROUND
            </div>
            <div className="flex items-center justify-center space-x-2 text-xl text-zinc-300">
              <Timer className="w-6 h-6" />
              <span>Next round starts in {countdown}s</span>
            </div>
          </div>
        );
      case 'flying':
        return (
          <div className="text-center">
            <div className="text-8xl font-bold text-green-400 animate-pulse">
              {currentMultiplier.toFixed(2)}x
            </div>
            <div className="text-green-400 text-xl mt-2">
              Flying...
            </div>
          </div>
        );
      case 'crashed':
        return (
          <div className="text-center">
            <div className="text-8xl font-bold text-red-400 animate-bounce">
              {crashMultiplier.toFixed(2)}x
            </div>
            <div className="text-red-400 text-2xl mt-4 animate-pulse">
              CRASHED!
            </div>
          </div>
        );
    }
  };

  const canPlaceBet = gamePhase === 'betting' && betAmount <= balance && betAmount >= 1 && !userBet;
  const canCashOut = gamePhase === 'flying' && userBet && !userBet.cashedOut;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Plane className="w-6 h-6 text-red-500" />
            <span className="text-xl font-bold text-red-500">Aviator</span>
          </div>
          <div className="text-sm text-zinc-400">
            Round #{roundNumber}
          </div>
        </div>
        <div className="text-green-400 font-semibold text-lg">
          {balance.toFixed(2)} KES
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-[calc(100vh-80px)]">
        {/* Left Panel - All Bets */}
        <div className="lg:col-span-3 order-3 lg:order-1">
          <Card className="h-full bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">ALL BETS</h2>
                <span className="text-sm text-zinc-400">{bets.length}</span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-xs text-zinc-400 mb-2 pb-2 border-b border-zinc-700">
                <div>Player</div>
                <div className="text-center">Bet KES</div>
                <div className="text-center">X</div>
                <div className="text-right">Win KES</div>
              </div>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {bets.map((bet) => (
                    <div key={bet.id} className={`grid grid-cols-4 gap-2 items-center py-2 text-sm border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors ${bet.isUserBet ? 'bg-zinc-800/30' : ''}`}>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{bet.avatar}</span>
                        <span className={`${bet.isUserBet ? 'text-yellow-400 font-semibold' : 'text-zinc-300'}`}>
                          {bet.playerId}
                        </span>
                      </div>
                      <div className="text-center text-zinc-300">
                        {bet.amount.toLocaleString()}.00
                      </div>
                      <div className="text-center">
                        {bet.cashedOut ? (
                          <span className="text-blue-400 font-semibold">
                            {bet.multiplier?.toFixed(2)}x
                          </span>
                        ) : bet.multiplier ? (
                          <span className="text-green-400 font-semibold">
                            {bet.multiplier.toFixed(2)}x
                          </span>
                        ) : gamePhase === 'flying' ? (
                          <span className="text-yellow-400">-</span>
                        ) : (
                          <span className="text-red-400">-</span>
                        )}
                      </div>
                      <div className="text-right">
                        {bet.winAmount ? (
                          <span className={`${bet.cashedOut ? 'text-blue-400' : 'text-green-400'}`}>
                            {bet.winAmount.toLocaleString()}.00
                          </span>
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
            <CardContent className="p-6 h-full flex flex-col">
              {/* Live Indicator and Tournament */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${gamePhase === 'flying' ? 'bg-green-500 animate-pulse' : gamePhase === 'betting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-sm font-semibold">
                      {gamePhase === 'flying' ? 'LIVE' : gamePhase === 'betting' ? 'BETTING' : 'CRASHED'}
                    </span>
                  </div>
                </div>
                <div className="text-purple-400 text-sm font-medium">
                  xTournament: Collect Highest Multiplier
                </div>
              </div>

              {/* Previous Multipliers */}
              <div className="mb-6 overflow-hidden">
                <ScrollArea className="w-full">
                  <div className="flex space-x-3 pb-2">
                    {previousMultipliers.map((mult, index) => (
                      <div
                        key={index}
                        className={`${mult.color} text-sm font-semibold whitespace-nowrap px-2 py-1 rounded bg-zinc-800/50`}
                      >
                        {mult.value.toFixed(2)}x
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Main Game Area */}
              <div className="flex-1 flex items-center justify-center relative">
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
            <CardContent className="p-4">
              <div className="space-y-6">
                {/* User Bet Status */}
                {userBet && (
                  <div className="bg-zinc-800 p-3 rounded-lg border border-zinc-700">
                    <div className="text-sm text-zinc-400 mb-1">Your Bet</div>
                    <div className="flex justify-between items-center">
                      <span className="text-white font-semibold">{userBet.amount.toFixed(2)} KES</span>
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
                  <label className="text-sm text-zinc-400 mb-2 block">Bet Amount</label>
                  <div className="flex items-center space-x-2">
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
                        className="bg-zinc-800 border-zinc-700 text-center text-lg font-semibold"
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
                  <label className="text-sm text-zinc-400 mb-2 block">Quick Bet</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_AMOUNTS.map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        onClick={() => handlePresetAmount(amount)}
                        className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-sm"
                        disabled={amount > balance || gamePhase !== 'betting'}
                      >
                        {amount.toLocaleString()}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                {canCashOut ? (
                  <Button
                    onClick={handleCashOut}
                    className="w-full h-16 text-xl font-bold bg-blue-600 hover:bg-blue-700 transition-all duration-200"
                  >
                    Cash Out {(userBet!.amount * currentMultiplier).toFixed(2)} KES
                  </Button>
                ) : (
                  <Button
                    onClick={handlePlaceBet}
                    disabled={!canPlaceBet}
                    className="w-full h-16 text-xl font-bold bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:text-zinc-500 transition-all duration-200"
                  >
                    {gamePhase === 'betting' ? 
                      (userBet ? 'Bet Placed' : `Bet ${betAmount.toFixed(2)} KES`) : 
                      gamePhase === 'flying' ? 'Round in Progress' : 'Round Ended'
                    }
                  </Button>
                )}

                {/* Game Status */}
                <div className="text-center space-y-2">
                  <div className="text-sm text-zinc-400">
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
  );
}

export default App;