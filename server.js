const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// THE OPEN DOOR CORS
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

app.use(express.static('public'));

let rooms = {}; // Database to store room info

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. CREATE ROOM
  socket.on('create-room', ({ password, animeId }) => {
    const roomId = Math.random().toString(36).substring(2, 7);
    rooms[roomId] = { hostId: socket.id, password, animeId };
    socket.join(roomId);
    socket.emit('room-created', { roomId, password });
  });

  // 2. JOIN ROOM
  socket.on('join-room', ({ roomId, password }) => {
    const room = rooms[roomId];
    if (room && room.password === password) {
      socket.join(roomId);
      socket.emit('joined-successfully', { animeId: room.animeId });
    } else {
      socket.emit('error-msg', 'Invalid ID or Password');
    }
  });

  // 3. HOST COMMANDS (Sync, Play, Pause)
  socket.on('host-command', ({ roomId, action, time }) => {
    const room = rooms[roomId];
    if (room && socket.id === room.hostId) {
      // Broadcast to everyone in room except host
      socket.to(roomId).emit('sync-video', { action, time });
    }
  });

  // 4. CHAT
  socket.on('send-msg', ({ roomId, username, msg }) => {
    io.to(roomId).emit('new-msg', { username, msg });
  });

  // 5. KILL ROOM IF HOST LEAVES
  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (rooms[roomId] && rooms[roomId].hostId === socket.id) {
        io.to(roomId).emit('room-closed');
        delete rooms[roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server live on port ${PORT}`));
