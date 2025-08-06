import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LandingPage from './LandingPage';
import AdminPage from './AdminPage';
import { supabase } from './lib/supabaseClient';
import './index.css';

function Root() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('aviator_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  // Check if we're on the admin page
  const isAdminPage = window.location.pathname === '/admin';

  // On mount, if user in localStorage, fetch latest from Supabase
  useEffect(() => {
    const fetchLatestUser = async () => {
      if (user && user.phone) {
        setLoading(true);
        console.log('🔄 Fetching latest user data for:', user.phone);
        const { data: freshUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('phone', user.phone)
          .single();
        
        if (error) {
          console.error('❌ Error fetching user data:', error);
          setLoading(false);
          return;
        }
        
        if (freshUser) {
          console.log('✅ User data loaded:', { 
            id: freshUser.id, 
            phone: freshUser.phone, 
            balance: freshUser.balance 
          });
          setUser(freshUser);
          localStorage.setItem('aviator_user', JSON.stringify(freshUser));
        } else {
          console.warn('⚠️ No user data found for phone:', user.phone);
        }
        setLoading(false);
      }
    };
    fetchLatestUser();
    // eslint-disable-next-line
  }, [user && user.phone]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('aviator_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('aviator_user');
    }
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white text-xl">Loading...</div>;
  
  // Route to admin page if URL is /admin
  if (isAdminPage) {
    return <AdminPage />;
  }
  
  // Normal app flow
  if (user) return <App user={user} setUser={setUser} />;
  return <LandingPage onPlayNow={setUser} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
