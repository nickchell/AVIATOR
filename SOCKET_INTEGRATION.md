# Socket.IO Integration for Aviator Crash Game

This document explains how to set up and run the real-time Socket.IO simulation layer for the Aviator crash game.

## 📁 Project Structure

```
AVIATOR/
├── backend/                 # Backend API server
│   ├── index.js            # Main backend file
│   ├── package.json        # Backend dependencies
│   └── .env               # Backend environment variables
├── socket-server/          # Socket.IO real-time server
│   ├── socket-server.js    # Main socket server file
│   ├── package.json        # Socket server dependencies
│   ├── .env.example        # Environment template
│   └── README.md           # Socket server documentation
├── src/                    # Frontend React application
│   ├── App.tsx            # Main game component
│   └── ...                # Other frontend files
├── start-dev.bat          # Windows startup script
├── start-dev.sh           # Unix/Linux startup script
└── SOCKET_INTEGRATION.md  # This documentation
```

## 🚀 Quick Start

### 1. Install Socket.IO Server Dependencies

```bash
cd socket-server
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in your project root for the backend:

```env
# Backend Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SOCKET_SERVER_URL=http://localhost:3001
SOCKET_SERVER_SECRET=your-secret-token-here
```

Create a `.env` file in the `socket-server` folder:

```env
# Socket Server Configuration
SOCKET_PORT=3001
SOCKET_SERVER_SECRET=your-secret-token-here
```

### 3. Start the Socket.IO Server

```bash
cd socket-server

# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

### 4. Update Frontend Environment

Add to your frontend `.env` file:

```env
VITE_SOCKET_SERVER_URL=http://localhost:3001
```

### 5. Start All Services (Easy Way)

**Windows:**
```bash
start-dev.bat
```

**Unix/Linux:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

### 6. Start Services Manually

**Backend:**
```bash
cd backend
npm install
npm start
```

**Socket Server:**
```bash
cd socket-server
npm install
npm run dev
```

**Frontend:**
```bash
npm install
npm run dev
```

## 📡 How It Works

### Backend → Socket Server Flow

1. **Backend generates multipliers** every 3 seconds
2. **Batch storage** - collects 10 multipliers before storing in Supabase
3. **POST to Socket Server** - sends multiplier batch to `/queue` endpoint
4. **Socket Server queues** multipliers for real-time simulation

### Socket Server → Frontend Flow

1. **Round Start** - emits `round:start` with round number and crash point
2. **Betting Phase** - 6 seconds for players to place bets
3. **Flying Phase** - emits `multiplier:update` every 50ms with current multiplier
4. **Crash** - emits `round:crash` when multiplier reaches crash point
5. **Wait Phase** - 3 seconds before next round

### Frontend Socket Events

```typescript
// Connection events
socket.on('connect', () => { /* Connected */ });
socket.on('disconnect', () => { /* Disconnected */ });

// Game events
socket.on('game:state', (data) => { /* Initial game state */ });
socket.on('round:start', (data) => { /* New round started */ });
socket.on('multiplier:update', (data) => { /* Multiplier updated */ });
socket.on('round:crash', (data) => { /* Round crashed */ });
```

## 🔧 Configuration

### Socket Server Settings

- **Port**: `SOCKET_PORT=3001` (default)
- **Secret Token**: `SOCKET_SERVER_SECRET` (for authentication)
- **Betting Duration**: 6 seconds
- **Wait Duration**: 3 seconds
- **Update Interval**: 50ms for smooth animation

### Backend Settings

- **Multiplier Generation**: Every 3 seconds
- **Batch Size**: 10 multipliers (for quicker testing)
- **Socket Server URL**: `SOCKET_SERVER_URL`
- **Authentication**: Bearer token in headers

## 🐛 Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check if Socket.IO server is running on correct port
   - Verify `VITE_SOCKET_SERVER_URL` in frontend environment
   - Check CORS settings in socket server

2. **Authentication Errors**
   - Ensure `SOCKET_SERVER_SECRET` matches between backend and socket server
   - Check Authorization header format: `Bearer <token>`

3. **No Multipliers**
   - Verify backend is generating and sending multipliers
   - Check socket server logs for queue status
   - Ensure backend can reach socket server URL

### Debug Commands

```bash
# Check socket server health
curl http://localhost:3001/health

# Check backend API
curl http://localhost:3000/api/current-round

# Monitor socket server logs
tail -f socket-server.log
```

## 📊 Monitoring

### Socket Server Health Endpoint

```bash
GET http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "gamePhase": "flying",
  "currentRound": 123,
  "queueSize": 45,
  "currentMultiplier": 2.34
}
```

### Log Messages

- `🔌 Client connected/disconnected`
- `📥 Queued X multipliers`
- `🎮 Starting round X`
- `✈️ Starting flying phase`
- `💥 Round X crashed at Yx`

## 🔒 Security

- **Authentication**: Bearer token required for `/queue` endpoint
- **CORS**: Configured for development (allow all origins)
- **Input Validation**: Multiplier arrays validated before processing
- **Rate Limiting**: Consider adding rate limiting for production

## 🚀 Production Deployment

1. **Environment Variables**: Set production URLs and secrets
2. **CORS**: Configure allowed origins for production
3. **SSL**: Use HTTPS for production Socket.IO connections
4. **Load Balancing**: Consider multiple socket server instances
5. **Monitoring**: Add logging and monitoring for production use 