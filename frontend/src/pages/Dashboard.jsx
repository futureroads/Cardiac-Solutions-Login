import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import {
  Activity,
  Bell,
  Download,
  LogOut,
  RefreshCw,
  Heart,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Wifi,
  WifiOff,
  ChevronUp,
  ChevronDown,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { ScrollArea } from "../components/ui/scroll-area";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

// Status Card Component
const StatusCard = ({ title, value, icon: Icon, color, trend, trendValue }) => {
  const colorClasses = {
    red: "text-red-500 border-red-500/30 bg-red-500/5",
    cyan: "text-cyan-500 border-cyan-500/30 bg-cyan-500/5",
    green: "text-green-500 border-green-500/30 bg-green-500/5",
    yellow: "text-yellow-500 border-yellow-500/30 bg-yellow-500/5",
    orange: "text-orange-500 border-orange-500/30 bg-orange-500/5",
    pink: "text-pink-500 border-pink-500/30 bg-pink-500/5",
    purple: "text-purple-500 border-purple-500/30 bg-purple-500/5",
    slate: "text-slate-400 border-slate-500/30 bg-slate-500/5",
  };

  const glowStyles = {
    red: { textShadow: '0 0 10px rgba(239, 68, 68, 0.6)', filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.4))' },
    green: { textShadow: '0 0 10px rgba(34, 197, 94, 0.6)', filter: 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.4))' },
    yellow: { textShadow: '0 0 10px rgba(234, 179, 8, 0.6)', filter: 'drop-shadow(0 0 4px rgba(234, 179, 8, 0.4))' },
    orange: { textShadow: '0 0 10px rgba(249, 115, 22, 0.6)', filter: 'drop-shadow(0 0 4px rgba(249, 115, 22, 0.4))' },
    pink: { textShadow: '0 0 10px rgba(236, 72, 153, 0.6)', filter: 'drop-shadow(0 0 4px rgba(236, 72, 153, 0.4))' },
    purple: { textShadow: '0 0 10px rgba(168, 85, 247, 0.6)', filter: 'drop-shadow(0 0 4px rgba(168, 85, 247, 0.4))' },
    cyan: { textShadow: '0 0 10px rgba(6, 182, 212, 0.6)', filter: 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.4))' },
    slate: { textShadow: 'none', filter: 'none' },
  };

  return (
    <motion.div
      className={`relative p-4 rounded-lg border ${colorClasses[color]} hud-corners overflow-hidden`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <Icon className="w-5 h-5 mb-2 opacity-60" style={{ filter: glowStyles[color]?.filter }} />
          <div className="font-tech text-3xl md:text-4xl font-bold" style={{ textShadow: glowStyles[color]?.textShadow }}>{value}</div>
          <div className="font-tech text-xs text-slate-500 tracking-wider mt-1 uppercase">
            {title}
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Subscriber Row Component
const SubscriberRow = ({ subscriber, index }) => {
  const percentReady = subscriber.total > 0 
    ? ((subscriber.ready / subscriber.total) * 100).toFixed(1) 
    : 0;
  
  const getPercentColor = (pct) => {
    if (pct >= 90) return "text-green-500";
    if (pct >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  const getTrend = (val) => {
    if (val === 0) return null;
    return Math.random() > 0.5 ? "up" : "down";
  };

  return (
    <TableRow className="border-slate-800/50 hover:bg-slate-900/50">
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${percentReady >= 90 ? 'bg-green-500' : percentReady >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`} />
          <span className="text-slate-300">{subscriber.name}</span>
        </div>
      </TableCell>
      <TableCell className="text-center font-mono text-slate-400">{subscriber.total}</TableCell>
      <TableCell className={`text-center font-mono ${getPercentColor(percentReady)}`}>
        <div className="flex items-center justify-center gap-1">
          {percentReady}%
          {getTrend(percentReady) && (
            getTrend(percentReady) === 'up' 
              ? <ChevronUp className="w-3 h-3" /> 
              : <ChevronDown className="w-3 h-3" />
          )}
        </div>
      </TableCell>
      <TableCell className="text-center font-mono text-green-500">{subscriber.ready || '—'}</TableCell>
      <TableCell className="text-center font-mono text-red-500">{subscriber.not_ready || '—'}</TableCell>
      <TableCell className="text-center font-mono text-yellow-500">{subscriber.reposition || '—'}</TableCell>
      <TableCell className="text-center font-mono text-slate-400">{subscriber.not_present || '—'}</TableCell>
      <TableCell className="text-center font-mono text-orange-500">{subscriber.expired_bp || '—'}</TableCell>
      <TableCell className="text-center font-mono text-amber-500">{subscriber.expiring_bp || '—'}</TableCell>
      <TableCell className="text-center font-mono text-pink-500">{subscriber.lost_contact || '—'}</TableCell>
      <TableCell className="text-center font-mono text-purple-500">{subscriber.unknown || '—'}</TableCell>
    </TableRow>
  );
};

export default function Dashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [filterStatus, setFilterStatus] = useState("all");
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isClicking, setIsClicking] = useState(false);
  const [showCustomCursor, setShowCustomCursor] = useState(true);

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

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };

    try {
      const [statsRes, subscribersRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`, config),
        axios.get(`${API}/dashboard/subscribers`, config)
      ]);
      setStats(statsRes.data);
      setSubscribers(subscribersRes.data);
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        onLogout();
      } else {
        toast.error("Failed to fetch dashboard data");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
    toast.success("Data refreshed");
  };

  const sortedSubscribers = [...subscribers].sort((a, b) => {
    const aVal = a[sortField] || 0;
    const bVal = b[sortField] || 0;
    if (sortField === "name") {
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
  });

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center" style={{ cursor: 'none' }}>
        {showCustomCursor && <AEDCursor position={cursorPosition} isClicking={isClicking} />}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Activity className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
          <div className="font-tech text-red-500 tracking-wider">LOADING SYSTEMS...</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] holo-grid" style={{ cursor: 'none' }}>
      {/* Custom Cursor */}
      {showCustomCursor && <AEDCursor position={cursorPosition} isClicking={isClicking} />}
      
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 glass-dark border-b border-slate-800/50">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              data-testid="notifications-btn"
              className="flex items-center gap-2 px-4 py-2 border border-red-500/30 rounded text-red-500 hover:bg-red-500/10 transition-colors font-tech text-sm tracking-wider"
              style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.5)' }}
            >
              <Bell className="w-4 h-4" style={{ filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))' }} />
              NOTIFICATIONS
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              data-testid="refresh-btn"
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 border border-red-500/30 rounded text-red-500 hover:bg-red-500/10 transition-colors font-tech text-sm tracking-wider"
              style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.5)' }}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} style={{ filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))' }} />
              REFRESH
            </button>
            <button 
              data-testid="download-csv-btn"
              className="flex items-center gap-2 px-4 py-2 border border-red-500/30 rounded text-red-500 hover:bg-red-500/10 transition-colors font-tech text-sm tracking-wider"
              style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.5)' }}
            >
              <Download className="w-4 h-4" style={{ filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))' }} />
              DOWNLOAD CSV
            </button>
            <button
              data-testid="logout-btn"
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 border border-red-500/30 rounded text-red-500 hover:bg-red-500/10 transition-colors font-tech text-sm tracking-wider"
            >
              <LogOut className="w-4 h-4" />
              LOGOUT
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto p-6">
        {/* Header */}
        <motion.div
          className="glass-dark rounded-lg p-6 mb-6 border border-slate-800/50"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-6 h-6 text-red-500" style={{ filter: 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))' }} />
            <h1 className="font-tech text-2xl text-red-500 tracking-wider" style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.4)' }}>
              Daily AED Status Report
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 font-mono">
            <Clock className="w-4 h-4" />
            Last updated: {stats ? formatDate(stats.last_updated) : "—"}
          </div>
        </motion.div>

        {/* Stats Grid - Top Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <StatusCard
            title="Total Monitored"
            value={stats?.total_monitored?.toLocaleString() || "—"}
            icon={Activity}
            color="red"
          />
          <StatusCard
            title="% Ready"
            value={`${stats?.percent_ready || 0}%`}
            icon={CheckCircle2}
            color="green"
            trend="down"
            trendValue="0.3%"
          />
          <StatusCard
            title="Ready"
            value={stats?.ready?.toLocaleString() || "—"}
            icon={CheckCircle2}
            color="green"
            trend="down"
            trendValue="12"
          />
          <StatusCard
            title="Not Ready"
            value={stats?.not_ready || "—"}
            icon={XCircle}
            color="red"
          />
          <StatusCard
            title="Reposition"
            value={stats?.reposition || "—"}
            icon={MapPin}
            color="yellow"
            trend="down"
            trendValue="3"
          />
        </div>

        {/* Stats Grid - Bottom Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatusCard
            title="Not Present"
            value={stats?.not_present || "—"}
            icon={AlertTriangle}
            color="slate"
            trend="up"
            trendValue="1"
          />
          <StatusCard
            title="Expired B/P"
            value={stats?.expired_bp || "—"}
            icon={Clock}
            color="orange"
          />
          <StatusCard
            title="Expiring B/P"
            value={stats?.expiring_bp || "—"}
            icon={AlertTriangle}
            color="yellow"
            trend="down"
            trendValue="2"
          />
          <StatusCard
            title="Lost Contact"
            value={stats?.lost_contact || "—"}
            icon={WifiOff}
            color="pink"
            trend="up"
            trendValue="5"
          />
          <StatusCard
            title="Unknown"
            value={stats?.unknown || "—"}
            icon={AlertTriangle}
            color="purple"
          />
        </div>

        {/* Subscribers Table */}
        <motion.div
          className="glass-dark rounded-lg border border-slate-800/50 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Table Controls */}
          <div className="p-4 border-b border-slate-800/50 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-slate-400 font-tech">
              <span>SORT:</span>
              <DropdownMenu>
                <DropdownMenuTrigger data-testid="sort-dropdown" className="flex items-center gap-1 px-3 py-1 border border-slate-700 rounded text-slate-300 hover:border-red-500/50 transition-colors">
                  <span className="capitalize">{sortField === "name" ? "Alphabetical" : sortField}</span>
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-700">
                  <DropdownMenuItem onClick={() => setSortField("name")}>Alphabetical</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField("total")}>Total</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField("ready")}>Ready</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField("not_ready")}>Not Ready</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                data-testid="sort-direction-btn"
                onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                className="p-1 border border-slate-700 rounded hover:border-red-500/50 transition-colors"
              >
                {sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-400 font-tech">
              <Filter className="w-4 h-4" />
              <DropdownMenu>
                <DropdownMenuTrigger data-testid="filter-dropdown" className="flex items-center gap-1 px-3 py-1 border border-slate-700 rounded text-slate-300 hover:border-red-500/50 transition-colors">
                  <span>Filter by Status</span>
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-700">
                  <DropdownMenuItem onClick={() => setFilterStatus("all")}>All</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("ready")}>Ready Only</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("issues")}>Has Issues</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Table */}
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-900/95 backdrop-blur-sm">
                <TableRow className="border-slate-800/50 hover:bg-transparent">
                  <TableHead className="font-tech text-slate-400 tracking-wider">SUBSCRIBER</TableHead>
                  <TableHead className="font-tech text-slate-400 tracking-wider text-center">TOTAL</TableHead>
                  <TableHead className="font-tech text-slate-400 tracking-wider text-center">% READY</TableHead>
                  <TableHead className="font-tech text-slate-400 tracking-wider text-center">READY</TableHead>
                  <TableHead className="font-tech text-slate-400 tracking-wider text-center">NOT READY</TableHead>
                  <TableHead className="font-tech text-slate-400 tracking-wider text-center">REPOSITION</TableHead>
                  <TableHead className="font-tech text-slate-400 tracking-wider text-center">NOT PRESENT</TableHead>
                  <TableHead className="font-tech text-slate-400 tracking-wider text-center">EXPIRED B/P</TableHead>
                  <TableHead className="font-tech text-slate-400 tracking-wider text-center">EXPIRING B/P</TableHead>
                  <TableHead className="font-tech text-slate-400 tracking-wider text-center">LOST CONTACT</TableHead>
                  <TableHead className="font-tech text-slate-400 tracking-wider text-center">UNKNOWN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSubscribers.map((subscriber, index) => (
                  <SubscriberRow key={subscriber.id} subscriber={subscriber} index={index} />
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </motion.div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs font-mono text-slate-600">
          <span>CARDIAC SOLUTIONS LLC</span>
          <span className="mx-2">|</span>
          <span>AED MONITORING SYSTEM</span>
          <span className="mx-2">|</span>
          <span>v3.14.159</span>
          <span className="mx-2">|</span>
          <span>OPERATOR: {user?.name || "Unknown"}</span>
        </div>
      </main>
    </div>
  );
}
