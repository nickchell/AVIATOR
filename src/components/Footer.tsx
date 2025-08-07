import React from 'react';

interface FooterProps {
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  return (
    <footer className={`mt-auto py-6 text-center text-xs text-zinc-400 border-t border-green-800 bg-black/60 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>© 2025 — BetHero ltd</span>
            <span className="hidden sm:inline">|</span>
            <span>Licensed by BCLB 🇰🇪</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-yellow-400 font-semibold">Game Responsibly</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-green-400">Live</span>
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          <span>Terms & Conditions</span>
          <span className="mx-2">•</span>
          <span>Privacy Policy</span>
          <span className="mx-2">•</span>
          <span>Support</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
