# PayHero Payment Integration

## Overview
This integration allows users to deposit funds into their Aviator game account using PayHero payment gateway.

## How It Works

### 1. User Flow
1. User clicks the **Deposit button** (green + icon) in the header
2. **PayHero Payment Modal** opens with a beautiful form
3. User fills in:
   - **Name**: Their full name
   - **Phone Number**: Registered phone number (07XXXXXXXX format)
   - **Amount**: Amount to deposit in KES
   - **Reference**: Auto-filled as "DEPOSIT"
4. User clicks **"Process Payment"**
5. Payment is processed through PayHero backend
6. User receives STK push on their phone
7. After successful payment, user's balance is updated automatically

### 2. Technical Integration

#### Frontend Component
- **File**: `src/components/PayHeroPayment.tsx`
- **Props**: 
  - `onClose`: Function to close the modal
  - `onSuccess`: Callback when payment succeeds (receives amount)

#### Backend API
- **Payment Processing**: `https://payment-1igx.onrender.com/api/process-payment`
- **Status Checking**: `https://payment-1igx.onrender.com/api/check-status`

#### State Management
- **Modal State**: `showDeposit` boolean in App.tsx
- **User Balance**: Automatically updated after successful payment
- **Success Toast**: Shows confirmation message

## Setup Requirements

### 1. Payment Backend
The PayHero payment backend is now deployed and available at:
```bash
cd Payment/nodejs-payhero-sample
npm start
```

### 2. Environment Variables
Make sure your payment backend has the correct PayHero credentials in `config.js`:
- `basicAuthToken`
- `channelId`
- `provider` (set to "sasapay")

### 3. CORS Configuration
The payment backend should allow requests from your main app (typically port 5173 for Vite dev server).

## Features

### ✅ **User Experience**
- **Beautiful UI**: Matches Aviator game theme
- **Form Validation**: Ensures all fields are filled correctly
- **Loading States**: Shows processing status
- **Error Handling**: Displays clear error messages
- **Success Feedback**: Toast notification + balance update

### ✅ **Payment Features**
- **STK Push**: Direct phone payment prompt
- **Real-time Status**: Checks payment status every 5 seconds
- **Timeout Handling**: 65-second timeout with user feedback
- **Reference Tracking**: Unique reference for each transaction

### ✅ **Security**
- **Input Validation**: Phone number format validation
- **Amount Limits**: Minimum 1 KES deposit
- **Secure API**: HTTPS endpoints for production

## Customization

### 1. Styling
The component uses Tailwind CSS classes that match your Aviator theme:
- **Colors**: Green gradients, zinc backgrounds
- **Animations**: Hover effects, loading spinners
- **Responsive**: Works on all device sizes

### 2. API Endpoints
To change the payment backend URL, update these lines in `PayHeroPayment.tsx`:
```typescript
// Production URL for payment service
const response = await fetch('https://payment-1igx.onrender.com/api/process-payment', ...);
const response = await fetch(`https://payment-1igx.onrender.com/api/check-status?reference=${reference}`);
```

### 3. Success Callback
Modify the `onSuccess` callback in `App.tsx` to add custom logic:
```typescript
onSuccess={(amount) => {
  // Update balance
  setUser((prev: any) => ({
    ...prev,
    balance: (prev.balance || 0) + amount
  }));
  
  // Add custom logic here
  // e.g., log transaction, send notification, etc.
  
  setShowDeposit(false);
  toast({
    title: "Payment Successful!",
    description: `Your account has been credited with ${amount} KES`,
    variant: "default",
  });
}}
```

## Troubleshooting

### Common Issues

#### 1. **Payment Not Processing**
- Check if payment service is accessible at https://payment-1igx.onrender.com
- Verify PayHero credentials in backend config
- Check browser console for API errors

#### 2. **STK Popup Not Appearing**
- Ensure phone number format is correct (07XXXXXXXX)
- Check if provider is set to "sasapay" in backend
- Verify PayHero account and channel configuration

#### 3. **CORS Errors**
- Ensure payment backend allows requests from your main app
- Check if backend has proper CORS headers

#### 4. **Balance Not Updating**
- Check if `onSuccess` callback is properly configured
- Verify user state management in App.tsx

## Production Deployment

### **Live Payment Service**
The PayHero payment backend is now deployed and available at:
**https://payment-1igx.onrender.com**

### **Frontend Integration**
Your frontend is already configured to use the production URL. The `PayHeroPayment` component automatically connects to the deployed service.

### **Environment Variables**
For production, ensure your environment has:
```env
VITE_PAYMENT_API_URL=https://payment-1igx.onrender.com
```

### **Health Check**
You can verify the service is running by visiting:
- **Main Service**: https://payment-1igx.onrender.com
- **Health Check**: https://payment-1igx.onrender.com/health (if implemented)

### 1. **Update API URLs**
Change localhost URLs to your production domain:
```typescript
// Production URLs
const response = await fetch('https://yourdomain.com/api/process-payment', ...);
const response = await fetch(`https://yourdomain.com/api/check-status?reference=${reference}`);
```

### 2. **Environment Variables**
Use environment variables for API URLs:
```typescript
const PAYMENT_API_URL = import.meta.env.VITE_PAYMENT_API_URL || 'https://payment-1igx.onrender.com';
```

### 3. **HTTPS Required**
Ensure all payment endpoints use HTTPS in production for security.

## Support

For PayHero-specific issues:
- Check PayHero documentation
- Contact PayHero support
- Verify account and channel configuration

For integration issues:
- Check browser console for errors
- Verify API endpoints and CORS
- Test payment backend independently

