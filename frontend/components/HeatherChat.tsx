'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';

interface Message {
  role: 'user' | 'heather';
  text: string;
  ts: number;
}

const gold = '#c9a84c';

export default function HeatherChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'heather', text: "Hi! I'm Heather, your AI operations manager. How can I help you today?", ts: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text, ts: Date.now() }]);
    setTyping(true);

    try {
      const res = await fetch('/api/heather/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      const reply = data.response || data.heather_summary || 'I received your message.';
      setMessages(prev => [...prev, { role: 'heather', text: reply, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'heather', text: "Sorry, I'm having trouble connecting right now.", ts: Date.now() }]);
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col rounded-xl shadow-2xl overflow-hidden"
          style={{ width: 300, height: 420, backgroundColor: '#141414', border: '1px solid #2a2a2a' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #2a2a2a' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: gold, color: '#000' }}>H</div>
              <div>
                <p className="text-xs font-semibold text-white leading-none">Heather</p>
                <p className="text-xs leading-none mt-0.5" style={{ color: '#555' }}>AI Operations Manager</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="hover:opacity-70 transition-opacity" style={{ color: '#555' }}>
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: 'none' }}>
            {messages.map((m) => (
              <div key={m.ts} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'heather' && (
                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mr-2 mt-0.5" style={{ backgroundColor: gold, color: '#000', fontSize: 9 }}>H</div>
                )}
                <div
                  className="rounded-xl px-3 py-2 text-xs max-w-[200px] leading-relaxed"
                  style={m.role === 'user'
                    ? { backgroundColor: '#2a2a2a', color: '#fff' }
                    : { backgroundColor: '#1a1400', color: '#e5e5e5', border: `1px solid #2a2000` }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mr-2" style={{ backgroundColor: gold, fontSize: 9, color: '#000', fontWeight: 700 }}>H</div>
                <div className="rounded-xl px-3 py-2" style={{ backgroundColor: '#1a1400', border: '1px solid #2a2000' }}>
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: gold, animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderTop: '1px solid #2a2a2a', backgroundColor: '#0a0a0a' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Heather…"
              className="flex-1 text-xs bg-transparent text-white outline-none placeholder:text-gray-600"
            />
            <button
              onClick={send}
              disabled={!input.trim() || typing}
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: gold }}
            >
              <Send size={11} color="#000" />
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl font-bold text-lg transition-transform hover:scale-105"
        style={{ backgroundColor: gold, color: '#000' }}
        aria-label="Chat with Heather"
      >
        {open ? <X size={20} /> : 'H'}
      </button>
    </>
  );
}
