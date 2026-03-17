import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import { Eye, EyeOff, Zap, Shield, Activity } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// SVG Heart with EKG
const HeartEKG = ({ isBeating, isFlat }) => {
  return (
    <svg viewBox="-150 0 500 160" className="w-[500px] h-40" style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6)) drop-shadow(0 0 20px rgba(239, 68, 68, 0.4))' }}>
      {/* Heart Shape */}
      <motion.path
        d="M100 140 C100 140 30 90 30 50 C30 20 60 10 100 50 C140 10 170 20 170 50 C170 90 100 140 100 140"
        fill="none"
        stroke="#ef4444"
        strokeWidth="2"
        className={isBeating ? "heartbeat" : ""}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      
      {/* Inner Glow */}
      <motion.path
        d="M100 130 C100 130 40 85 40 52 C40 28 65 20 100 52 C135 20 160 28 160 52 C160 85 100 130 100 130"
        fill="rgba(239, 68, 68, 0.15)"
        stroke="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isBeating ? 0.4 : 0.15 }}
        transition={{ duration: 0.5 }}
      />
      
      {/* EKG Line */}
      <motion.path
        d={isFlat 
          ? "M-150 80 L350 80" 
          : "M-150 80 L60 80 L70 80 L75 60 L80 100 L85 40 L90 110 L95 70 L100 80 L350 80"
        }
        fill="none"
        stroke="#ff4444"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={!isFlat ? "ekg-animated" : ""}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "linear" }}
      />
    </svg>
  );
};

// Circular Data Ring
const DataRing = ({ size, color, rotateClass, opacity = 0.3 }) => (
  <div 
    className={`absolute rounded-full border border-dashed ${rotateClass}`}
    style={{ 
      width: size, 
      height: size, 
      borderColor: color,
      opacity,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    }}
  />
);

// Custom AED Pad Cursor
const AEDCursor = ({ position, isClicking }) => {
  return (
    <div 
      className="fixed pointer-events-none z-50 transition-transform duration-75"
      style={{ 
        left: position.x - 20, 
        top: position.y - 20,
      }}
    >
      <motion.div 
        className="flex gap-1"
        animate={{ 
          gap: isClicking ? "0px" : "4px",
          scale: isClicking ? 0.9 : 1
        }}
        transition={{ duration: 0.1 }}
      >
        {/* Left Pad */}
        <div className="w-5 h-8 rounded-sm bg-gradient-to-b from-white to-slate-200 border border-slate-300 flex items-center justify-center shadow-lg">
          <span className="text-[6px] font-bold text-slate-800">-</span>
        </div>
        {/* Right Pad */}
        <div className="w-5 h-8 rounded-sm bg-gradient-to-b from-white to-slate-200 border border-slate-300 flex items-center justify-center shadow-lg">
          <span className="text-[6px] font-bold text-slate-800">+</span>
        </div>
      </motion.div>
      {/* Electrical Arc */}
      {isClicking && (
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1.5 }}
          exit={{ opacity: 0 }}
        >
          <Zap className="w-4 h-4 text-yellow-400" />
        </motion.div>
      )}
    </div>
  );
};

