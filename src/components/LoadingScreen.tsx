import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoFull from "@/assets/logo-full.png";

interface LoadingScreenProps {
  onComplete: () => void;
  duration?: number;
}

const LoadingScreen = ({ onComplete, duration = 2200 }: LoadingScreenProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
        >
          {/* Soft blurred glow behind logo */}
          <motion.div
            className="absolute w-40 h-40 sm:w-56 sm:h-56 rounded-full bg-foreground/5 blur-3xl"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.2 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <motion.div
            className="absolute w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-foreground/8 blur-2xl"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.8, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          />
          <motion.img
            src={logoFull}
            alt="Funding Pulze"
            className="w-32 sm:w-44 relative z-10"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;
