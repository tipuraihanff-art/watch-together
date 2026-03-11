const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static('public'));

let rooms = {}; 

io.on('connection', (socket) => {
  // 1. CREATE ROOM
  socket.on('create-room', ({ password, username }) => {
    const roomId = Math.random().toString(36).substring(2, 7);
    rooms[roomId] = { 
      hostId: socket.id, 
      password, 
      hostName: username,
      chatHistory: [] // <--- ALL MESSAGES STORED HERE
    };
    socket.join(roomId);
    socket.emit('room-created', { roomId, username });
  });

  // 2. JOIN ROOM (Now sends history to newcomer)
  socket.on('join-room', ({ roomId, password, username }) => {
    const room = rooms[roomId];
    if (room && room.password === password) {
      socket.join(roomId);
      // Send the WHOLE history to the person who just joined
      socket.emit('joined-successfully', { 
        roomId, 
        username, 
        hostName: room.hostName,
        history: room.chatHistory 
      });
      
      const joinMsg = { username: "System", msg: `${username} joined!` };
      room.chatHistory.push(joinMsg);
      io.to(roomId).emit('new-msg', joinMsg);
    } else {
      socket.emit('error-msg', 'Invalid ID or Password');
    }
  });

  // 3. HOST COMMANDS
  socket.on('host-command', ({ roomId, action, time, url }) => {
    const room = rooms[roomId];
    if (room && socket.id === room.hostId) {
      socket.to(roomId).emit('sync-video', { action, time, url });
    }
  });

  // 4. CHAT (Saves message to history before sending)
  socket.on('send-msg', ({ roomId, username, msg }) => {
    const room = rooms[roomId];
    if (room) {
      const chatData = { username, msg };
      room.chatHistory.push(chatData); // Save every message
      io.to(roomId).emit('new-msg', chatData);
    }
  });

  socket.on('disconnecting', () => {
    socket.rooms.forEach(roomId => {
      if (rooms[roomId] && rooms[roomId].hostId === socket.id) {
        io.to(roomId).emit('room-closed');
        delete rooms[roomId]; // ALL MESSAGES WIPED WHEN HOST LEAVES
      }
    });
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0');
