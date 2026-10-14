const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Хүлээж буй хэрэглэгчид: { socket, school }
let waitingQueue = []; 

// Хараалын үгсийн жагсаалт (Өргөжүүлж болно)
const badWords = ['ална', 'хужаа', 'жинхэнэ хараал', 'gandgar', 'xuy', 'bitch', 'fuck']; // Жишээ үгс

function filterProfanity(text) {
  let filteredText = text;
  badWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filteredText = filteredText.replace(regex, '***');
  });
  return filteredText;
}

// Онлайн хүмүүсийн тоог бүгдэд мэдэгдэх
function updateOnlineCount() {
  io.emit('online_count', io.engine.clientsCount);
}

io.on('connection', (socket) => {
  console.log('--> Шинэ оюутан холбогдлоо ID:', socket.id);
  updateOnlineCount();

  // Матч хайх (Салбар сургуулиар нь шүүх логик)
  socket.on('find_match', ({ school }) => {
    socket.userSchool = school || 'ALL';
    
    // Өмнө нь хүлээх жагсаалтад байсан бол хасах
    waitingQueue = waitingQueue.filter((s) => s.socket.id !== socket.id);

    // Тохирох хүн хайх (Яг ижил сургууль эсвэл 'ALL' сонгосон хүмүүс хоорондоо таарна)
    const partnerIndex = waitingQueue.findIndex((item) => {
      return item.school === 'ALL' || socket.userSchool === 'ALL' || item.school === socket.userSchool;
    });

    if (partnerIndex !== -1) {
      const partnerObj = waitingQueue.splice(partnerIndex, 1)[0];
      const partnerSocket = partnerObj.socket;

      if (partnerSocket.id === socket.id) {
        waitingQueue.push({ socket, school: socket.userSchool });
        return;
      }

      const roomId = `room_${socket.id}_${partnerSocket.id}`;

      socket.join(roomId);
      partnerSocket.join(roomId);

      socket.currentRoom = roomId;
      partnerSocket.currentRoom = roomId;

      io.to(roomId).emit('matched', { roomId });
      console.log(`--> Хос амжилттай холбогдлоо: ${roomId} (${socket.userSchool} & ${partnerObj.school})`);
    } else {
      waitingQueue.push({ socket, school: socket.userSchool });
      socket.emit('waiting', 'Сургуулийн найз хайж байна...');
    }
  });

  // Мессеж илгээх (Хараалын үг шүүх функцтэй)
  socket.on('send_message', ({ roomId, message }) => {
    const cleanMessage = filterProfanity(message);
    socket.to(roomId).emit('receive_message', { message: cleanMessage });
  });

  // "Бичиж байна..."
  socket.on('typing', ({ roomId, isTyping }) => {
    socket.to(roomId).emit('partner_typing', { isTyping });
  });

  // Өрөөнөөс гарах
  socket.on('leave_room', ({ roomId }) => {
    if (roomId) {
      socket.to(roomId).emit('partner_left');
      socket.leave(roomId);
      socket.currentRoom = null;
    }
  });

  // Холболт тасрах
  socket.on('disconnect', () => {
    waitingQueue = waitingQueue.filter((s) => s.socket.id !== socket.id);
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('partner_left');
    }
    console.log('<-- Оюутан холболтоос гарлаа:', socket.id);
    updateOnlineCount();
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Сервер ажиллаж байна: http://localhost:${PORT}`);
});