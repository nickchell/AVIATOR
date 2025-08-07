import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from './lib/supabaseClient';
import { BACKEND_URL } from './lib/utils';
import { 
  Users, 
  DollarSign, 
  Activity, 
  Shield, 
  LogOut,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Zap,
  Target,
  BarChart3,
  Clock,
  Eye,
  Wallet,
  Gamepad2,
  Crown,
  Star,
  Flame,
  Coins,
  PiggyBank,
  Settings,
  Database,
  Server,
  Wifi,
  HardDrive,
  Bot
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalBets: number;
  totalWinnings: number;
  totalDeposits: number;
  totalWithdrawals: number;
  averageBetAmount: number;
  crashRate: number;
  totalPool: number;
  activePlayers: number;
  currentRound: number;
  houseProfit: number;
  profitMargin: number;
  recentActivity: number;
  systemHealth: string;
  queueSize: number;
  gamePhase: string;
}

interface User {
  id: string;
  phone: string;
  balance: number;
  created_at: string;
  last_login?: string;
  total_bets?: number;
  total_winnings?: number;
  banned?: boolean;
}

interface Bet {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  placed_at: string;
  cashed_out_at?: string;
  cashout_multiplier?: number;
  win_amount?: number;
}



interface Prediction {
  round_number: number;
  predicted_multiplier: number;
  confidence: number;
  pattern_type: string;
  reasoning: string;
}

