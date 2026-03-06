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
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground"
        >
          <motion.img
            src={logoFull}
            alt="Funding Pulze"
            className="w-48 sm:w-64"
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
