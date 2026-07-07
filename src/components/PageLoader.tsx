import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

export function PageLoader() {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="p-6 space-y-6 w-full max-w-7xl mx-auto h-full flex flex-col"
    >
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-64 mb-2 bg-white/5" />
          <Skeleton className="h-4 w-96 bg-white/5" />
        </div>
        <Skeleton className="h-10 w-32 bg-white/5 rounded-md" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-32 bg-white/5 rounded-xl glass-panel" />
        <Skeleton className="h-32 bg-white/5 rounded-xl glass-panel" />
        <Skeleton className="h-32 bg-white/5 rounded-xl glass-panel" />
      </div>
      
      <Skeleton className="flex-1 min-h-[400px] w-full bg-white/5 rounded-xl glass-panel" />
    </motion.div>
  );
}
