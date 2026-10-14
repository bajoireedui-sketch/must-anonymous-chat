import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { MessageSquare, Send, RefreshCw, Users, UserX, SkipForward, ShieldAlert } from 'lucide-react';
import './App.css';

const SOCKET_SERVER_URL = 'https://must-chat-backend.onrender.com';;

function App() {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, waiting, matched, disconnected
  const [roomId, setRoomId] = useState(null);
  const [message, setMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [loadingText, setLoadingText] = useState('Холбогдож байна...');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  
  // Шинэ төлөвүүд: Сургууль сонгох болон онлайн хүний тоо
  const [selectedSchool, setSelectedSchool] = useState('ALL');
  const [onlineCount, setOnlineCount] = useState(0);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('online_count', (count) => {
      setOnlineCount(count);
    });

    newSocket.on('waiting', (msg) => {
      setStatus('waiting');
      setLoadingText(msg);
      setIsPartnerTyping(false);
    });

    newSocket.on('matched', ({ roomId }) => {
      setStatus('matched');
      setRoomId(roomId);
      setIsPartnerTyping(false);
      setChatLog([{ sender: 'system', text: 'ШУТИС-ийн оюутантай амжилттай холбогдлоо! Аноним чат эхэллээ.' }]);
    });

    newSocket.on('receive_message', ({ message }) => {
      setChatLog((prev) => [...prev, { sender: 'partner', text: message }]);
      setIsPartnerTyping(false);
    });

    newSocket.on('partner_typing', ({ isTyping }) => {
      setIsPartnerTyping(isTyping);
    });

    newSocket.on('partner_left', () => {
      setStatus('disconnected');
      setIsPartnerTyping(false);
      setChatLog((prev) => [...prev, { sender: 'system', text: 'Нөгөө хүн чатаас гарлаа.' }]);
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isPartnerTyping]);

  // Хайж эхлэх (Сургуулийн сонголттойгоор)
  const startFinding = () => {
    if (socket) {
      setStatus('waiting');
      setLoadingText('ШУТИС-ийн оюутан хайж байна...');
      setChatLog([]);
      setIsPartnerTyping(false);
      socket.emit('find_match', { school: selectedSchool });
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);

    if (socket && roomId && status === 'matched') {
      socket.emit('typing', { roomId, isTyping: true });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', { roomId, isTyping: false });
      }, 2000);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && roomId && socket && status === 'matched') {
      socket.emit('send_message', { roomId, message });
      socket.emit('typing', { roomId, isTyping: false });
      setChatLog((prev) => [...prev, { sender: 'me', text: message }]);
      setMessage('');
    }
  };

  const handleNextPartner = () => {
    if (socket && roomId) {
      socket.emit('leave_room', { roomId });
    }
    setRoomId(null);
    startFinding();
  };

  const handleLeave = () => {
    if (socket && roomId) {
      socket.emit('leave_room', { roomId });
    }
    setRoomId(null);
    setStatus('idle');
    setChatLog([]);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-title">
          <MessageSquare className="icon-purple" size={28} />
          <h1>MUST Anonymous Chat</h1>
        </div>
        <div className="header-badges">
          <div className="badge online-badge">
            <span className="dot-green"></span> Онлайн: {onlineCount}
          </div>
          <div className="badge">
            <Users size={14} /> ШУТИС
          </div>
        </div>
      </header>

      <main className="main-content">
        {status === 'idle' && (
          <div className="card">
            <div className="icon-box">
              <MessageSquare size={32} />
            </div>
            <h2>Хэн бэ гэдгээ нууцлан чатлаарай</h2>
            <p>
              ШУТИС-ийн бусад оюутнуудтай санамсаргүй байдлаар холбогдож, чөлөөтэй ярилцах аноним систем.
            </p>

            {/* Сургууль сонгох хэсэг */}
            <div className="school-select-container">
              <label htmlFor="school-select">Салбар сургууль сонгох:</label>
              <select 
                id="school-select"
                value={selectedSchool} 
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="school-dropdown"
              >
                <option value="ALL">🌐 Бүх сургууль (Холимог)</option>
                <option value="GMIT">МХТС (Мэдээлэл холбоо, технологийн сургууль)</option>
                <option value="BSIS">ХШУИС (Хэрэглээний шинжлэх ухаан, инженерчлэл)</option>
                <option value="MEIS">ҮТДС (Үйлдвэрлэлийн технологийн дизайн)</option>
                <option value="Civil">БАС (Барилга, архитектурын сургууль)</option>
                <option value="Power">Эрчим хүчний сургууль (Эрчим хүч)</option>
                <option value="Business">БУХС (Бизнес ухаан, хүмүүнлэгийн сургууль)</option>
              </select>
            </div>

            <button onClick={startFinding} className="btn-primary">
              <RefreshCw size={16} /> Чат хайж эхлэх
            </button>
          </div>
        )}

        {status === 'waiting' && (
          <div className="card">
            <div className="spinner"></div>
            <p>{loadingText}</p>
            <button onClick={handleLeave} className="btn-cancel">
              Болих / Цуцлах
            </button>
          </div>
        )}

        {(status === 'matched' || status === 'disconnected') && (
          <div className="chat-container">
            <div className="chat-header">
              {status === 'matched' ? (
                <span className="status-online">
                  <span className="dot"></span> Холбогдсон (Аноним)
                </span>
              ) : (
                <span className="status-offline">
                  <UserX size={14} /> Нөгөө хүн холболтоо тасаллаа
                </span>
              )}

              <div className="header-actions">
                <button onClick={handleNextPartner} className="btn-next">
                  <SkipForward size={14} /> Дараагийн хүн
                </button>
                <button onClick={handleLeave} className="btn-disconnect">
                  Таслах
                </button>
              </div>
            </div>

            <div className="messages-area">
              {chatLog.map((log, index) => (
                <div
                  key={index}
                  className={`message ${
                    log.sender === 'system'
                      ? 'msg-system'
                      : log.sender === 'me'
                      ? 'msg-me'
                      : 'msg-partner'
                  }`}
                >
                  {log.text}
                </div>
              ))}

              {isPartnerTyping && (
                <div className="typing-indicator">
                  Нөгөө хүн бичиж байна...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="chat-form">
              <input
                type="text"
                value={message}
                onChange={handleInputChange}
                disabled={status === 'disconnected'}
                placeholder={
                  status === 'disconnected'
                    ? 'Чат тасарсан байна. Дараагийн хүн дээр дарна уу...'
                    : 'Мессеж бичих (хараалын үг автоматаар шүүгдэнэ)...'
                }
                className="chat-input"
              />
              <button
                type="submit"
                className="btn-send"
                disabled={status === 'disconnected'}
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        )}
      </main>

      <footer className="app-footer">
        MUST Anonymous Chat System © 2026
      </footer>
    </div>
  );
}

export default App;