export default function LoginPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isClicking, setIsClicking] = useState(false);
  const [showCustomCursor, setShowCustomCursor] = useState(false);
  const [isBeating, setIsBeating] = useState(false);
  const [shockEffect, setShockEffect] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setCursorPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setShockEffect(true);

    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister 
        ? { email, password, name }
        : { email, password };

      const response = await axios.post(`${API}${endpoint}`, payload);
      
      // Start heartbeat animation on success
      setIsBeating(true);
      
      setTimeout(() => {
        toast.success(isRegister ? "Account created successfully!" : "Access granted!");
        onLogin(response.data.access_token, response.data.user);
      }, 1500);
      
    } catch (error) {
      setIsBeating(false);
      toast.error(error.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
      setTimeout(() => setShockEffect(false), 300);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen bg-[#020617] relative overflow-hidden ${shockEffect ? 'shock-effect' : ''}`}
      style={{ cursor: showCustomCursor ? 'none' : 'default' }}
      onMouseEnter={() => setShowCustomCursor(true)}
      onMouseLeave={() => setShowCustomCursor(false)}
    >
      {/* Custom Cursor */}
      {showCustomCursor && (
        <AEDCursor position={cursorPosition} isClicking={isClicking} />
      )}

      {/* Holographic Grid Floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[40vh] holo-grid-perspective opacity-30" />
      
      {/* Scan Line */}
      <div className="scan-line" />

      {/* Background Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-red-500 rounded-full opacity-30"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight 
            }}
            animate={{ 
              y: [null, Math.random() * window.innerHeight],
              opacity: [0.3, 0.1, 0.3]
            }}
            transition={{ 
              duration: 10 + Math.random() * 10, 
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Logo & Title */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="font-tech text-4xl md:text-5xl text-red-500 mb-2" style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.8), 0 0 20px rgba(239, 68, 68, 0.6), 0 0 40px rgba(239, 68, 68, 0.4)' }}>
            CARDIAC SOLUTIONS
          </h1>
          <p className="font-tech text-slate-400 tracking-[0.3em] text-sm">
            AED MONITORING COMMAND CENTER
          </p>
        </motion.div>

        {/* Heart & Data Rings Container */}
        <motion.div 
          className="relative mb-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Data Rings */}
          <DataRing size="280px" color="#ef4444" rotateClass="rotate-slow" opacity={0.3} />
          <DataRing size="320px" color="#dc2626" rotateClass="rotate-reverse" opacity={0.2} />
          <DataRing size="360px" color="#ef4444" rotateClass="rotate-slow" opacity={0.15} />
          
          {/* Pulse Rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-52 h-52 rounded-full border border-red-500/40 pulse-ring" style={{ boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)' }} />
          </div>
          
          {/* Heart SVG */}
          <div className="relative z-10 flex items-center justify-center p-16">
            <HeartEKG isBeating={isBeating} isFlat={!isBeating} />
          </div>
          
          {/* Click instruction text */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-8">
            <span className="font-tech text-red-500 text-sm tracking-wider" style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.6)' }}>
              CLICK ON THE HEART TO START
            </span>
          </div>
        </motion.div>

        {/* Login Form */}
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="glass-dark rounded-lg p-8 hud-corners">
            {isRegister && (
              <div className="flex items-center gap-2 mb-6">
                <Shield className="w-5 h-5 text-red-500" style={{ filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))' }} />
                <span className="font-tech text-red-500 text-sm tracking-wider" style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.6)' }}>
                  NEW OPERATOR REGISTRATION
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <AnimatePresence mode="wait">
                {isRegister && (
                  <motion.div
                    key="name-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <label className="block text-xs font-tech text-slate-400 mb-2 tracking-wider">
                      OPERATOR NAME
                    </label>
                    <input
                      data-testid="register-name-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-transparent border-b border-slate-700 focus:border-red-500 px-0 py-3 text-white outline-none transition-colors font-mono"
                      placeholder="Enter your name"
                      required={isRegister}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {isRegister && (
                  <motion.div
                    key="email-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <label className="block text-xs font-tech text-slate-400 mb-2 tracking-wider">
                      EMAIL ADDRESS
                    </label>
                    <input
                      data-testid="email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent border-b border-slate-700 focus:border-red-500 px-0 py-3 text-white outline-none transition-colors font-mono"
                      placeholder="operator@cardiac.com"
                      required
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <div className="relative">
                  <input
                    data-testid="password-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-700 focus:border-red-500 px-0 py-3 text-white outline-none transition-colors font-mono pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-500 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <motion.button
                data-testid="submit-button"
                type="submit"
                disabled={loading}
                className="w-full bg-red-500 hover:bg-red-400 text-white font-tech py-4 rounded-full tracking-widest uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ boxShadow: '0 0 15px rgba(239, 68, 68, 0.5), 0 0 30px rgba(239, 68, 68, 0.3)' }}
                whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(239, 68, 68, 0.7), 0 0 50px rgba(239, 68, 68, 0.4)' }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <>
                    <Activity className="w-5 h-5 animate-pulse" />
                    <span>PROCESSING...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    <span>{isRegister ? "REGISTER" : "AUTHENTICATE"}</span>
                  </>
                )}
              </motion.button>
            </form>

            <div className="mt-6 text-center">
              <button
                data-testid="toggle-auth-mode"
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-slate-500 hover:text-red-500 transition-colors font-tech tracking-wider"
              >
                {isRegister ? "// EXISTING OPERATOR? AUTHENTICATE" : "// NEW OPERATOR? REGISTER"}
              </button>
            </div>
          </div>

          {/* System Status */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs font-mono text-slate-600">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              SYSTEMS ONLINE
            </span>
            <span>|</span>
            <span>v3.14.159</span>
            <span>|</span>
            <span>JARVIS PROTOCOL</span>
          </div>
        </motion.div>
      </div>

      {/* Corner Decorations */}
      <div className="absolute top-4 left-4 w-20 h-20 border-t-2 border-l-2 border-red-500/50" style={{ boxShadow: 'inset 10px 10px 20px rgba(239, 68, 68, 0.1)' }} />
      <div className="absolute top-4 right-4 w-20 h-20 border-t-2 border-r-2 border-red-500/50" style={{ boxShadow: 'inset -10px 10px 20px rgba(239, 68, 68, 0.1)' }} />
      <div className="absolute bottom-4 left-4 w-20 h-20 border-b-2 border-l-2 border-red-500/50" style={{ boxShadow: 'inset 10px -10px 20px rgba(239, 68, 68, 0.1)' }} />
      <div className="absolute bottom-4 right-4 w-20 h-20 border-b-2 border-r-2 border-red-500/50" style={{ boxShadow: 'inset -10px -10px 20px rgba(239, 68, 68, 0.1)' }} />
    </div>
  );
}
