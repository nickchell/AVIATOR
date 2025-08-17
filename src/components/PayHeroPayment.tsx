import React, { useState, useEffect } from 'react';

interface PayHeroPaymentProps {
  onClose: () => void;
  onSuccess?: (amount: number) => void;
  userPhone?: string; // Add user phone prop
  updateBalance?: (newBalance: number) => Promise<void>; // Add balance update function
}

const PayHeroPayment: React.FC<PayHeroPaymentProps> = ({ onClose, onSuccess, userPhone, updateBalance }) => {
  const [formData, setFormData] = useState({
    customerName: '',
    phoneNumber: userPhone || '', // Set default to logged-in user's phone
    amount: '',
    reference: 'DEPOSIT- SASAPAY TRUST'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [depositedAmount, setDepositedAmount] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const PAYMENT_API_URL = import.meta.env.VITE_PAYMENT_API_URL;
  
  if (!PAYMENT_API_URL) {
    throw new Error('VITE_PAYMENT_API_URL environment variable is not set');
  }

  // Load saved name from localStorage on component mount
  useEffect(() => {
    const savedName = localStorage.getItem('aviator_customer_name');
    if (savedName) {
      setFormData(prev => ({
        ...prev,
        customerName: savedName
      }));
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Save name to localStorage when user types in the name field
    if (name === 'customerName' && value.trim()) {
      localStorage.setItem('aviator_customer_name', value.trim());
    }

    // Additional phone number validation for 01 format
    if (name === 'phoneNumber') {
      const phoneRegex = /^(07|01)\d{8}$/;
      if (value && !phoneRegex.test(value)) {
        // You can add visual feedback here if needed
        console.log('Phone number format should be 07XXXXXXXX or 01XXXXXXXX');
      }
    }
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^(07|01)\d{8}$/;
    return phoneRegex.test(phone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number format
    if (!validatePhoneNumber(formData.phoneNumber)) {
      setError('This number cannot be used for deposits. Please use a valid phone number starting with 07 or 01.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setIsSuccess(false);
    setDepositedAmount(null);

    try {
      const response = await fetch(`${PAYMENT_API_URL}/api/process-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_name: formData.customerName,
          phone_number: formData.phoneNumber,
          amount: parseFloat(formData.amount),
          external_reference: formData.reference
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Payment processing failed');
      }

      // Start checking payment status
      await checkPaymentStatus(data.reference || data.external_reference);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment processing failed');
      setIsLoading(false);
    }
  };

  const checkPaymentStatus = async (reference: string) => {
    let attempts = 0;
    const maxAttempts = 10; // 20 seconds / 2 seconds per check

    const checkStatus = async () => {
      try {
        const response = await fetch(`${PAYMENT_API_URL}/api/check-status?reference=${reference}&phone_number=${encodeURIComponent(formData.phoneNumber)}`);
        const data = await response.json();

        if (data.status === 'SUCCESS') {
          setIsLoading(false);
          const amount = parseFloat(formData.amount);
          setDepositedAmount(amount);
          setIsSuccess(true);
          
          try {
            // Update balance in database if function is provided
            if (updateBalance) {
              await updateBalance(amount);
              console.log('✅ Balance updated successfully in database');
            }
            
            // Call success callback with amount
            if (onSuccess) {
              onSuccess(amount);
            }
          } catch (error) {
            console.error('❌ Error updating balance:', error);
            // Show warning but don't fail the payment
            setError('Payment successful but balance update failed. Please contact support.');
          }
          
          // Don't close immediately, show success state first
          setTimeout(() => {
            onClose();
          }, 3000); // Close after 3 seconds
          return;
        } else if (data.status === 'FAILED') {
          setIsLoading(false);
          setError('Payment failed. Please try again.');
          return;
        }

        // Continue checking if still QUEUED
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000); // Check every 2 seconds instead of 5
        } else {
          setIsLoading(false);
          setError('Payment timeout. Please check your phone and try again.');
        }
      } catch (err) {
        setIsLoading(false);
        setError('Error checking payment status');
      }
    };

    checkStatus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm relative border border-zinc-700/50 overflow-hidden">
        {/* Background glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-yellow-500/10 rounded-3xl"></div>
        
        {/* Close button */}
        <button 
          className="absolute top-4 right-4 z-10 text-zinc-400 hover:text-red-400 text-2xl transition-all duration-200 hover:scale-110 bg-zinc-800/50 hover:bg-zinc-700/70 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm"
          onClick={onClose}
        >
          ×
        </button>

        {/* Header with DP image only */}
        <div className="relative p-3 pb-2">
          <div className="text-center">
            {/* Payment header image - full width */}
            <img 
              src="/DP.png" 
              alt="Payment Header" 
              className="w-full h-auto mx-auto rounded-lg shadow-md shadow-green-500/25"
            />
          </div>
        </div>

        {/* Payment Form - reduced spacing */}
        <div className="px-3 pb-3">
          <form onSubmit={handleSubmit} className="space-y-2">
            {/* Name Input */}
            <div className="relative group">
              <label className="text-xs font-medium text-zinc-300 mb-1 flex items-center">
                <span className="w-1 h-1 bg-green-400 rounded-full mr-1"></span>
                Name
                {localStorage.getItem('aviator_customer_name') && (
                  <span className="ml-2 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                    Saved
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-600/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-300 backdrop-blur-sm group-hover:border-zinc-500/70"
                  placeholder=" "
                  required
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-green-500/0 via-green-500/5 to-yellow-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                
                {/* Clear saved name button */}
                {localStorage.getItem('aviator_customer_name') && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('aviator_customer_name');
                      setFormData(prev => ({ ...prev, customerName: '' }));
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-red-400 transition-colors duration-200 p-1"
                    title="Clear saved name"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {localStorage.getItem('aviator_customer_name') && (
                <p className="text-xs text-green-400 mt-1 flex items-center">
                  <span className="w-1 h-1 bg-green-400 rounded-full mr-1"></span>
                  Your name will be remembered for future deposits
                </p>
              )}
            </div>

            {/* Phone Number Input */}
            <div className="relative group">
              <label className="text-xs font-medium text-zinc-300 mb-1 flex items-center">
                <span className="w-1 h-1 bg-green-400 rounded-full mr-1"></span>
                Phone Number
              </label>
              <div className="relative">
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-600/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-300 backdrop-blur-sm group-hover:border-zinc-500/70"
                  placeholder="07XXXXXXXX or 01XXXXXXXX"
                  pattern="^(07|01)\d{8}$"
                  required
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-green-500/0 via-green-500/5 to-yellow-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
              <p className="text-xs text-zinc-500 mt-1 flex items-center">
                <span className="w-1 h-1 bg-blue-400 rounded-full mr-1"></span>
                Enter your registered phone number (07XXXXXXXX or 01XXXXXXXX)
              </p>
            </div>

            {/* Amount Input */}
            <div className="relative group">
              <label className="text-xs font-medium text-zinc-300 mb-1 flex items-center">
                <span className="w-1 h-1 bg-green-400 rounded-full mr-1"></span>
                Amount (KES)
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-600/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-300 backdrop-blur-sm group-hover:border-zinc-500/70"
                  placeholder=" "
                  min="50"
                  required
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-green-500/0 via-green-500/5 to-yellow-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            {/* Reference Input */}
            <div className="relative group">
              <label className="text-xs font-medium text-zinc-300 mb-1 flex items-center">
                <span className="w-1 h-1 bg-green-400 rounded-full mr-1"></span>
                Reference
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="reference"
                  value={formData.reference}
                  readOnly
                  className="w-full px-3 py-2 bg-zinc-700/70 border border-zinc-600/50 rounded-lg text-zinc-300 cursor-not-allowed opacity-80"
                  required
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-zinc-500/0 via-zinc-500/5 to-zinc-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-red-400 text-sm flex items-center">
                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                  {error}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !formData.customerName || !formData.phoneNumber || !formData.amount}
              className="w-full bg-gradient-to-r from-green-500 via-yellow-400 to-green-600 hover:from-green-600 hover:via-yellow-500 hover:to-green-700 text-black font-bold py-2.5 px-6 rounded-lg text-sm transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none relative overflow-hidden group"
            >
              {/* Button background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 via-yellow-400/20 to-green-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
               
              {isLoading ? (
                <div className="flex items-center justify-center relative z-10">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-black border-t-transparent mr-2"></div>
                  <span className="relative z-10">Processing Payment...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center relative z-10">
                  <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                  </svg>
                  Process Payment
                </div>
              )}
            </button>
          </form>

          {/* Success Message */}
          {isSuccess && depositedAmount && (
            <div className="mt-4 bg-green-900/20 border border-green-500/30 rounded-xl p-4 backdrop-blur-sm animate-in slide-in-from-bottom-2 duration-300">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-green-400 font-semibold text-lg mb-2">Payment Successful!</h3>
                <p className="text-green-300 text-sm mb-3">
                  Your deposit of <span className="font-bold text-green-400">KES {depositedAmount.toLocaleString()}</span> has been processed successfully.
                </p>
                <p className="text-zinc-400 text-xs">
                  This window will close automatically in a few seconds...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer - reduced spacing */}
        <div className="px-3 pb-3 pt-2 border-t border-zinc-700/30">
          <div className="text-center">
            <p className="text-xs text-zinc-500 mb-1">
              Powered by{' '}
              <a 
                href="https://payherokenya.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 transition-colors duration-200 hover:underline"
              >
                PayHero Kenya
              </a>
            </p>
            <p className="text-xs text-zinc-500 flex items-center justify-center">
              <span className="w-1 h-1 bg-green-400 rounded-full mr-1"></span>
              Secure Payment Processing
            </p>
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && !isSuccess && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-3xl flex items-center justify-center z-20">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4">
                <div className="w-full h-full border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
              </div>
              <p className="text-white text-lg font-medium">Processing Payment</p>
              <p className="text-zinc-300 text-sm mt-2">Please check your phone for the payment prompt...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayHeroPayment;
