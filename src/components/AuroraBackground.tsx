import { motion } from 'framer-motion';

export function AuroraBackground() {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-background">
      <motion.div
        animate={{
          x: [0, 100, 0, -100, 0],
          y: [0, 50, 100, 50, 0],
          scale: [1, 1.2, 1, 1.1, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/20 rounded-full blur-[120px] mix-blend-screen will-change-transform will-change-opacity"
      />
      <motion.div
        animate={{
          x: [0, -100, 0, 100, 0],
          y: [0, 100, 50, -50, 0],
          scale: [1, 1.1, 1.3, 1, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500/20 rounded-full blur-[140px] mix-blend-screen will-change-transform will-change-opacity"
      />
      <motion.div
        animate={{
          x: [0, 50, -50, 0],
          y: [0, -50, 50, 0],
          scale: [1, 1.5, 1.2, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[100px] mix-blend-screen will-change-transform will-change-opacity"
      />
      <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px]" />
    </div>
  );
}
