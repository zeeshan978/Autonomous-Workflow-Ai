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
          className="absolute bottom-6 right-6 z-[100] bg-[#0d1117] border border-[#30363d] rounded-lg shadow-2xl w-[400px] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-[#30363d]">
            <Terminal className="h-4 w-4 text-[#8b949e]" />
            <span className="text-xs font-mono text-[#8b949e]">Live Terminal</span>
            <div className="ml-auto flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
          </div>
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
