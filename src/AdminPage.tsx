import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from './lib/supabaseClient';
import { BACKEND_URL } from './lib/utils';
import { 
  Users, 
  DollarSign, 
  Activity, 
  Shield, 
  LogOut,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search
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

interface Multiplier {
  round_number: number;
  multiplier: number;
}

function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [multipliers, setMultipliers] = useState<Multiplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [systemStatus] = useState('online');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [roundSearch, setRoundSearch] = useState('');
  const [searchingMultipliers, setSearchingMultipliers] = useState(false);

  // Fetch admin statistics
  const fetchStats = async () => {
    try {
      // Fetch users count
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Fetch active users (logged in last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: activeUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('last_login', yesterday);

      // Fetch bets statistics
      const { data: betsData } = await supabase
        .from('bets')
        .select('*');

      const totalBets = betsData?.length || 0;
      const totalWinnings = betsData?.reduce((sum, bet) => sum + (bet.win_amount || 0), 0) || 0;
      const averageBetAmount = betsData?.length ? 
        betsData.reduce((sum, bet) => sum + bet.amount, 0) / betsData.length : 0;

      // Fetch recent multipliers for crash rate
      const res = await fetch(`${BACKEND_URL}/api/multipliers?from=0&to=100`);
      const multipliers = res.ok ? await res.json() : [];
      const crashes = multipliers.filter((m: any) => m.multiplier < 2).length;
      const crashRate = multipliers.length ? (crashes / multipliers.length) * 100 : 0;

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalBets,
        totalWinnings,
        totalDeposits: 0, // Would need deposits table
        totalWithdrawals: 0, // Would need withdrawals table
        averageBetAmount: Math.round(averageBetAmount * 100) / 100,
        crashRate: Math.round(crashRate * 100) / 100
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        // Fetch bet statistics for each user
        const usersWithStats = await Promise.all(
          data.map(async (user) => {
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
          })
        );
        
        setUsers(usersWithStats);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Fetch recent bets
  const fetchBets = async () => {
    try {
      const { data } = await supabase
        .from('bets')
        .select('*')
        .order('placed_at', { ascending: false })
        .limit(50);
      
      if (data) setBets(data);
    } catch (error) {
      console.error('Error fetching bets:', error);
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

  // Search multipliers by round
  const searchMultipliers = async (roundNumber: string) => {
    if (!roundNumber.trim()) return;
    
    setSearchingMultipliers(true);
    try {
      const round = parseInt(roundNumber);
      if (isNaN(round)) {
        alert('Please enter a valid round number');
        return;
      }

      // Search for a range around the specified round
      const from = Math.max(0, round - 5);
      const to = round + 5;
      
      const res = await fetch(`${BACKEND_URL}/api/multipliers?from=${from}&to=${to}`);
      if (res.ok) {
        const data = await res.json();
        setMultipliers(data);
      } else {
        alert('Failed to fetch multipliers');
        setMultipliers([]);
      }
    } catch (error) {
      console.error('Error searching multipliers:', error);
      alert('Error searching multipliers');
      setMultipliers([]);
    } finally {
      setSearchingMultipliers(false);
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

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchUsers(), fetchBets()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Filter users based on search
  const filteredUsers = users.filter(user =>
    user.phone.includes(searchTerm) || user.id.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="w-8 h-8 text-yellow-400" />
            <div>
              <h1 className="text-2xl font-bold">Aviator Admin Dashboard</h1>
              <p className="text-zinc-400">Game Management & Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={systemStatus === 'online' ? 'default' : 'destructive'}>
              {systemStatus === 'online' ? (
                <CheckCircle className="w-4 h-4 mr-1" />
              ) : (
                <XCircle className="w-4 h-4 mr-1" />
              )}
              {systemStatus}
            </Badge>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              <LogOut className="w-4 h-4 mr-2" />
              Exit Admin
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="bets">Bets</TabsTrigger>
            <TabsTrigger value="multipliers">Multipliers</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-400">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalUsers.toLocaleString()}</div>
                  <p className="text-xs text-zinc-400">
                    {stats?.activeUsers} active today
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-400">Total Bets</CardTitle>
                  <Activity className="h-4 w-4 text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalBets.toLocaleString()}</div>
                  <p className="text-xs text-zinc-400">
                    Avg: KES {stats?.averageBetAmount}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-400">Total Winnings</CardTitle>
                  <DollarSign className="h-4 w-4 text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">KES {stats?.totalWinnings.toLocaleString()}</div>
                  <p className="text-xs text-zinc-400">
                    All time
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-400">Crash Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-red-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.crashRate}%</div>
                  <p className="text-xs text-zinc-400">
                    &lt; 2x crashes
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Button onClick={fetchStats}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Stats
                </Button>
                <Button 
                  variant={maintenanceMode ? "destructive" : "outline"}
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {maintenanceMode ? 'Disable' : 'Enable'} Maintenance
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <Input
                  placeholder="Search users by phone or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-zinc-800 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-semibold">{user.phone}</p>
                            <p className="text-sm text-zinc-400">ID: {user.id}</p>
                            <p className="text-sm text-zinc-400">
                              Joined: {new Date(user.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-green-400">KES {user.balance.toFixed(2)}</p>
                            <p className="text-xs text-zinc-400">Balance</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold">{user.total_bets || 0}</p>
                            <p className="text-xs text-zinc-400">Total Bets</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-yellow-400">
                              KES {(user.total_winnings || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-zinc-400">Winnings</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedUser(user)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={(user.banned ?? false) ? "default" : "destructive"}
                          onClick={() => toggleUserBan(user.id, !(user.banned ?? false))}
                        >
                          {(user.banned ?? false) ? 'Unban' : 'Ban'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bets Tab */}
          <TabsContent value="bets" className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle>Recent Bets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bets.map((bet) => (
                    <div key={bet.id} className="flex items-center justify-between p-3 border border-zinc-800 rounded">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-semibold">KES {bet.amount.toFixed(2)}</p>
                          <p className="text-sm text-zinc-400">
                            {new Date(bet.placed_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={
                          bet.status === 'cashed_out' ? 'default' :
                          bet.status === 'crashed' ? 'destructive' : 'secondary'
                        }>
                          {bet.status}
                        </Badge>
                        {bet.cashout_multiplier && (
                          <span className="text-green-400 font-semibold">
                            {bet.cashout_multiplier.toFixed(2)}x
                          </span>
                        )}
                        {bet.win_amount && bet.win_amount > 0 && (
                          <span className="text-yellow-400 font-semibold">
                            +KES {bet.win_amount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Multipliers Tab */}
          <TabsContent value="multipliers" className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-xl">Multiplier Search</CardTitle>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter round number (e.g., 7000)..."
                    value={roundSearch}
                    onChange={(e) => setRoundSearch(e.target.value)}
                    className="max-w-xs"
                    onKeyPress={(e) => e.key === 'Enter' && searchMultipliers(roundSearch)}
                  />
                  <Button 
                    onClick={() => searchMultipliers(roundSearch)}
                    disabled={searchingMultipliers}
                  >
                    {searchingMultipliers ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Search
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {multipliers.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-6 text-sm text-zinc-400 border-b border-zinc-700 pb-3 font-semibold">
                      <div className="text-center">Round Number</div>
                      <div className="text-center">Multiplier</div>
                      <div className="text-center">Status</div>
                    </div>
                    {multipliers.map((mult) => (
                      <div key={mult.round_number} className="grid grid-cols-3 gap-6 items-center p-4 border border-zinc-800 rounded-lg hover:bg-zinc-800/50 transition-colors">
                        <div className="text-center">
                          <p className="font-bold text-lg text-zinc-200">#{mult.round_number}</p>
                        </div>
                        <div className="text-center">
                          <p className={`font-bold text-2xl ${getMultiplierColor(mult.multiplier)}`}>
                            {mult.multiplier.toFixed(2)}x
                          </p>
                        </div>
                        <div className="text-center">
                          <Badge 
                            variant={mult.multiplier < 2 ? 'destructive' : 'default'}
                            className="text-sm px-3 py-1"
                          >
                            {mult.multiplier < 2 ? 'Crashed' : 'Flew Away'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-zinc-400 py-12">
                    {searchingMultipliers ? (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin" />
                        <p className="text-lg">Searching multipliers...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Search className="w-12 h-12 text-zinc-600" />
                        <p className="text-lg">Enter a round number to search for multipliers</p>
                        <p className="text-sm text-zinc-500">Example: 7000</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Maintenance Mode</Label>
                    <p className="text-sm text-zinc-400">Disable game access for all users</p>
                  </div>
                  <Button
                    variant={maintenanceMode ? "destructive" : "outline"}
                    onClick={() => setMaintenanceMode(!maintenanceMode)}
                  >
                    {maintenanceMode ? 'Disable' : 'Enable'}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>System Status</Label>
                    <p className="text-sm text-zinc-400">Current system health</p>
                  </div>
                  <Badge variant={systemStatus === 'online' ? 'default' : 'destructive'}>
                    {systemStatus}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* User Edit Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="bg-zinc-900 border-zinc-800 w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit User: {selectedUser.phone}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Balance</Label>
                <Input
                  type="number"
                  value={selectedUser.balance}
                  onChange={(e) => setSelectedUser({
                    ...selectedUser,
                    balance: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => updateUserBalance(selectedUser.id, selectedUser.balance)}>
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setSelectedUser(null)}>
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