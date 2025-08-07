import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import Footer from '@/components/Footer';

type LandingPageProps = {
  onPlayNow: (user: any) => void;
};

const LandingPage: React.FC<LandingPageProps> = ({ onPlayNow }) => {
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedAge, setAgreedAge] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);

  const handlePlayNowClick = () => {
    setShowModal(true);
  };

  // Check if phone is registered when 10 digits are entered
  useEffect(() => {
    const checkRegistered = async () => {
      if (phone.length === 10 && /^07\d{8}$/.test(phone)) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('phone', phone)
          .single();
        setIsRegistered(!!existingUser);
      } else {
        setIsRegistered(null);
      }
    };
    checkRegistered();
  }, [phone]);

  const handleContinue = async () => {
    if (!/^07\d{8}$/.test(phone)) {
      setError('Please enter a valid Kenyan phone number (07XXXXXXXX)');
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError('Please enter a valid 4-6 digit PIN');
      return;
    }
    setError('');
    setLoading(true);
    if (isRegistered) {
      // Login mode
      console.log('🔐 Attempting login for phone:', phone);
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();
      
      if (error) {
        console.error('❌ Error during login:', error);
        setLoading(false);
        setError('Login failed. Please try again.');
        return;
      }
      
      if (!existingUser || existingUser.pin !== pin) {
        console.log('❌ Login failed: Invalid credentials');
        setLoading(false);
        setError('Incorrect PIN.');
        return;
      }
      
      console.log('✅ Login successful:', { 
        id: existingUser.id, 
        phone: existingUser.phone, 
        balance: existingUser.balance 
      });
      
      setLoading(false);
      setShowModal(false);
      onPlayNow(existingUser);
      return;
    } else {
      // Registration mode
      if (!agreedTerms) {
        setLoading(false);
        setError('You must agree to the terms and conditions');
        return;
      }
      if (!agreedAge) {
        setLoading(false);
        setError('You must confirm you are over 18');
        return;
      }
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ phone, pin, balance: 0 }])
        .select()
        .single();
      if (insertError) {
        setLoading(false);
        setError('Failed to register. Please try again.');
        return;
      }
      setLoading(false);
      setShowModal(false);
      onPlayNow(newUser);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-950 via-black to-green-900 text-white font-sans">
      {/* Hero Section */}
      <header className="relative flex flex-col items-center justify-center pt-10 pb-8 px-4 bg-gradient-to-b from-green-900 to-black overflow-hidden">
        {/* Full-section background image */}
        <img
          src="/bg.png"
          alt="Decorative BG"
          className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none select-none z-0"
        />
        <div className="w-full max-w-xl h-32 sm:h-48 rounded-2xl flex items-center justify-center mb-6 overflow-hidden bg-black">
          <img 
            src="/hero.png" 
            alt="Aviator Hero" 
            className="object-contain w-full h-full mx-auto my-auto" 
            draggable="false"
          />
        </div>
        <div className="w-full max-w-xl mx-auto mb-6 px-4 py-6 sm:px-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 flex items-center gap-2 text-yellow-400 drop-shadow-lg text-center">
            Cheza Kama Wewe!
          </h1>
          <p className="text-lg sm:text-2xl font-semibold text-green-300 mb-2 text-center">
            Kenya’s most thrilling crash game — play, watch, and cash out before the plane flies away!
          </p>
          <p className="text-base sm:text-lg text-zinc-200 text-center max-w-xl mx-auto">
            Place your bet, watch the multiplier soar, and cash out at just the right moment.<b>WIN UPTO 1000X!</b>
          </p>
        </div>
        <button className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-10 rounded-full text-lg shadow-lg transition mb-2 border-2 border-green-700" onClick={handlePlayNowClick}>
          Play Now
        </button>
        <div className="text-xs text-zinc-400 mt-2">No sign up needed. Start with just KES 10!</div>
      </header>

      {/* Features Section */}
      <section className="flex flex-col items-center py-8 px-4 gap-4 border-t border-b border-green-800 bg-black/40">
        <div className="flex flex-col sm:flex-row gap-4 text-center text-lg font-semibold">
          <div className="bg-green-900 rounded-xl px-6 py-4 border border-green-700 text-yellow-300 shadow">Play with as little as <span className='font-bold'>10bob!</span></div>
          <div className="bg-green-900 rounded-xl px-6 py-4 border border-green-700 text-yellow-300 shadow">Ndege itafika <span className='font-bold'>1000x+ anytime!</span> — Utakuwepo?</div>
        </div>
      </section>

      {/* Join Next Round Section */}
      <section className="flex flex-col items-center py-10 px-4">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-yellow-400"> Don’t Miss the Next Takeoff!</h2>
        <p className="text-zinc-200 mb-4 text-center max-w-lg">
          The plane takes off every few seconds.<br />
          Jump in and play in under 30 seconds — hakuna long signup!
        </p>
        <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-10 rounded-full text-lg shadow-lg transition mb-2 border-2 border-yellow-400" onClick={handlePlayNowClick}>
          Play Now
        </button>
      </section>

      {/* Modal for phone and pin */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-zinc-900 rounded-2xl shadow-xl p-6 w-full max-w-xs mx-2 relative">
            <button className="absolute top-2 right-2 text-zinc-400 hover:text-red-400 text-xl" onClick={() => setShowModal(false)}>&times;</button>
            <h2 className="text-xl font-bold mb-4 text-yellow-400 text-center">Register to Play</h2>
            <div className="mb-3">
              <label className="block text-sm mb-1 text-zinc-300">Phone Number</label>
              <input
                type="tel"
                className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="07XXXXXXXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                maxLength={10}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm mb-1 text-zinc-300">PIN</label>
              <input
                type="password"
                className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="4-6 digit PIN"
                value={pin}
                onChange={e => setPin(e.target.value)}
                maxLength={6}
              />
            </div>
            {isRegistered === true && (
              <div className="mb-4 text-green-400 text-center text-sm font-semibold">You’re already registered! Please enter your PIN to log in.</div>
            )}
            {isRegistered !== true && (
              <>
                <div className="mb-2 flex items-center">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreedTerms}
                    onChange={e => setAgreedTerms(e.target.checked)}
                    className="mr-2 accent-yellow-400"
                  />
                  <label htmlFor="terms" className="text-xs text-zinc-300">I agree to the <a href="#" className="underline text-yellow-400">terms and conditions</a></label>
                </div>
                <div className="mb-4 flex items-center">
                  <input
                    type="checkbox"
                    id="age"
                    checked={agreedAge}
                    onChange={e => setAgreedAge(e.target.checked)}
                    className="mr-2 accent-yellow-400"
                  />
                  <label htmlFor="age" className="text-xs text-zinc-300">I confirm I am over 18 years old</label>
                </div>
              </>
            )}
            {error && <div className="text-red-400 text-xs mb-2 text-center">{error}</div>}
            <button
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 rounded-full text-lg transition disabled:opacity-60 flex items-center justify-center gap-2"
              onClick={handleContinue}
              disabled={loading || !(phone && pin && (isRegistered === true || (agreedTerms && agreedAge)))}
            >
              {loading && <span className="loader border-2 border-t-2 border-yellow-600 border-t-transparent rounded-full w-4 h-4 animate-spin"></span>}
              Continue
            </button>
          </div>
        </div>
      )}



      {/* Footer */}
      <Footer />
    </div>
  );
};

export default LandingPage; 