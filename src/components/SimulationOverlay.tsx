import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'lucide-react';

const MESSAGES = [
  "> Starting workflow execution...",
  "  Initializing AI Agent module...",
  "  Fetching external context data...",
  "✔ API Success: Context retrieved (240ms)",
  "  Processing neural pathways...",
  "✔ Gemini Response: Analysis complete (1.2s)",
  "  Evaluating business logic conditions...",
  "✔ Condition met: Routing to true branch",
  "  Generating email payload...",
  "✔ Email Delivered: recipient@example.com",
  "> Workflow Complete"
];

export function SimulationOverlay({ executing }: { executing: boolean }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('builderTerminalMinimized') === 'true';
  });

  const toggleMinimize = () => {
    setIsMinimized(prev => {
      const next = !prev;
      localStorage.setItem('builderTerminalMinimized', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!executing) {
      setMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setMsgIndex((prev) => Math.min(prev + 1, MESSAGES.length - 1));
    }, 1500);
    return () => clearInterval(interval);
  }, [executing]);

  return (
    <AnimatePresence>
      {executing && (
        <motion.div
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.95 }}
          className={`absolute bottom-6 right-6 z-[100] bg-[#0d1117] border border-[#30363d] rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ${isMinimized ? 'w-auto' : 'w-[400px]'}`}
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-[#30363d]" style={{ borderBottomWidth: isMinimized ? 0 : 1 }}>
            <Terminal className="h-4 w-4 text-[#8b949e]" />
            <span className="text-xs font-mono text-[#8b949e] pr-2">Live Terminal</span>
            <div className="ml-auto flex items-center gap-2">
              <button 
                onClick={toggleMinimize}
                className="text-[#8b949e] hover:text-[#c9d1d9] transition-colors p-1 rounded"
              >
                {isMinimized ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                )}
              </button>
              <div className="flex gap-1.5 ml-1">
                <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
              </div>
            </div>
          </div>
          {!isMinimized && (
            <div className="font-mono text-[13px] leading-relaxed p-4 h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#30363d transparent' }}>
              {MESSAGES.slice(0, msgIndex + 1).map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={
                    msg.startsWith('✔') ? 'text-[#3fb950]' :
                    msg.startsWith('>') ? 'text-[#58a6ff] font-bold mt-2' :
                    'text-[#8b949e]'
                }
              >
                {msg}
              </motion.div>
            ))}
            {msgIndex < MESSAGES.length - 1 && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: [1, 0, 1] }} 
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="inline-block w-2 h-4 bg-[#c9d1d9] align-middle ml-1 mt-1"
              />
            )}
          </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
