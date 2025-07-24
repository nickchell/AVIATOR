import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LandingPage from './LandingPage';
import { supabase } from './lib/supabaseClient';
import './index.css';

function Root() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('aviator_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  // On mount, if user in localStorage, fetch latest from Supabase
  useEffect(() => {
    const fetchLatestUser = async () => {
      if (user && user.phone) {
        setLoading(true);
        const { data: freshUser } = await supabase
          .from('users')
          .select('*')
          .eq('phone', user.phone)
          .single();
        if (freshUser) {
          setUser(freshUser);
          localStorage.setItem('aviator_user', JSON.stringify(freshUser));
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
  if (user) return <App user={user} setUser={setUser} />;
  return <LandingPage onPlayNow={setUser} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
