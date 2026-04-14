import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import SupportDashboard from "./pages/SupportDashboard";
import CommandCenterHub from "./pages/CommandCenterHub";
import UserAccess from "./pages/UserAccess";
import BackendManagement from "./pages/BackendManagement";
import OutageStatus from "./pages/OutageStatus";
import HybridTraining from "./pages/HybridTraining";
import CustomerPortal from "./pages/CustomerPortal";
import ServiceTickets from "./pages/ServiceTickets";
import TechResponse from "./pages/TechResponse";
import MapPage from "./pages/MapPage";
import { Toaster } from "./components/ui/sonner";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (token && storedUser) {
      // Check if JWT is expired
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          // Token expired — force logout
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setIsAuthenticated(false);
          setUser(null);
          setLoading(false);
          return;
        }
      } catch {
        // Invalid token format — clear it
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setLoading(false);
        return;
      }
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Keep-alive: ping server every 45s while logged in to prevent pod sleep
  useEffect(() => {
    if (!isAuthenticated) return;
    const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
    const ping = () => fetch(`${API_BASE}/api/health`).catch(() => {});
    ping(); // immediate ping on login
    const interval = setInterval(ping, 45000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogin = (token, userData) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
    // Hard navigate to hub — bypasses all React Router state issues
    window.location.href = "/hub";
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    setUser(null);
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-red-500 font-tech text-xl">INITIALIZING SYSTEMS...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              isAuthenticated ? 
                <Navigate to="/hub" replace /> : 
                <LoginPage onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/hub" 
            element={
              isAuthenticated ? 
                <CommandCenterHub user={user} onLogout={handleLogout} /> : 
                <Navigate to="/" replace />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              isAuthenticated ? 
                (user?.dashboard_type === "support" ? 
                  <SupportDashboard user={user} onLogout={handleLogout} /> :
                  <Dashboard user={user} onLogout={handleLogout} />
                ) : 
                <Navigate to="/" replace />
            } 
          />
          <Route 
            path="/user-access" 
            element={
              isAuthenticated && user?.role === "admin" ? 
                <UserAccess onLogout={handleLogout} /> : 
                <Navigate to="/hub" replace />
            } 
          />
          <Route 
            path="/backend" 
            element={
              isAuthenticated && user?.role === "admin" ? 
                <BackendManagement user={user} onLogout={handleLogout} /> : 
                <Navigate to="/hub" replace />
            } 
          />
          <Route 
            path="/outage" 
            element={
              isAuthenticated && user?.role === "admin" ? 
                <OutageStatus user={user} onLogout={handleLogout} /> : 
                <Navigate to="/hub" replace />
            } 
          />
          <Route 
            path="/hybridtraining" 
            element={
              isAuthenticated && user?.role === "admin" ? 
                <HybridTraining user={user} onLogout={handleLogout} /> : 
                <Navigate to="/hub" replace />
            } 
          />
          <Route 
            path="/customerportal" 
            element={
              isAuthenticated && user?.role === "admin" ? 
                <CustomerPortal user={user} onLogout={handleLogout} /> : 
                <Navigate to="/hub" replace />
            } 
          />
          <Route 
            path="/service-tickets" 
            element={
              isAuthenticated ? 
                <ServiceTickets user={user} onLogout={handleLogout} /> : 
                <Navigate to="/" replace />
            } 
          />
          <Route 
            path="/map" 
            element={
              isAuthenticated ? 
                <MapPage user={user} /> : 
                <Navigate to="/" replace />
            } 
          />
          <Route 
            path="/tech/:ticketId" 
            element={<TechResponse />} 
          />
          <Route 
            path="*" 
            element={
              isAuthenticated ? 
                <Navigate to="/hub" replace /> : 
                <Navigate to="/" replace />
            } 
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
