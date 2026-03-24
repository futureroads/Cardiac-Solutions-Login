import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import { Eye, EyeOff, Zap, Shield, Activity, ArrowLeft } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// EKG Sound Effect using MP3 file
const useEKGSound = () => {
  const audioRef = useRef(null);

  const startHeartbeat = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://customer-assets.emergentagent.com/job_pulse-ops/artifacts/qr3njjwx_EKG.mp3');
      audioRef.current.loop = true;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(err => console.log('Audio play failed:', err));
  };

  const stopHeartbeat = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
    };
  }, []);

  return { startHeartbeat, stopHeartbeat };
};

// Electrical Sparks Component
const ElectricalSparks = ({ isActive }) => {
  if (!isActive) return null;
  
  const sparks = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i * 30) + Math.random() * 15,
    distance: 80 + Math.random() * 60,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 0.2,
    duration: 0.3 + Math.random() * 0.3
  }));

  return (
    <div className="absolute inset-0 pointer-events-none">
      {sparks.map((spark) => (
        <motion.div
          key={spark.id}
          className="absolute left-1/2 top-1/2"
          initial={{ 
            x: 0, 
            y: 0, 
            opacity: 1,
            scale: 1
          }}
          animate={{ 
            x: Math.cos(spark.angle * Math.PI / 180) * spark.distance,
            y: Math.sin(spark.angle * Math.PI / 180) * spark.distance,
            opacity: 0,
            scale: 0
          }}
          transition={{ 
            duration: spark.duration,
            delay: spark.delay,
            ease: "easeOut"
          }}
        >
          <div 
            className="rounded-full bg-yellow-400"
            style={{ 
              width: spark.size, 
              height: spark.size,
              boxShadow: '0 0 8px #facc15, 0 0 16px #fbbf24, 0 0 24px #f59e0b'
            }} 
          />
        </motion.div>
      ))}
      {/* Lightning bolts */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`bolt-${i}`}
          className="absolute left-1/2 top-1/2"
          initial={{ opacity: 0, scale: 0, rotate: i * 60 }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0], rotate: i * 60 }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
        >
          <svg width="40" height="60" viewBox="0 0 40 60" className="-translate-x-1/2 -translate-y-1/2">
            <motion.path
              d="M20 0 L25 20 L35 20 L15 40 L20 25 L10 25 Z"
              fill="#facc15"
              style={{ filter: 'drop-shadow(0 0 6px #facc15) drop-shadow(0 0 12px #f59e0b)' }}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 1, 0] }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            />
          </svg>
        </motion.div>
      ))}
      {/* Arc lines */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={`arc-${i}`}
          className="absolute left-1/2 top-1/2 origin-center"
          style={{ rotate: `${i * 45}deg` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.5, delay: i * 0.03 }}
        >
          <motion.div
            className="h-[2px] bg-gradient-to-r from-yellow-400 via-yellow-300 to-transparent"
            initial={{ width: 0, x: 20 }}
            animate={{ width: [0, 100, 60], x: [20, 40, 80] }}
            transition={{ duration: 0.4, delay: i * 0.03 }}
            style={{ boxShadow: '0 0 8px #facc15' }}
          />
        </motion.div>
      ))}
    </div>
  );
};

