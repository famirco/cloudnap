import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Clock, 
  Database, 
  Server, 
  RefreshCw, 
  Power, 
  Trash2, 
  Lock, 
  LogOut, 
  Search, 
  X,
  AlertTriangle,
  Moon,
  ArrowLeft
} from "lucide-react";
import { api, getStoredPassword, setStoredPassword } from "./api";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  
  // Data States
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [utcTime, setUtcTime] = useState("");

  // Search/Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // States to track sleep window creation per instance (Custom Calendar Range Picker)
  const [addingWindowForInstanceId, setAddingWindowForInstanceId] = useState(null);
  const [calendarStartVal, setCalendarStartVal] = useState(null);
  const [calendarEndVal, setCalendarEndVal] = useState(null);
  const [newSleepStartStr, setNewSleepStartStr] = useState("");
  const [newSleepEndStr, setNewSleepEndStr] = useState("");
  const [newSleepStartTimeStr, setNewSleepStartTimeStr] = useState("22:00");
  const [newSleepEndTimeStr, setNewSleepEndTimeStr] = useState("08:00");
  const [calendarBaseMonth, setCalendarBaseMonth] = useState(new Date());
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);

  // Initialize and run the dynamic UTC clock
  useEffect(() => {
    const formatUTC = () => {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      const weekday = weekdays[d.getUTCDay()];
      const day = d.getUTCDate();
      const month = months[d.getUTCMonth()];
      const year = d.getUTCFullYear();
      
      const hours = pad(d.getUTCHours());
      const minutes = pad(d.getUTCMinutes());
      const seconds = pad(d.getUTCSeconds());
      
      return `${weekday}, ${month} ${day}, ${year} • ${hours}:${minutes}:${seconds} UTC`;
    };
    setUtcTime(formatUTC());
    const interval = setInterval(() => {
      setUtcTime(formatUTC());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load Auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Fetch data if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      const res = await api.auth.getStatus();
      setAuthRequired(res.auth_required);
      if (!res.auth_required || res.authenticated) {
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error("Failed to check auth status:", err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const success = await api.auth.login(passwordInput);
      if (success) {
        setIsAuthenticated(true);
      } else {
        setAuthError("Incorrect password");
      }
    } catch (err) {
      setAuthError(err.message || "Failed to log in");
    }
  };

  const handleLogout = () => {
    api.auth.logout();
    setIsAuthenticated(false);
    setActiveTab("dashboard");
    setPasswordInput("");
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    const startTime = Date.now();
    try {
      const instList = await api.instances.list();
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
      }
      setInstances(instList);
    } catch (err) {
      setError(err.message || "Failed to retrieve data");
    } finally {
      setLoading(false);
    }
  };

  const parseDateString = (str) => {
    if (!str) return null;
    const parts = str.trim().split("/");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 0 && m < 12 && d > 0 && d <= 31) {
        // Ensure it represents a valid calendar date
        const checkDate = new Date(y, m, d);
        if (checkDate.getFullYear() === y && checkDate.getMonth() === m && checkDate.getDate() === d) {
          return { y, m, d };
        }
      }
    }
    return null;
  };

  const parseTimeString = (str) => {
    if (!str) return { h: 22, m: 0 };
    const parts = str.trim().split(":");
    const h = parseInt(parts[0], 10);
    const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    return {
      h: isNaN(h) || h < 0 || h > 23 ? 0 : h,
      m: isNaN(m) || m < 0 || m > 59 ? 0 : m
    };
  };

  const formatDateString = (dateObj) => {
    if (!dateObj) return "";
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
  };

  const handleAddWindow = async (instanceId, instanceName) => {
    const startDt = parseDateString(newSleepStartStr);
    const endDt = parseDateString(newSleepEndStr);

    if (!startDt || !endDt) {
      alert("Please select or enter valid start and end dates in YYYY/MM/DD format.");
      return;
    }

    const startTimeVal = parseTimeString(newSleepStartTimeStr);
    const endTimeVal = parseTimeString(newSleepEndTimeStr);

    const startUTC = new Date(Date.UTC(startDt.y, startDt.m, startDt.d, startTimeVal.h, startTimeVal.m));
    const endUTC = new Date(Date.UTC(endDt.y, endDt.m, endDt.d, endTimeVal.h, endTimeVal.m));

    if (endUTC <= startUTC) {
      alert("Sleep end must be after sleep start.");
      return;
    }

    // Format for human review in UTC
    const formatUTCString = (dateObj) => {
      try {
        return dateObj.toISOString().replace("T", " ").substring(0, 16) + " UTC";
      } catch (e) {
        return "Invalid Date";
      }
    };

    const startText = formatUTCString(startUTC);
    const endText = formatUTCString(endUTC);

    if (!confirm(`Are you sure you want to add a sleep window for ${instanceName}?\nStart (Sleep): ${startText}\nEnd (Wake up): ${endText}`)) {
      return;
    }

    try {
      await api.instances.addSchedule(instanceId, startUTC.toISOString(), endUTC.toISOString());
      setAddingWindowForInstanceId(null);
      setCalendarStartVal(null);
      setCalendarEndVal(null);
      setNewSleepStartStr("");
      setNewSleepEndStr("");
      fetchData();
    } catch (err) {
      alert(`Failed to add sleep window: ${err.message}`);
    }
  };


  const renderCalendar = () => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const leftYear = calendarBaseMonth.getFullYear();
    const leftMonth = calendarBaseMonth.getMonth();
    
    const rightDate = new Date(leftYear, leftMonth + 1, 1);
    const rightYear = rightDate.getFullYear();
    const rightMonth = rightDate.getMonth();

    const getMonthDays = (yr, mo) => {
      const daysInMonth = new Date(yr, mo + 1, 0).getDate();
      const startDayOfWeek = new Date(yr, mo, 1).getDay();
      return { daysInMonth, startDayOfWeek };
    };

    const getMidnightDate = (dateObj) => {
      if (!dateObj) return null;
      return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    };

    const handleDayClick = (cellDate) => {
      if (!calendarStartVal || (calendarStartVal && calendarEndVal)) {
        setCalendarStartVal(cellDate);
        setCalendarEndVal(null);
        setNewSleepStartStr(formatDateString(cellDate));
      } else {
        if (cellDate < calendarStartVal) {
          setCalendarStartVal(cellDate);
          setNewSleepStartStr(formatDateString(cellDate));
        } else {
          setCalendarEndVal(cellDate);
          setNewSleepEndStr(formatDateString(cellDate));
        }
      }
    };

    const renderMonthGrid = (yr, mo) => {
      const { daysInMonth, startDayOfWeek } = getMonthDays(yr, mo);
      const blanks = Array(startDayOfWeek).fill(null);
      const days = Array.from({ length: daysInMonth }, (_, idx) => idx + 1);
      const slots = [...blanks, ...days];

      const startMs = calendarStartVal ? getMidnightDate(calendarStartVal).getTime() : null;
      const endMs = calendarEndVal ? getMidnightDate(calendarEndVal).getTime() : null;

      return (
        <div className="grid grid-cols-7 gap-1 text-[11px]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(w => (
            <div key={w} className="text-zinc-500 font-semibold py-1">{w}</div>
          ))}
          {slots.map((d, index) => {
            if (d === null) return <div key={`blank-${index}`} className="py-1.5" />;
            
            const cellDate = new Date(yr, mo, d);
            const cellTime = cellDate.getTime();
            
            const today = new Date();
            const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const isToday = cellTime === todayMs;

            let cellStyle = "text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-lg cursor-pointer";
            if (isToday) {
              cellStyle = "text-amber-400 font-bold border border-amber-500/40 rounded-lg hover:bg-zinc-800 cursor-pointer";
            }
            if (startMs && cellTime === startMs) {
              cellStyle = "bg-blue-600 text-white font-bold rounded-lg border border-blue-500 shadow-md cursor-pointer";
            } else if (endMs && cellTime === endMs) {
              cellStyle = "bg-blue-600 text-white font-bold rounded-lg border border-blue-500 shadow-md cursor-pointer";
            } else if (startMs && endMs && cellTime > startMs && cellTime < endMs) {
              cellStyle = "bg-blue-500/20 text-white font-semibold rounded-none cursor-pointer";
            }

            return (
              <button
                key={`day-${d}`}
                type="button"
                onClick={() => handleDayClick(cellDate)}
                className={`py-1.5 transition flex items-center justify-center font-mono ${cellStyle}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      );
    };

    const prevMonth = () => {
      setCalendarBaseMonth(new Date(leftYear, leftMonth - 1, 1));
    };

    const nextMonth = () => {
      setCalendarBaseMonth(new Date(leftYear, leftMonth + 1, 1));
    };

    return (
      <div className="bg-zinc-950/60 border border-zinc-855/50 p-4 rounded-xl space-y-4">
        {/* Calendar Header with Navigation Chevrons */}
        <div className="flex justify-between items-center px-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg transition"
          >
            &lt;
          </button>
          
          <div className="flex justify-around flex-1 text-xs font-semibold text-zinc-300">
            <span>{months[leftMonth]} {leftYear}</span>
            <span>{months[rightMonth]} {rightYear}</span>
          </div>

          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg transition"
          >
            &gt;
          </button>
        </div>

        {/* Side-by-Side Month Grids */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          <div className="space-y-1">
            {renderMonthGrid(leftYear, leftMonth)}
          </div>
          <div className="space-y-1">
            {renderMonthGrid(rightYear, rightMonth)}
          </div>
        </div>
      </div>
    );
  };

  const handleDeleteWindow = async (instanceId, windowId) => {
    if (!confirm("Are you sure you want to delete this active time window?")) {
      return;
    }
    try {
      await api.instances.deleteSchedule(instanceId, windowId);
      fetchData(); // reload
    } catch (err) {
      alert(`Failed to delete active window: ${err.message}`);
    }
  };


  const handleSetOverride = async (instanceId, type) => {
    const actionText = type === "START" ? "start" : "stop";
    if (!confirm(`Are you sure you want to manually ${actionText} this instance? This will override the schedule until you click "Resume Schedule".`)) {
      return;
    }
    try {
      await api.instances.setOverride(instanceId, type);
      const updatedList = await api.instances.list();
      setInstances(updatedList);
    } catch (err) {
      alert(`Error applying override: ${err.message}`);
    }
  };

  const handleCancelOverride = async (instanceId) => {
    try {
      await api.instances.deleteOverride(instanceId);
      const updatedList = await api.instances.list();
      setInstances(updatedList);
    } catch (err) {
      alert(`Error cancelling override: ${err.message}`);
    }
  };

  // Metrics calculation
  const calculateMetrics = () => {
    const totalInstances = instances.length;
    const runningInstances = instances.filter(i => i.status === "running").length;
    const sleepingInstances = instances.filter(i => i.status === "stopped").length;
    const scheduledInstances = instances.filter(i => i.schedules && i.schedules.length > 0).length;
    const activeOverrides = instances.filter(i => i.override).length;

    return {
      totalInstances,
      runningInstances,
      sleepingInstances,
      scheduledInstances,
      activeOverrides
    };
  };

  const metrics = calculateMetrics();

  // Filters logic
  const filteredInstances = instances.filter(inst => {
    const matchesSearch = inst.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inst.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = regionFilter === "all" || inst.region === regionFilter;
    const matchesType = typeFilter === "all" || inst.type === typeFilter;
    return matchesSearch && matchesRegion && matchesType;
  });

  // Extract unique regions for filters
  const uniqueRegions = Array.from(new Set(instances.map(i => i.region)));

  // View: Login Page
  if (!isAuthenticated && authRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel w-full max-w-md p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
          <div className="flex flex-col items-center mb-8">
            <span className="text-5xl mb-3">😴</span>
            <h1 className="text-3xl font-bold tracking-tight text-white">CloudNap</h1>
            <p className="text-zinc-400 text-sm mt-1">AWS Instance Scheduler</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="glass-input w-full px-4 py-3 rounded-xl pr-10 text-white placeholder-zinc-500"
                  placeholder="Enter access password"
                  required
                />
                <Lock className="absolute right-3 top-3.5 h-5 w-5 text-zinc-500" />
              </div>
              {authError && <p className="text-red-400 text-xs mt-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {authError}</p>}
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition duration-200 shadow-lg shadow-blue-500/20"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderInstanceDetail = (inst) => {
    if (!inst) return null;
    const isTransitioning = inst.status === "starting" || inst.status === "stopping";
    
    // Sort schedules chronologically by start_time
    const sortedSchedules = [...(inst.schedules || [])].sort((a, b) => {
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Back button and title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <button
            onClick={() => {
              setSelectedInstanceId(null);
              setAddingWindowForInstanceId(null);
            }}
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-semibold transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Resources
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl border border-zinc-700 transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Resource Header Panel */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 w-max mb-3 ${
                inst.type === "ec2" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
              }`}>
                {inst.type === "ec2" ? <Server className="h-3 w-3" /> : <Database className="h-3 w-3" />}
                {inst.type.toUpperCase()}
              </span>
              <h2 className="text-2xl font-bold text-white">{inst.name}</h2>
              <p className="text-zinc-500 text-xs font-mono mt-1">{inst.id} • {inst.region}</p>
            </div>
            
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 mb-2">
                <span className={`h-2.5 w-2.5 rounded-full ${
                  inst.status === "running" ? "bg-emerald-500 shadow-md shadow-emerald-500/50" :
                  inst.status === "stopped" ? "bg-zinc-600" : "bg-yellow-500 animate-pulse"
                }`}></span>
                <span className={`text-sm font-bold capitalize ${
                  inst.status === "running" ? "text-emerald-400" :
                  inst.status === "stopped" ? "text-zinc-400" : "text-yellow-400"
                }`}>{inst.status}</span>
              </div>
            </div>
          </div>

          {/* Quick manual overrides inside the detail view */}
          <div className="pt-4 border-t border-zinc-800/80">
            <span className="block text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Manual Override controls</span>
            {inst.override ? (
              <div className="bg-yellow-500/5 border border-yellow-500/10 p-4 rounded-xl flex items-center justify-between gap-4">
                <div className="text-xs">
                  <span className="text-yellow-400 font-semibold block mb-0.5">
                    {inst.override.override_type === "START" ? "Manually Started" : "Manually Stopped"}
                  </span>
                  <span className="text-zinc-500 text-[10px]">Auto-schedule is paused while manual override is active</span>
                </div>
                <button
                  onClick={() => handleCancelOverride(inst.id)}
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg transition"
                >
                  Resume Schedule
                </button>
              </div>
            ) : (
              <div className="flex gap-4">
                <button
                  onClick={() => handleSetOverride(inst.id, "START")}
                  disabled={inst.status === "running" || isTransitioning}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white py-2.5 rounded-xl text-xs font-semibold transition"
                >
                  <Power className="h-3.5 w-3.5" /> Start Instance Manually
                </button>
                <button
                  onClick={() => handleSetOverride(inst.id, "STOP")}
                  disabled={inst.status === "stopped" || isTransitioning}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white py-2.5 rounded-xl text-xs font-semibold transition"
                >
                  <X className="h-3.5 w-3.5" /> Stop Instance Manually
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Schedules Grid & Creator Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left panel: List existing schedules, sorted by date */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Sleep Schedules</h3>
            
            {sortedSchedules.length === 0 ? (
              <p className="text-zinc-500 text-sm italic py-4">Running 24/7 (No sleep schedules registered)</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {sortedSchedules.map(win => {
                  const parseUTC = (str) => {
                    if (!str) return new Date();
                    return new Date(str.endsWith("Z") ? str : str + "Z");
                  };
                  const startDt = parseUTC(win.start_time);
                  const endDt = parseUTC(win.end_time);
                  const nowDt = new Date();
                  
                  let statusText = "Scheduled";
                  let statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                  if (nowDt >= endDt) {
                    statusText = "Expired";
                    statusColor = "bg-zinc-800 text-zinc-500 border-zinc-700/50";
                  } else if (nowDt >= startDt && nowDt < endDt) {
                    statusText = "Sleeping";
                    statusColor = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse";
                  }

                  const formatUTC = (d) => {
                    try {
                      return d.toISOString().replace("T", " ").substring(0, 16) + " UTC";
                    } catch (e) {
                      return "Invalid Date";
                    }
                  };

                  return (
                    <div key={win.id} className="flex justify-between items-center text-xs bg-zinc-900/50 border border-zinc-800/80 p-3.5 rounded-xl">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-zinc-300 block truncate text-sm">Sleep Duration</span>
                        <span className="text-zinc-500 font-mono text-[11px] block mt-1">
                          OFF: {formatUTC(startDt)}
                        </span>
                        <span className="text-zinc-500 font-mono text-[11px] block">
                          ON:  {formatUTC(endDt)}
                        </span>
                        <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded border mt-2 ${statusColor}`}>
                          {statusText}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteWindow(inst.id, win.id)}
                        className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition shrink-0"
                        title="Delete Window"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: Add Sleep Window */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Define Sleep Window</h3>
              <span className="text-[10px] text-yellow-500 font-semibold px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-md">Offline/Sleep Plan</span>
            </div>
            
            <p className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-900/40 p-3 rounded-xl border border-zinc-800">
              ℹ️ <strong>Sleep Duration:</strong> The resource will be stopped during the selected range, and will run normally outside of it.
            </p>

            {renderCalendar()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-zinc-500 text-[10px] font-semibold uppercase tracking-wider">Turn OFF date</label>
                <input
                  type="text"
                  placeholder="YYYY/MM/DD"
                  value={newSleepStartStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewSleepStartStr(val);
                    const parsed = parseDateString(val);
                    if (parsed) {
                      setCalendarStartVal(new Date(parsed.y, parsed.m, parsed.d));
                    }
                  }}
                  className="glass-input w-full px-3 py-2 rounded-xl text-xs text-white bg-zinc-900 border border-zinc-850/60 font-mono"
                />
                <input
                  type="text"
                  placeholder="HH:MM"
                  value={newSleepStartTimeStr}
                  onChange={(e) => setNewSleepStartTimeStr(e.target.value)}
                  className="glass-input w-full px-3 py-2 rounded-xl text-xs text-white bg-zinc-900 border border-zinc-850/60 font-mono"
                />
                {newSleepStartStr && (
                  <span className="block text-[9px] text-zinc-500 font-mono">
                    UTC: {(() => {
                      const parsed = parseDateString(newSleepStartStr);
                      if (!parsed) return "Invalid Date";
                      const timeVal = parseTimeString(newSleepStartTimeStr);
                      const d = new Date(Date.UTC(parsed.y, parsed.m, parsed.d, timeVal.h, timeVal.m));
                      return d.toISOString().replace("T", " ").substring(0, 16) + " UTC";
                    })()}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-zinc-500 text-[10px] font-semibold uppercase tracking-wider">Turn ON date</label>
                <input
                  type="text"
                  placeholder="YYYY/MM/DD"
                  value={newSleepEndStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewSleepEndStr(val);
                    const parsed = parseDateString(val);
                    if (parsed) {
                      setCalendarEndVal(new Date(parsed.y, parsed.m, parsed.d));
                    }
                  }}
                  className="glass-input w-full px-3 py-2 rounded-xl text-xs text-white bg-zinc-900 border border-zinc-850/60 font-mono"
                />
                <input
                  type="text"
                  placeholder="HH:MM"
                  value={newSleepEndTimeStr}
                  onChange={(e) => setNewSleepEndTimeStr(e.target.value)}
                  className="glass-input w-full px-3 py-2 rounded-xl text-xs text-white bg-zinc-900 border border-zinc-850/60 font-mono"
                />
                {newSleepEndStr && (
                  <span className="block text-[9px] text-zinc-500 font-mono">
                    UTC: {(() => {
                      const parsed = parseDateString(newSleepEndStr);
                      if (!parsed) return "Invalid Date";
                      const timeVal = parseTimeString(newSleepEndTimeStr);
                      const d = new Date(Date.UTC(parsed.y, parsed.m, parsed.d, timeVal.h, timeVal.m));
                      return d.toISOString().replace("T", " ").substring(0, 16) + " UTC";
                    })()}
                  </span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-zinc-500">For date, use YYYY/MM/DD.</p>

            <button
              type="button"
              onClick={() => handleAddWindow(inst.id, inst.name)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-semibold transition"
            >
              Save Sleep Window
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 glass-panel md:min-h-screen flex flex-col border-r border-zinc-800">
        <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
          <span className="text-3xl">😴</span>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white">CloudNap</h1>
            <p className="text-zinc-500 text-xs font-mono">SELF-HOSTED</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => {
              setActiveTab("dashboard");
              setSelectedInstanceId(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-150 ${activeTab === "dashboard" ? "bg-blue-600/20 text-blue-400 border border-blue-500/20 font-medium" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"}`}
          >
            <Activity className="h-5 w-5" />
            Dashboard
          </button>
          <button
            onClick={() => {
              setActiveTab("instances");
              setSelectedInstanceId(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-150 ${activeTab === "instances" ? "bg-blue-600/20 text-blue-400 border border-blue-500/20 font-medium" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"}`}
          >
            <Server className="h-5 w-5" />
            Instances
          </button>
        </nav>

        {authRequired && (
          <div className="p-4 border-t border-zinc-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-red-500/10 hover:text-red-400 transition duration-150"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white capitalize">{activeTab}</h2>
            <p className="text-zinc-400 text-sm mt-1">Manage AWS compute and database schedules to sleep cost overheads.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="glass-panel px-4 py-2.5 rounded-xl border border-zinc-800 flex items-center gap-2 text-sm font-mono text-blue-400 shadow-lg shadow-blue-500/5 select-none shrink-0">
              <Clock className="h-4 w-4 animate-pulse shrink-0" />
              <span>{utcTime}</span>
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl border border-zinc-700 transition shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Data
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab content rendering */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex justify-between items-start mb-4">
                  <span className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                    <Server className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-mono text-zinc-500">MANAGED</span>
                </div>
                <h3 className="text-2xl font-bold text-white">{metrics.totalInstances}</h3>
                <p className="text-zinc-400 text-sm mt-1">Total AWS Resources</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex justify-between items-start mb-4">
                  <span className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                    <Clock className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-mono text-purple-500">SCHEDULED</span>
                </div>
                <h3 className="text-2xl font-bold text-white">{metrics.scheduledInstances}</h3>
                <p className="text-zinc-400 text-sm mt-1">Automation active</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex justify-between items-start mb-4">
                  <span className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
                    <AlertTriangle className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-mono text-amber-500">OVERRIDES</span>
                </div>
                <h3 className="text-2xl font-bold text-white">{metrics.activeOverrides}</h3>
                <p className="text-zinc-400 text-sm mt-1">Manual holds active</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex justify-between items-start mb-4">
                  <span className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <Moon className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-mono text-emerald-500">SLEEPING</span>
                </div>
                <h3 className="text-2xl font-bold text-white">{metrics.sleepingInstances} / {metrics.totalInstances}</h3>
                <p className="text-zinc-400 text-sm mt-1">Stopped (Inactive)</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "instances" && (
          <div className="space-y-6">
            {selectedInstanceId ? (
              renderInstanceDetail(instances.find(i => i.id === selectedInstanceId))
            ) : (
              <>
                {/* Filters panel */}
                <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full md:w-72">
                    <input
                      type="text"
                      placeholder="Search resources..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="glass-input w-full px-4 py-2.5 pl-10 rounded-xl text-white placeholder-zinc-500 text-sm"
                    />
                    <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  </div>

                  <div className="flex flex-wrap gap-4 w-full md:w-auto">
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="glass-input px-4 py-2.5 rounded-xl text-sm bg-dark-800 text-white min-w-[120px]"
                    >
                      <option value="all">All Types</option>
                      <option value="ec2">EC2 Instances</option>
                      <option value="rds">RDS Databases</option>
                    </select>

                    <select
                      value={regionFilter}
                      onChange={(e) => setRegionFilter(e.target.value)}
                      className="glass-input px-4 py-2.5 rounded-xl text-sm bg-dark-800 text-white min-w-[140px]"
                    >
                      <option value="all">All Regions</option>
                      {uniqueRegions.map(reg => (
                        <option key={reg} value={reg}>{reg}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grid of Instances */}
                {filteredInstances.length === 0 ? (
                  <div className="glass-panel p-12 rounded-2xl text-center">
                    <p className="text-zinc-500">No resources found matching current criteria.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredInstances.map(inst => {
                      const isTransitioning = inst.status === "starting" || inst.status === "stopping";
                      const activeSchedulesCount = inst.schedules ? inst.schedules.length : 0;
                      
                      return (
                        <div 
                          key={inst.id} 
                          onClick={() => {
                            setSelectedInstanceId(inst.id);
                            setAddingWindowForInstanceId(inst.id);
                          }}
                          className={`glass-panel p-6 rounded-2xl flex flex-col justify-between glass-panel-hover relative cursor-pointer select-none transition ${isTransitioning ? "pulsing-glow" : ""}`}
                        >
                          {/* Top section: name and type */}
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                                inst.type === "ec2" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                              }`}>
                                {inst.type === "ec2" ? <Server className="h-3 w-3" /> : <Database className="h-3 w-3" />}
                                {inst.type.toUpperCase()}
                              </span>
                              
                              <span className="text-xs font-mono text-zinc-500">{inst.region}</span>
                            </div>

                            <h4 className="font-bold text-white text-lg truncate mb-1" title={inst.name}>{inst.name}</h4>
                            <p className="text-zinc-500 text-xs font-mono mb-4 truncate">{inst.id}</p>

                            {/* Status badge */}
                            <div className="flex items-center gap-2 mb-4">
                              <span className={`h-2.5 w-2.5 rounded-full ${
                                inst.status === "running" ? "bg-emerald-500 shadow-md shadow-emerald-500/50" :
                                inst.status === "stopped" ? "bg-zinc-600" : "bg-yellow-500 animate-pulse"
                              }`}></span>
                              <span className={`text-sm font-semibold capitalize ${
                                inst.status === "running" ? "text-emerald-400" :
                                inst.status === "stopped" ? "text-zinc-400" : "text-yellow-400"
                              }`}>{inst.status}</span>
                            </div>
                          </div>

                          {/* Bottom section: brief metadata summary */}
                          <div className="mt-4 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                            <span>Schedules status:</span>
                            <span className={`font-semibold ${activeSchedulesCount > 0 ? "text-blue-400" : "text-zinc-400"}`}>
                              {activeSchedulesCount > 0 
                                ? `${activeSchedulesCount} Sleep Window${activeSchedulesCount > 1 ? "s" : ""}` 
                                : "Running 24/7"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
