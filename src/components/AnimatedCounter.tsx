import { useEffect, memo } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export const AnimatedCounter = memo(function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number | string, prefix?: string, suffix?: string }) {
  const isNumeric = typeof value === 'number' || !isNaN(Number(value));
  const numValue = isNumeric ? Number(value) : 0;
  
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => 
    isNumeric ? Math.floor(current).toLocaleString() : value
  );

  useEffect(() => {
    if (isNumeric) {
      spring.set(numValue);
    }
  }, [numValue, spring, isNumeric]);

  if (!isNumeric) {
    return <span>{prefix}{value}{suffix}</span>;
  }

  return (
    <span className="flex items-center">
      {prefix && <span>{prefix}</span>}
      <motion.span>{display}</motion.span>
      {suffix && <span>{suffix}</span>}
    </span>
  );
});
