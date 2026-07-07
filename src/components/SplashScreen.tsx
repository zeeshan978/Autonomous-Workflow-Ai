import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STARTUP_SEQUENCE = [
  "Initializing AI...",
  "Loading Agents...",
  "Connecting Workflows...",
  "Ready ✓"
];

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [show, setShow] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => {
        if (prev < STARTUP_SEQUENCE.length - 1) return prev + 1;
        return prev;
      });
    }, 400);

    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 800); // Wait for exit animation
    }, 2800);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden"
        >
          {/* Fading Background Grid */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            transition={{ duration: 2, delay: 0.5 }}
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: 'radial-gradient(circle at center, hsl(var(--primary)) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />

          <div className="flex flex-col items-center gap-6 z-10">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
                animate={{ scale: [1, 1.8, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              
              <motion.svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary relative z-10">
                <motion.rect
                  x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                />
                <motion.path
                  d="M12 5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: "easeInOut", delay: 0.6 }}
                />
                <motion.circle
                  cx="12" cy="5" r="2" fill="currentColor"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, ease: "backOut", delay: 0.8 }}
                />
                <motion.circle
                  cx="8" cy="16" r="1.5" fill="currentColor"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: [1, 1.5, 1], filter: ["blur(0px)", "blur(2px)", "blur(0px)"] }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 1.0 }}
                />
                <motion.circle
                  cx="16" cy="16" r="1.5" fill="currentColor"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: [1, 1.5, 1], filter: ["blur(0px)", "blur(2px)", "blur(0px)"] }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 1.0 }}
                />
              </motion.svg>
            </div>
            
            <div className="flex flex-col items-center">
              <motion.h1
                className="text-4xl font-extrabold tracking-tight text-foreground mb-4"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 1 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 1.2 } }
                }}
              >
                {"Autonomous Workflow AI".split("").map((char, index) => (
                  <motion.span key={index} variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                ))}
              </motion.h1>

              <div className="h-6 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`font-mono text-sm ${step === STARTUP_SEQUENCE.length - 1 ? 'text-green-500' : 'text-muted-foreground'}`}
                  >
                    {STARTUP_SEQUENCE[step]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