function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [systemStatus] = useState('online');
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [botSearchTerm, setBotSearchTerm] = useState('');
  const [filteredPredictions, setFilteredPredictions] = useState<Prediction[]>([]);



  // Fetch admin statistics
  const fetchStats = async () => {
    try {
      // Fetch users count
      const { count: totalUsers, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (usersError) {
        console.error('❌ Error fetching users count:', usersError);
      }

      // Fetch active users (users with recent activity)
      const { data: activeUsersData } = await supabase
        .from('users')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const activeUsers = activeUsersData?.length || 0;

      // Fetch bets statistics
      const { data: betsData, error: betsError } = await supabase
        .from('bets')
        .select('*');

      if (betsError) {
        console.error('❌ Error fetching bets:', betsError);
      }

      const totalBets = betsData?.length || 0;
      const totalWinnings = betsData?.reduce((sum, bet) => sum + (bet.win_amount || 0), 0) || 0;
      const totalBetAmount = betsData?.reduce((sum, bet) => sum + bet.amount, 0) || 0;
      const averageBetAmount = betsData?.length ? totalBetAmount / betsData.length : 0;

      // Calculate house profit and pool
      const houseProfit = totalBetAmount - totalWinnings;
      const profitMargin = totalBetAmount > 0 ? (houseProfit / totalBetAmount) * 100 : 0;
      const totalPool = totalBetAmount; // Total money in the system

      // Fetch recent activity (bets in last hour)
      const { data: recentBets } = await supabase
        .from('bets')
        .select('*')
        .gte('placed_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      const recentActivity = recentBets?.length || 0;

      // Fetch system status
      let systemHealth = 'healthy';
      let queueSize = 0;
      let currentRound = 0;
      let gamePhase = 'unknown';

      try {
        const queueRes = await fetch(`${BACKEND_URL}/api/queue-status`);
        if (queueRes.ok) {
          const queueData = await queueRes.json();
          queueSize = queueData.socket?.queueSize || 0;
          currentRound = queueData.socket?.currentRound || 0;
          gamePhase = queueData.socket?.gamePhase || 'unknown';
          systemHealth = queueData.success ? 'healthy' : 'degraded';
        }
      } catch (error) {
        console.error('Error fetching queue status:', error);
        systemHealth = 'error';
      }

      // Fetch recent multipliers for crash rate
      let crashRate = 0;
      try {
        const res = await fetch(`${BACKEND_URL}/api/multipliers?from=0&to=100`);
        if (res.ok) {
          const multipliers = await res.json();
          const crashes = multipliers.filter((m: any) => m.multiplier < 2).length;
          crashRate = multipliers.length ? (crashes / multipliers.length) * 100 : 0;
        }
      } catch (error) {
        console.error('Error fetching multipliers:', error);
        crashRate = 0;
      }

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalBets,
        totalWinnings,
        totalDeposits: 0, // Would need deposits table
        totalWithdrawals: 0, // Would need withdrawals table
        averageBetAmount: Math.round(averageBetAmount * 100) / 100,
        crashRate: Math.round(crashRate * 100) / 100,
        totalPool: Math.round(totalPool * 100) / 100,
        activePlayers: activeUsers,
        currentRound,
        houseProfit: Math.round(houseProfit * 100) / 100,
        profitMargin: Math.round(profitMargin * 100) / 100,
        recentActivity,
        systemHealth,
        queueSize,
        gamePhase
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      console.log('🔍 Fetching users...');
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error fetching users:', error);
        return;
      }
      
      if (data) {
        // Fetch bet statistics for each user
        const usersWithStats = await Promise.all(
          data.map(async (user) => {
            try {
              const { data: userBets } = await supabase
                .from('bets')
                .select('*')
                .eq('user_id', user.id);
              
              const totalBets = userBets?.length || 0;
              const totalWinnings = userBets?.reduce((sum, bet) => sum + (bet.win_amount || 0), 0) || 0;
              
              return {
                ...user,
                total_bets: totalBets,
                total_winnings: totalWinnings,
                banned: user.banned || false
              };
            } catch (error) {
              console.error('Error fetching user bets:', error);
              return {
                ...user,
                total_bets: 0,
                total_winnings: 0,
                banned: user.banned || false
              };
            }
          })
        );
        
        setUsers(usersWithStats);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
  };

  // Fetch recent bets
  const fetchBets = async () => {
    try {
      const { data, error } = await supabase
        .from('bets')
        .select('*')
        .order('placed_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Supabase error fetching bets:', error);
        setBets([]);
        return;
      }
      
      if (data) setBets(data);
    } catch (error) {
      console.error('Error fetching bets:', error);
      setBets([]);
    }
  };

  // Update user balance
  const updateUserBalance = async (userId: string, newBalance: number) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('id', userId);
      
      if (!error) {
        fetchUsers();
        fetchStats();
      }
    } catch (error) {
      console.error('Error updating balance:', error);
    }
  };

  // Ban/Unban user
  const toggleUserBan = async (userId: string, banned: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ banned })
        .eq('id', userId);
      
      if (!error) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Error toggling ban:', error);
    }
  };



  // Get multiplier color based on value
  const getMultiplierColor = (multiplier: number) => {
    if (multiplier < 2) return 'text-red-600'; // More intense red for crashes
    if (multiplier < 5) return 'text-green-400';
    if (multiplier < 10) return 'text-blue-400';
    if (multiplier < 20) return 'text-purple-400';
    return 'text-pink-400';
  };

  // Fetch future rounds from database
  const fetchFutureRounds = async () => {
    if (!stats?.currentRound) {
      console.error('Current round not available');
      return;
    }

    setIsPredicting(true);
    try {
      // Fetch the next 10 rounds from the current round in a single batch query
      const startRound = stats.currentRound + 1;
      const endRound = stats.currentRound + 10;
      
      console.log(`🤖 Bot: Querying rounds ${startRound} to ${endRound} in single batch...`);
      
      const res = await fetch(`${BACKEND_URL}/api/multipliers?from=${startRound}&to=${endRound}`);
      if (res.ok) {
        const futureMultipliers = await res.json();
        
        console.log(`✅ Bot: Successfully fetched ${futureMultipliers.length} future rounds in batch`);
        
        // Transform the data into predictions format
        const futurePredictions: Prediction[] = futureMultipliers.map((mult: any) => ({
          round_number: mult.round_number,
          predicted_multiplier: mult.multiplier,
          confidence: 100, // Since these are actual future rounds from DB
          pattern_type: 'Database Query',
          reasoning: `Round ${mult.round_number} - Pre-generated multiplier from database queue`
        }));
        
        setPredictions(futurePredictions);
      } else {
        console.error('❌ Bot: Failed to fetch future rounds');
        setPredictions([]);
      }
    } catch (error) {
      console.error('❌ Bot: Error fetching future rounds:', error);
      setPredictions([]);
    } finally {
      setIsPredicting(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchStats(), fetchUsers(), fetchBets()]);
      } catch (error) {
        console.error('Error loading admin data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Auto-fetch future rounds when stats are loaded
  useEffect(() => {
    if (stats?.currentRound && predictions.length === 0) {
      fetchFutureRounds();
    }
  }, [stats?.currentRound]);

  // Filter predictions based on search term
  useEffect(() => {
    if (botSearchTerm.trim() === '') {
      setFilteredPredictions(predictions);
    } else {
      const filtered = predictions.filter(prediction => 
        prediction.round_number.toString().includes(botSearchTerm) ||
        prediction.predicted_multiplier.toString().includes(botSearchTerm) ||
        prediction.pattern_type.toLowerCase().includes(botSearchTerm.toLowerCase())
      );
      setFilteredPredictions(filtered);
    }
  }, [predictions, botSearchTerm]);

  // Filter users based on search
  const filteredUsers = users.filter(user =>
    user.phone.includes(searchTerm) || user.id.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Shield className="w-8 h-8 text-yellow-400" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Aviator Admin Dashboard</h1>
              <p className="text-sm sm:text-base text-zinc-400">Game Management & Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <Badge variant={systemStatus === 'online' ? 'default' : 'destructive'} className="text-xs">
              {systemStatus === 'online' ? (
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              ) : (
                <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              )}
              {systemStatus}
            </Badge>

            <Button variant="outline" onClick={() => window.location.href = '/'} className="text-xs sm:text-sm">
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Exit Admin</span>
              <span className="sm:hidden">Exit</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-auto sm:h-10 text-xs sm:text-sm">
            <TabsTrigger value="overview" className="py-2 sm:py-0">Overview</TabsTrigger>
            <TabsTrigger value="users" className="py-2 sm:py-0">Users</TabsTrigger>
            <TabsTrigger value="bets" className="py-2 sm:py-0">Bets</TabsTrigger>
            <TabsTrigger value="multipliers" className="flex items-center gap-1 sm:gap-2 py-2 sm:py-0">
              <Bot className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Bot</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="py-2 sm:py-0">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* System Status Banner */}
            <div className={`p-4 rounded-lg border ${
              stats?.systemHealth === 'healthy' ? 'bg-green-900/20 border-green-500/30' :
              stats?.systemHealth === 'degraded' ? 'bg-yellow-900/20 border-yellow-500/30' :
              'bg-red-900/20 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {stats?.systemHealth === 'healthy' ? (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  ) : stats?.systemHealth === 'degraded' ? (
                    <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400" />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">System Status: {stats?.systemHealth}</h3>
                    <p className="text-sm text-zinc-400">
                      Round #{stats?.currentRound} • Phase: {stats?.gamePhase} • Queue: {stats?.queueSize || 0} multipliers
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">Last Updated</p>
                  <p className="font-mono text-sm">{new Date().toLocaleTimeString()}</p>
                </div>
              </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Total Pool */}
              <Card className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-blue-300">Total Pool</CardTitle>
                  <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-blue-100">KES {stats?.totalPool.toLocaleString()}</div>
                  <p className="text-xs text-blue-300/70">
                    Total money in system
                  </p>
                </CardContent>
              </Card>

              {/* Active Players */}
              <Card className="bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-green-300">Active Players</CardTitle>
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-green-100">{stats?.activePlayers.toLocaleString()}</div>
                  <p className="text-xs text-green-300/70">
                    {stats?.recentActivity} bets in last hour
                  </p>
                </CardContent>
              </Card>

              {/* House Profit */}
              <Card className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 border-yellow-500/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-yellow-300">House Profit</CardTitle>
                  <PiggyBank className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-yellow-100">KES {stats?.houseProfit.toLocaleString()}</div>
                  <p className="text-xs text-yellow-300/70">
                    {stats?.profitMargin.toFixed(1)}% margin
                  </p>
                </CardContent>
              </Card>

              {/* Crash Rate */}
              <Card className="bg-gradient-to-br from-red-900/20 to-red-800/20 border-red-500/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-red-300">Crash Rate</CardTitle>
                  <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-red-100">{stats?.crashRate.toFixed(1)}%</div>
                  <p className="text-xs text-red-300/70">
                    &lt; 2x crashes
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Secondary Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Total Users */}
              <Card className="bg-zinc-900/50 border-zinc-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-zinc-400">Total Users</CardTitle>
                  <Users className="h-4 w-4 sm:h-4 sm:w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold">{stats?.totalUsers.toLocaleString()}</div>
                  <p className="text-xs text-zinc-400">
                    All time registered
                  </p>
                </CardContent>
              </Card>

              {/* Total Bets */}
              <Card className="bg-zinc-900/50 border-zinc-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-zinc-400">Total Bets</CardTitle>
                  <Activity className="h-4 w-4 sm:h-4 sm:w-4 text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold">{stats?.totalBets.toLocaleString()}</div>
                  <p className="text-xs text-zinc-400">
                    Avg: KES {stats?.averageBetAmount}
                  </p>
                </CardContent>
              </Card>

              {/* Total Winnings */}
              <Card className="bg-zinc-900/50 border-zinc-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-zinc-400">Total Winnings</CardTitle>
                  <DollarSign className="h-4 w-4 sm:h-4 sm:w-4 text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold">KES {stats?.totalWinnings.toLocaleString()}</div>
                  <p className="text-xs text-zinc-400">
                    Paid to players
                  </p>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="bg-zinc-900/50 border-zinc-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-zinc-400">Recent Activity</CardTitle>
                  <Clock className="h-4 w-4 sm:h-4 sm:w-4 text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold">{stats?.recentActivity}</div>
                  <p className="text-xs text-zinc-400">
                    Bets in last hour
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* System Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Profit Margin Chart */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                    Profit Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-zinc-400">Profit Margin</span>
                      <span className="text-sm sm:text-lg font-bold text-yellow-400">{stats?.profitMargin.toFixed(1)}%</span>
                    </div>
                    <Progress value={Math.min(stats?.profitMargin || 0, 100)} className="h-2" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="text-center p-3 bg-zinc-800/50 rounded">
                        <p className="text-xs sm:text-sm text-zinc-400">House Profit</p>
                        <p className="text-sm sm:text-lg font-bold text-green-400">KES {stats?.houseProfit.toLocaleString()}</p>
                      </div>
                      <div className="text-center p-3 bg-zinc-800/50 rounded">
                        <p className="text-xs sm:text-sm text-zinc-400">Total Pool</p>
                        <p className="text-sm sm:text-lg font-bold text-blue-400">KES {stats?.totalPool.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Health */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Server className="w-4 h-4 sm:w-5 sm:h-5" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-zinc-400">Queue Status</span>
                      <Badge variant={(stats?.queueSize || 0) > 10 ? "default" : "secondary"} className="text-xs">
                        {stats?.queueSize || 0} multipliers
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-zinc-400">Game Phase</span>
                      <Badge variant="outline" className="capitalize text-xs">
                        {stats?.gamePhase}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-zinc-400">Current Round</span>
                      <span className="font-mono text-sm sm:text-lg font-bold text-purple-400">#{stats?.currentRound}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="text-center p-3 bg-zinc-800/50 rounded">
                        <p className="text-xs sm:text-sm text-zinc-400">Active Players</p>
                        <p className="text-sm sm:text-lg font-bold text-green-400">{stats?.activePlayers}</p>
                      </div>
                      <div className="text-center p-3 bg-zinc-800/50 rounded">
                        <p className="text-xs sm:text-sm text-zinc-400">Crash Rate</p>
                        <p className="text-sm sm:text-lg font-bold text-red-400">{stats?.crashRate.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 sm:gap-4">
                <Button onClick={fetchStats} className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm">
                  <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Refresh Stats
                </Button>
                <Button 
                  variant={maintenanceMode ? "destructive" : "outline"}
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className="text-xs sm:text-sm"
                >
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  {maintenanceMode ? 'Disable' : 'Enable'} Maintenance
                </Button>
                <Button variant="outline" onClick={() => window.open(`${BACKEND_URL}/health`, '_blank')} className="text-xs sm:text-sm">
                  <Database className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Backend Health
                </Button>
                <Button variant="outline" onClick={() => window.open(`${BACKEND_URL}/api/queue-status`, '_blank')} className="text-xs sm:text-sm">
                  <Wifi className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Queue Status
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            {/* User Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/30">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-blue-300">Total Users</p>
                      <p className="text-lg sm:text-2xl font-bold text-blue-100">{users.length}</p>
                    </div>
                    <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-green-300">Active Users</p>
                      <p className="text-lg sm:text-2xl font-bold text-green-100">{stats?.activeUsers}</p>
                    </div>
                    <Eye className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 border-yellow-500/30">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-yellow-300">Total Balance</p>
                      <p className="text-lg sm:text-2xl font-bold text-yellow-100">
                        KES {users.reduce((sum, user) => sum + user.balance, 0).toLocaleString()}
                      </p>
                    </div>
                    <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-purple-300">Banned Users</p>
                      <p className="text-lg sm:text-2xl font-bold text-purple-100">
                        {users.filter(u => u.banned).length}
                      </p>
                    </div>
                    <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* User Management */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Crown className="w-4 h-4 sm:w-5 sm:h-5" />
                    User Management
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <Input
                        placeholder="Search users by phone or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full"
                      />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {filteredUsers.length} of {users.length} users
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className={`p-4 border rounded-lg transition-all hover:bg-zinc-800/50 ${
                      user.banned ? 'border-red-500/30 bg-red-900/10' : 'border-zinc-800'
                    }`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full">
                          {/* User Avatar */}
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm sm:text-lg">
                              {user.phone.slice(-2)}
                            </span>
                          </div>

                          {/* User Info */}
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <p className="font-semibold text-base sm:text-lg">{user.phone}</p>
                              {user.banned && (
                                <Badge variant="destructive" className="text-xs w-fit">
                                  BANNED
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-zinc-400 font-mono">ID: {user.id.slice(0, 8)}...</p>
                            <p className="text-xs text-zinc-500">
                              Joined: {new Date(user.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-2 sm:gap-6 text-center w-full sm:w-auto">
                            <div className="p-2 sm:p-3 bg-zinc-800/50 rounded">
                              <p className="text-sm sm:text-lg font-bold text-green-400">KES {user.balance.toFixed(2)}</p>
                              <p className="text-xs text-zinc-400">Balance</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-zinc-800/50 rounded">
                              <p className="text-sm sm:text-lg font-bold">{user.total_bets || 0}</p>
                              <p className="text-xs text-zinc-400">Total Bets</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-zinc-800/50 rounded">
                              <p className="text-sm sm:text-lg font-bold text-yellow-400">
                                KES {(user.total_winnings || 0).toFixed(2)}
                              </p>
                              <p className="text-xs text-zinc-400">Winnings</p>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedUser(user)}
                            className="hover:bg-blue-600 hover:text-white flex-1 sm:flex-none text-xs"
                          >
                            <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={(user.banned ?? false) ? "default" : "destructive"}
                            onClick={() => toggleUserBan(user.id, !(user.banned ?? false))}
                            className="flex-1 sm:flex-none text-xs"
                          >
                            {(user.banned ?? false) ? (
                              <>
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                Unban
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                Ban
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bets Tab */}
          <TabsContent value="bets" className="space-y-6">
            {/* Bet Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card className="bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-green-300">Total Bets</p>
                      <p className="text-lg sm:text-2xl font-bold text-green-100">{bets.length}</p>
                    </div>
                    <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/30">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-blue-300">Total Bet Amount</p>
                      <p className="text-lg sm:text-2xl font-bold text-blue-100">
                        KES {bets.reduce((sum, bet) => sum + bet.amount, 0).toLocaleString()}
                      </p>
                    </div>
                    <Coins className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 border-yellow-500/30">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-yellow-300">Total Winnings</p>
                      <p className="text-lg sm:text-2xl font-bold text-yellow-100">
                        KES {bets.reduce((sum, bet) => sum + (bet.win_amount || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-purple-300">Success Rate</p>
                      <p className="text-lg sm:text-2xl font-bold text-purple-100">
                        {bets.length > 0 ? Math.round((bets.filter(bet => bet.status === 'cashed_out').length / bets.length) * 100) : 0}%
                      </p>
                    </div>
                    <Target className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Bets */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  Recent Bets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bets.map((bet) => (
                    <div key={bet.id} className={`p-4 border rounded-lg transition-all hover:bg-zinc-800/50 ${
                      bet.status === 'cashed_out' ? 'border-green-500/30 bg-green-900/10' :
                      bet.status === 'crashed' ? 'border-red-500/30 bg-red-900/10' :
                      'border-zinc-800'
                    }`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full">
                          {/* Bet Amount */}
                          <div className="text-center">
                            <p className="text-base sm:text-lg font-bold text-white">KES {bet.amount.toFixed(2)}</p>
                            <p className="text-xs text-zinc-400">Bet Amount</p>
                          </div>

                          {/* Status */}
                          <div className="text-center">
                            <Badge variant={
                              bet.status === 'cashed_out' ? 'default' :
                              bet.status === 'crashed' ? 'destructive' : 'secondary'
                            } className="mb-1 text-xs">
                              {bet.status === 'cashed_out' ? 'CASHED OUT' :
                               bet.status === 'crashed' ? 'CRASHED' : 'PENDING'}
                            </Badge>
                            <p className="text-xs text-zinc-400">
                              {new Date(bet.placed_at).toLocaleString()}
                            </p>
                          </div>

                          {/* Multiplier */}
                          {bet.cashout_multiplier && (
                            <div className="text-center">
                              <p className="text-base sm:text-lg font-bold text-green-400">{bet.cashout_multiplier.toFixed(2)}x</p>
                              <p className="text-xs text-zinc-400">Multiplier</p>
                            </div>
                          )}

                          {/* Win Amount */}
                          {bet.win_amount && bet.win_amount > 0 && (
                            <div className="text-center">
                              <p className="text-base sm:text-lg font-bold text-yellow-400">+KES {bet.win_amount.toFixed(2)}</p>
                              <p className="text-xs text-zinc-400">Winnings</p>
                            </div>
                          )}

                          {/* User ID */}
                          <div className="text-center">
                            <p className="text-xs sm:text-sm font-mono text-zinc-400">{bet.user_id.slice(0, 8)}...</p>
                            <p className="text-xs text-zinc-500">User ID</p>
                          </div>
                        </div>

                        {/* Status Icon */}
                        <div className="flex items-center">
                          {bet.status === 'cashed_out' ? (
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                          ) : bet.status === 'crashed' ? (
                            <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                          ) : (
                            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Multipliers Tab */}
          <TabsContent value="multipliers" className="space-y-6">
            {/* Bot Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  placeholder="Search predictions by round, multiplier, or pattern..."
                  value={botSearchTerm}
                  onChange={(e) => setBotSearchTerm(e.target.value)}
                  className="pl-10 bg-zinc-800/50 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
                />
              </div>
              <div className="text-sm text-zinc-400 whitespace-nowrap">
                {filteredPredictions.length} of {predictions.length} predictions
              </div>
            </div>

            {/* Future Rounds Prediction */}
            <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    Future Rounds Prediction
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="text-sm text-purple-300">
                      Current Round: <span className="font-bold text-purple-100">#{stats?.currentRound || 0}</span>
                    </div>
                    <Button 
                      onClick={fetchFutureRounds}
                      disabled={isPredicting || !stats?.currentRound}
                      className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto"
                    >
                      {isPredicting ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Bot className="w-4 h-4 mr-2" />
                      )}
                      {isPredicting ? 'Predicting...' : 'Predict Next 10 Rounds'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredPredictions.length > 0 ? (
                  <div className="space-y-3">
                    {/* Desktop Table Header */}
                    <div className="hidden md:grid grid-cols-5 gap-4 text-sm text-purple-300 border-b border-purple-700/50 pb-3 font-semibold">
                      <div className="text-center">Round</div>
                      <div className="text-center">Predicted Multiplier</div>
                      <div className="text-center">Confidence</div>
                      <div className="text-center">Pattern Type</div>
                      <div className="text-center">Status</div>
                    </div>
                    {filteredPredictions.map((prediction) => (
                      <div key={prediction.round_number}>
                        {/* Desktop View */}
                        <div className={`hidden md:grid grid-cols-5 gap-4 items-center p-4 border rounded-lg hover:bg-purple-800/20 transition-all ${
                          prediction.predicted_multiplier < 2 ? 'border-red-500/30 bg-red-900/10' :
                          prediction.predicted_multiplier < 5 ? 'border-green-500/30 bg-green-900/10' :
                          prediction.predicted_multiplier < 10 ? 'border-blue-500/30 bg-blue-900/10' :
                          'border-purple-500/30 bg-purple-900/10'
                        }`}>
                          <div className="text-center">
                            <p className="font-bold text-lg text-purple-200">#{prediction.round_number}</p>
                          </div>
                          <div className="text-center">
                            <p className={`font-bold text-2xl ${getMultiplierColor(prediction.predicted_multiplier)}`}>
                              {prediction.predicted_multiplier.toFixed(2)}x
                            </p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-purple-800 rounded-full h-2">
                                <div 
                                  className="bg-purple-400 h-2 rounded-full transition-all"
                                  style={{ width: `${prediction.confidence}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-semibold text-purple-300">{prediction.confidence}%</span>
                            </div>
                          </div>
                          <div className="text-center">
                            <Badge variant="outline" className="text-xs px-2 py-1 border-purple-500/50 text-purple-300">
                              {prediction.pattern_type}
                            </Badge>
                          </div>
                          <div className="text-center">
                            {prediction.predicted_multiplier < 2 ? (
                              <div className="flex items-center justify-center gap-1">
                                <XCircle className="w-4 h-4 text-red-400" />
                                <span className="text-xs text-red-400">Crash</span>
                              </div>
                            ) : prediction.predicted_multiplier < 5 ? (
                              <div className="flex items-center justify-center gap-1">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                <span className="text-xs text-green-400">Safe</span>
                              </div>
                            ) : prediction.predicted_multiplier < 10 ? (
                              <div className="flex items-center justify-center gap-1">
                                <Star className="w-4 h-4 text-blue-400" />
                                <span className="text-xs text-blue-400">Good</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <Crown className="w-4 h-4 text-purple-400" />
                                <span className="text-xs text-purple-400">Amazing</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Mobile View */}
                        <div className={`md:hidden p-4 border rounded-lg hover:bg-purple-800/20 transition-all ${
                          prediction.predicted_multiplier < 2 ? 'border-red-500/30 bg-red-900/10' :
                          prediction.predicted_multiplier < 5 ? 'border-green-500/30 bg-green-900/10' :
                          prediction.predicted_multiplier < 10 ? 'border-blue-500/30 bg-blue-900/10' :
                          'border-purple-500/30 bg-purple-900/10'
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-lg text-purple-200">#{prediction.round_number}</p>
                              <Badge variant="outline" className="text-xs px-2 py-1 border-purple-500/50 text-purple-300">
                                {prediction.pattern_type}
                              </Badge>
                            </div>
                            {prediction.predicted_multiplier < 2 ? (
                              <div className="flex items-center gap-1">
                                <XCircle className="w-4 h-4 text-red-400" />
                                <span className="text-xs text-red-400">Crash</span>
                              </div>
                            ) : prediction.predicted_multiplier < 5 ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                <span className="text-xs text-green-400">Safe</span>
                              </div>
                            ) : prediction.predicted_multiplier < 10 ? (
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-blue-400" />
                                <span className="text-xs text-blue-400">Good</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Crown className="w-4 h-4 text-purple-400" />
                                <span className="text-xs text-purple-400">Amazing</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-center">
                              <p className={`font-bold text-2xl ${getMultiplierColor(prediction.predicted_multiplier)}`}>
                                {prediction.predicted_multiplier.toFixed(2)}x
                              </p>
                              <p className="text-xs text-purple-400">Multiplier</p>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-purple-800 rounded-full h-2">
                                  <div 
                                    className="bg-purple-400 h-2 rounded-full transition-all"
                                    style={{ width: `${prediction.confidence}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-semibold text-purple-300">{prediction.confidence}%</span>
                              </div>
                              <p className="text-xs text-purple-400 mt-1">Confidence</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-purple-400 py-12">
                    {isPredicting ? (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin" />
                        <p className="text-lg">Querying future rounds from database...</p>
                      </div>
                    ) : predictions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Bot className="w-12 h-12 text-purple-600" />
                        <p className="text-lg">Click "Predict Next 10 Rounds" to see future multipliers</p>
                        <p className="text-sm text-purple-500">The bot will query the database for pre-generated rounds</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Search className="w-12 h-12 text-purple-600" />
                        <p className="text-lg">No predictions match your search</p>
                        <p className="text-sm text-purple-500">Try adjusting your search terms</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {/* System Status Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Server className="w-4 h-4 sm:w-5 sm:h-5" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded">
                    <div className="flex items-center gap-3">
                      {stats?.systemHealth === 'healthy' ? (
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                      ) : stats?.systemHealth === 'degraded' ? (
                        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                      ) : (
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                      )}
                      <div>
                        <p className="font-semibold text-sm sm:text-base">Backend Health</p>
                        <p className="text-xs sm:text-sm text-zinc-400">API and database status</p>
                      </div>
                    </div>
                    <Badge variant={
                      stats?.systemHealth === 'healthy' ? 'default' :
                      stats?.systemHealth === 'degraded' ? 'secondary' : 'destructive'
                    } className="text-xs">
                      {stats?.systemHealth || 'unknown'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded">
                    <div className="flex items-center gap-3">
                      <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                      <div>
                        <p className="font-semibold text-sm sm:text-base">Socket Server</p>
                        <p className="text-xs sm:text-sm text-zinc-400">Real-time game connections</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {stats?.queueSize || 0} in queue
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded">
                    <div className="flex items-center gap-3">
                      <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                      <div>
                        <p className="font-semibold text-sm sm:text-base">Game Phase</p>
                        <p className="text-xs sm:text-sm text-zinc-400">Current game state</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {stats?.gamePhase || 'unknown'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded">
                    <div className="flex items-center gap-3">
                      <Target className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                      <div>
                        <p className="font-semibold text-sm sm:text-base">Current Round</p>
                        <p className="text-xs sm:text-sm text-zinc-400">Active game round</p>
                      </div>
                    </div>
                    <span className="font-mono text-sm sm:text-lg font-bold text-purple-400">
                      #{stats?.currentRound || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                    System Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-800/50 rounded gap-2">
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Maintenance Mode</p>
                      <p className="text-xs sm:text-sm text-zinc-400">Disable game access for all users</p>
                    </div>
                    <Button
                      variant={maintenanceMode ? "destructive" : "outline"}
                      onClick={() => setMaintenanceMode(!maintenanceMode)}
                      className="text-xs sm:text-sm w-full sm:w-auto"
                    >
                      {maintenanceMode ? 'Disable' : 'Enable'}
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-800/50 rounded gap-2">
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Auto Refresh</p>
                      <p className="text-xs sm:text-sm text-zinc-400">Automatically update stats</p>
                    </div>
                    <Button variant="outline" onClick={fetchStats} className="text-xs sm:text-sm w-full sm:w-auto">
                      <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Refresh Now
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-800/50 rounded gap-2">
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Backend Health Check</p>
                      <p className="text-xs sm:text-sm text-zinc-400">Check backend API status</p>
                    </div>
                    <Button variant="outline" onClick={() => window.open(`${BACKEND_URL}/health`, '_blank')} className="text-xs sm:text-sm w-full sm:w-auto">
                      <Database className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Check
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-800/50 rounded gap-2">
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Queue Status</p>
                      <p className="text-xs sm:text-sm text-zinc-400">View multiplier queue</p>
                    </div>
                    <Button variant="outline" onClick={() => window.open(`${BACKEND_URL}/api/queue-status`, '_blank')} className="text-xs sm:text-sm w-full sm:w-auto">
                      <Wifi className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Information */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-zinc-800/50 rounded">
                    <p className="text-xs sm:text-sm text-zinc-400">Total Users</p>
                    <p className="text-lg sm:text-xl font-bold">{stats?.totalUsers.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded">
                    <p className="text-xs sm:text-sm text-zinc-400">Active Players</p>
                    <p className="text-lg sm:text-xl font-bold">{stats?.activePlayers}</p>
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded">
                    <p className="text-xs sm:text-sm text-zinc-400">Total Pool</p>
                    <p className="text-lg sm:text-xl font-bold">KES {stats?.totalPool.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded">
                    <p className="text-xs sm:text-sm text-zinc-400">House Profit</p>
                    <p className="text-lg sm:text-xl font-bold text-green-400">KES {stats?.houseProfit.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* User Edit Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="bg-zinc-900 border-zinc-800 w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-sm sm:text-base">Edit User: {selectedUser.phone}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs sm:text-sm">Balance</Label>
                <Input
                  type="number"
                  value={selectedUser.balance}
                  onChange={(e) => setSelectedUser({
                    ...selectedUser,
                    balance: parseFloat(e.target.value) || 0
                  })}
                  className="text-sm sm:text-base"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => updateUserBalance(selectedUser.id, selectedUser.balance)} className="text-xs sm:text-sm">
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setSelectedUser(null)} className="text-xs sm:text-sm">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default AdminPage; 