// SVG Heart with EKG
const HeartEKG = ({ isBeating, isFlat }) => {
  return (
    <svg viewBox="-150 0 500 160" className="w-[500px] h-40" style={{ filter: 'drop-shadow(0 0 5px #ef4444) drop-shadow(0 0 10px #ef4444) drop-shadow(0 0 20px #ef4444) drop-shadow(0 0 40px #dc2626) drop-shadow(0 0 60px #dc2626)' }}>
      {/* Heart Shape */}
      <motion.path
        d="M100 140 C100 140 30 90 30 50 C30 20 60 10 100 50 C140 10 170 20 170 50 C170 90 100 140 100 140"
        fill="none"
        stroke="#ef4444"
        strokeWidth="2.5"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ 
          pathLength: 1, 
          opacity: 1,
          scale: isBeating ? [1, 1.05, 1, 1.03, 1] : 1
        }}
        transition={{ 
          pathLength: { duration: 1.5, ease: "easeInOut" },
          scale: { duration: 0.8, repeat: isBeating ? Infinity : 0, ease: "easeInOut" }
        }}
      />
      
      {/* Inner Glow */}
      <motion.path
        d="M100 130 C100 130 40 85 40 52 C40 28 65 20 100 52 C135 20 160 28 160 52 C160 85 100 130 100 130"
        fill="rgba(239, 68, 68, 0.2)"
        stroke="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isBeating ? [0.2, 0.5, 0.2] : 0.2 }}
        transition={{ duration: 0.8, repeat: isBeating ? Infinity : 0 }}
      />
      
      {/* EKG Line - Flat when not beating */}
      {!isBeating && (
        <motion.path
          d="M-150 80 L350 80"
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "linear" }}
        />
      )}
      
      {/* EKG Line - Animated heartbeat when beating */}
      {isBeating && (
        <motion.path
          d="M-150 80 L30 80 L50 80 L55 65 L60 95 L65 50 L70 105 L75 70 L80 80 L350 80"
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0, pathOffset: 0 }}
          animate={{ 
            pathLength: [0, 1],
            pathOffset: [0, 0]
          }}
          transition={{ 
            duration: 0.8,
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 0.4
          }}
        />
      )}
      
      {/* Pulse dot that travels along the line when beating */}
      {isBeating && (
        <motion.circle
          r="5"
          fill="#ff6666"
          initial={{ cx: -150, cy: 80 }}
          animate={{ 
            cx: [-150, 30, 50, 55, 60, 65, 70, 75, 80, 350],
            cy: [80, 80, 80, 65, 95, 50, 105, 70, 80, 80]
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 0.4
          }}
          style={{
            filter: 'drop-shadow(0 0 8px #ef4444) drop-shadow(0 0 15px #ef4444)'
          }}
        />
      )}
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
  const [username, setUsername] = useState(() => localStorage.getItem("saved_username") || "");
  const [password, setPassword] = useState(() => localStorage.getItem("saved_password") || "");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isClicking, setIsClicking] = useState(false);
  const [showCustomCursor, setShowCustomCursor] = useState(false);
  const [isBeating, setIsBeating] = useState(false);
  const [shockEffect, setShockEffect] = useState(false);
  const [showSparks, setShowSparks] = useState(false);
  const [currentScreen, setCurrentScreen] = useState("heart"); // "heart", "beating", "login"
  const [serverStatus, setServerStatus] = useState("checking"); // "checking", "online", "offline"
  const containerRef = useRef(null);
  const usernameInputRef = useRef(null);
  
  const { startHeartbeat, stopHeartbeat } = useEKGSound();

  // Check server connectivity on mount
  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await axios.get(`${API}/debug/test-login`, { timeout: 8000 });
        if (res.data?.password_verify === true) {
          setServerStatus("online");
        } else {
          setServerStatus("db-issue");
        }
      } catch {
        setServerStatus("offline");
      }
    };
    checkServer();
  }, []);

  // Focus username input when login screen appears
  useEffect(() => {
    if (currentScreen === "login" && usernameInputRef.current) {
      setTimeout(() => {
        usernameInputRef.current.focus();
      }, 100);
    }
  }, [currentScreen]);

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

  const handleHeartClick = () => {
    if (currentScreen !== "heart") return; // Already clicked
    
    setShockEffect(true);
    setShowSparks(true);
    setIsBeating(true);
    setCurrentScreen("beating");
    
    // Start the EKG heartbeat sound
    startHeartbeat();
    
    // Hide sparks after initial effect
    setTimeout(() => {
      setShockEffect(false);
      setShowSparks(false);
    }, 1000);
    
    // After 5 seconds of heartbeat, transition to login screen
    setTimeout(() => {
      stopHeartbeat();
      setCurrentScreen("login");
    }, 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setShockEffect(true);

    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister 
        ? { username, password, name }
        : { username, password };

      const response = await axios.post(`${API}${endpoint}`, payload);
      
      // Start heartbeat animation on success
      setIsBeating(true);
      
      // Save credentials for next login
      localStorage.setItem("saved_username", username);
      localStorage.setItem("saved_password", password);

      setTimeout(() => {
        toast.success(isRegister ? "Account created successfully!" : "Access granted!");
        onLogin(response.data.access_token, response.data.user);
      }, 1500);
      
    } catch (error) {
      setIsBeating(false);
      if (error.response) {
        // Server responded with an error
        toast.error(error.response.data?.detail || `Server error (${error.response.status})`);
      } else if (error.request) {
        // No response received - network issue
        toast.error("Cannot reach server. Check your connection or try again.");
      } else {
        toast.error("Authentication failed");
      }
    } finally {
      setLoading(false);
      setTimeout(() => setShockEffect(false), 300);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen bg-[#020617] relative overflow-hidden ${shockEffect ? 'shock-effect' : ''}`}
      style={{ cursor: (showCustomCursor && currentScreen !== "login") ? 'none' : 'default' }}
      onMouseEnter={() => setShowCustomCursor(true)}
      onMouseLeave={() => setShowCustomCursor(false)}
    >
      {/* Custom Cursor - only show on heart and beating screens */}
      {showCustomCursor && currentScreen !== "login" && (
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
        
        {/* SCREEN: Heart (Initial) and Beating */}
        <AnimatePresence mode="wait">
          {(currentScreen === "heart" || currentScreen === "beating") && (
            <motion.div
              key="heart-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center"
            >
              {/* Logo & Title */}
              <motion.div 
                className="text-center mb-8"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <img 
                  src="https://customer-assets.emergentagent.com/job_pulse-ops/artifacts/wftdw2pr_Gemini_Generated_Image_3dl4mo3dl4mo3dl4.png" 
                  alt="Cardiac Solutions Logo" 
                  className="w-20 h-20 object-contain mx-auto mb-4"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))' }}
                />
                <h1 className="font-tech text-4xl md:text-5xl text-red-500 mb-2" style={{ textShadow: '0 0 10px #ef4444, 0 0 20px #ef4444, 0 0 30px #ef4444, 0 0 40px #dc2626, 0 0 70px #dc2626, 0 0 80px #dc2626, 0 0 100px #b91c1c' }}>
                  CARDIAC SOLUTIONS, LLC
                </h1>
                <p className="font-tech text-slate-300 tracking-[0.3em] text-sm" style={{ textShadow: '0 0 5px rgba(148, 163, 184, 0.5), 0 0 10px rgba(148, 163, 184, 0.3)' }}>
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
                <div 
                  className="relative z-10 flex items-center justify-center p-16 cursor-pointer"
                  onClick={handleHeartClick}
                  data-testid="heart-button"
                >
                  <HeartEKG isBeating={isBeating} isFlat={!isBeating} />
                  <ElectricalSparks isActive={showSparks} />
                </div>
                
                {/* Click instruction text - only on initial screen */}
                {currentScreen === "heart" && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-8">
                    <span className="font-tech text-red-500 text-sm tracking-wider" style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.6)' }}>
                      CLICK ON THE HEART TO START
                    </span>
                  </div>
                )}
                
                {/* Status text during beating */}
                {currentScreen === "beating" && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-8">
                    <span className="font-tech text-red-500 text-sm tracking-wider animate-pulse" style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.6)' }}>
                      INITIALIZING SYSTEMS...
                    </span>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* SCREEN: Login Form */}
          {currentScreen === "login" && (
            <motion.div
              key="login-screen"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center w-full"
            >
              {/* Back Button */}
              <motion.button
                onClick={() => {
                  setCurrentScreen("heart");
                  setIsBeating(false);
                }}
                className="absolute top-6 left-6 flex items-center gap-2 text-red-500 hover:text-red-400 transition-colors font-tech text-sm tracking-wider"
                style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.6)' }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                data-testid="back-button"
              >
                <ArrowLeft className="w-5 h-5" style={{ filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))' }} />
                <span>BACK</span>
              </motion.button>

              {/* Logo & Title */}
              <motion.div 
                className="text-center mb-8"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <img 
                  src="https://customer-assets.emergentagent.com/job_pulse-ops/artifacts/wftdw2pr_Gemini_Generated_Image_3dl4mo3dl4mo3dl4.png" 
                  alt="Cardiac Solutions Logo" 
                  className="w-20 h-20 object-contain mx-auto mb-4"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))' }}
                />
                <h1 className="font-tech text-4xl md:text-5xl text-red-500 mb-2" style={{ textShadow: '0 0 10px #ef4444, 0 0 20px #ef4444, 0 0 30px #ef4444, 0 0 40px #dc2626, 0 0 70px #dc2626, 0 0 80px #dc2626, 0 0 100px #b91c1c' }}>
                  CARDIAC SOLUTIONS, LLC
                </h1>
                <p className="font-tech text-slate-300 tracking-[0.3em] text-sm" style={{ textShadow: '0 0 5px rgba(148, 163, 184, 0.5), 0 0 10px rgba(148, 163, 184, 0.3)' }}>
                  AED MONITORING COMMAND CENTER
                </p>
              </motion.div>

              {/* Login Form */}
              <motion.div
                className="w-full max-w-md"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="glass-dark rounded-lg p-8 hud-corners">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {isRegister && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
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

                    <div>
                      <label className="block text-xs font-tech text-slate-400 mb-2 tracking-wider">
                        USER NAME
                      </label>
                      <input
                        ref={usernameInputRef}
                        data-testid="username-input"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-transparent border-b border-slate-700 focus:border-red-500 px-0 py-3 text-white outline-none transition-colors font-mono"
                        placeholder="Enter username"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-tech text-slate-400 mb-2 tracking-wider">
                        PASSWORD
                      </label>
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
                          <span>{isRegister ? "REGISTER" : "LOGIN"}</span>
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
                      {isRegister ? "// EXISTING OPERATOR? LOGIN" : "// NEW OPERATOR? REGISTER"}
                    </button>
                  </div>

                  {/* Server connection status */}
                  <div className="mt-4 flex items-center justify-center gap-2" data-testid="server-status">
                    <div className={`w-2 h-2 rounded-full ${
                      serverStatus === "online" ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" :
                      serverStatus === "db-issue" ? "bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.6)]" :
                      serverStatus === "offline" ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" :
                      "bg-yellow-500 animate-pulse"
                    }`} />
                    <span className="text-[10px] font-tech text-slate-600 tracking-wider">
                      {serverStatus === "online" ? "SYSTEM READY" :
                       serverStatus === "db-issue" ? "DATABASE SYNC ISSUE" :
                       serverStatus === "offline" ? "SERVER OFFLINE" :
                       "CONNECTING..."}
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Corner Decorations */}
      <div className="absolute top-4 left-4 w-20 h-20 border-t-2 border-l-2 border-red-500/50" style={{ boxShadow: 'inset 10px 10px 20px rgba(239, 68, 68, 0.1)' }} />
      <div className="absolute top-4 right-4 w-20 h-20 border-t-2 border-r-2 border-red-500/50" style={{ boxShadow: 'inset -10px 10px 20px rgba(239, 68, 68, 0.1)' }} />
      <div className="absolute bottom-4 left-4 w-20 h-20 border-b-2 border-l-2 border-red-500/50" style={{ boxShadow: 'inset 10px -10px 20px rgba(239, 68, 68, 0.1)' }} />
      <div className="absolute bottom-4 right-4 w-20 h-20 border-b-2 border-r-2 border-red-500/50" style={{ boxShadow: 'inset -10px -10px 20px rgba(239, 68, 68, 0.1)' }} />
    </div>
  );
}
