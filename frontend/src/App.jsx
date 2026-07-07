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
  Sun,
  ArrowLeft,
  Settings,
  Info,
  DollarSign,
  TrendingUp,
  Key,
  Globe,
  CheckCircle,
  XCircle
} from "lucide-react";
import { api, getStoredPassword, setStoredPassword } from "./api";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("cloudnap-theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  
  // Data States
  const [instances, setInstances] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [utcTime, setUtcTime] = useState("");

  // Search/Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [logSearchQuery, setLogSearchQuery] = useState("");

  // States to track sleep window creation per instance (Custom Calendar Range Picker)
  const [addingWindowForInstanceId, setAddingWindowForInstanceId] = useState(null);
  const [calendarStartVal, setCalendarStartVal] = useState(null);
  const [calendarEndVal, setCalendarEndVal] = useState(null);
  const [newSleepStartStr, setNewSleepStartStr] = useState("");
  const [newSleepEndStr, setNewSleepEndStr] = useState("");
  const [newSleepStartTimeStr, setNewSleepStartTimeStr] = useState("22:00");
  const [newSleepEndTimeStr, setNewSleepEndTimeStr] = useState("08:00");
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [savingsModalType, setSavingsModalType] = useState(null); // 'total', 'rate', or null
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  // AWS Accounts states
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountRoleArn, setAccountRoleArn] = useState("");
  const [accountAccessKeyId, setAccountAccessKeyId] = useState("");
  const [accountSecretAccessKey, setAccountSecretAccessKey] = useState("");
  const [accountExternalId, setAccountExternalId] = useState("");
  const [accountIsActive, setAccountIsActive] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [testingConnectionId, setTestingConnectionId] = useState(null);
  const [connectionTestResults, setConnectionTestResults] = useState({});
  const [calendarBaseMonth, setCalendarBaseMonth] = useState(new Date());
  const [schedType, setSchedType] = useState("ONCE"); // "ONCE", "DAILY", "WEEKLY"
  const [selectedDays, setSelectedDays] = useState({
    1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 7: false
  });

  // Settings tab states
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackChannel, setSlackChannel] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [activeHelpModal, setActiveHelpModal] = useState(null); // null, "slack", "telegram"

  // Lease expiry states
  const [newExpiryDateStr, setNewExpiryDateStr] = useState("");
  const [newExpiryTimeStr, setNewExpiryTimeStr] = useState("18:00");
  const [expirySaving, setExpirySaving] = useState(false);

  const handleSetExpiry = async (instanceId, instanceName) => {
    if (expirySaving) return;

    let payloadDate = null;
    if (newExpiryDateStr) {
      const parsed = parseDateString(newExpiryDateStr);
      if (!parsed) {
        alert("Please enter a valid expiry date in YYYY/MM/DD format.");
        return;
      }
      const parsedTime = parseTimeString(newExpiryTimeStr);
      const utcDate = new Date(Date.UTC(parsed.y, parsed.m, parsed.d, parsedTime.h, parsedTime.m));
      payloadDate = utcDate.toISOString();
    } else {
      if (!confirm("Are you sure you want to clear the lease expiry date?")) {
        return;
      }
    }

    setExpirySaving(true);
    try {
      await api.instances.setExpiry(instanceId, payloadDate);
      alert(payloadDate ? "Lease expiry set successfully!" : "Lease expiry cleared!");
      fetchData(); // reload
    } catch (err) {
      alert(`Failed to set lease expiry: ${err.message}`);
    } finally {
      setExpirySaving(false);
    }
  };

  const handleTestSettings = async (type) => {
    if (type === "slack") {
      setTestingSlack(true);
      try {
        await api.instances.testSettings({
          integration_type: "slack",
          slack_webhook_url: slackWebhookUrl,
          slack_channel: slackChannel
        });
        alert("Slack test message sent successfully!");
      } catch (err) {
        alert(`Slack test failed: ${err.message}`);
      } finally {
        setTestingSlack(false);
      }
    } else if (type === "telegram") {
      setTestingTelegram(true);
      try {
        await api.instances.testSettings({
          integration_type: "telegram",
          telegram_bot_token: telegramBotToken,
          telegram_chat_id: telegramChatId
        });
        alert("Telegram test message sent successfully!");
      } catch (err) {
        alert(`Telegram test failed: ${err.message}`);
      } finally {
        setTestingTelegram(false);
      }
    }
  };

  const renderHelpModal = () => {
    if (!activeHelpModal) return null;
    const isSlack = activeHelpModal === "slack";

    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl border border-brand-soft/35 shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-brand-soft/20 pb-3">
            <h3 className="text-base font-bold text-brand-teal flex items-center gap-2">
              {isSlack ? "Slack Setup Guide 💬" : "Telegram Setup Guide 🤖"}
            </h3>
            <button
              type="button"
              onClick={() => setActiveHelpModal(null)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="text-xs text-slate-600 space-y-3 leading-relaxed max-h-[350px] overflow-y-auto pr-1">
            {isSlack ? (
              <>
                <p>Follow these steps to create an Incoming Webhook for Slack:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Go to the <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-brand-teal font-semibold underline hover:text-brand-teal/80">Slack API Console</a>.</li>
                  <li>Click <strong>Create New App</strong> (from scratch) and name it (e.g. <code>CloudNap</code>).</li>
                  <li>Under <strong>Features</strong> in the sidebar, select <strong>Incoming Webhooks</strong>.</li>
                  <li>Toggle <strong>Activate Incoming Webhooks</strong> to <strong>On</strong>.</li>
                  <li>Scroll down and click <strong>Add New Webhook to Workspace</strong>.</li>
                  <li>Choose the default channel to post to and click <strong>Allow</strong>.</li>
                  <li>Copy the generated webhook URL and paste it into CloudNap.</li>
                </ol>
                <p className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2 text-slate-500">
                  💡 <strong>Tip:</strong> If you want to post to different channels dynamically, configure the Slack Channel override input field in CloudNap.
                </p>
              </>
            ) : (
              <>
                <p>Follow these steps to configure a Telegram bot notification channel:</p>
                <h4 className="font-bold text-slate-700 mt-2">1. Get your Bot Token:</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Search for <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-brand-teal font-semibold underline hover:text-brand-teal/80">@BotFather</a> on Telegram and start a chat.</li>
                  <li>Send <code>/newbot</code> and follow instructions to set a name and username.</li>
                  <li>Copy the HTTP API <strong>Bot Token</strong> provided (e.g. <code>123456:ABC...</code>).</li>
                </ol>

                <h4 className="font-bold text-slate-700 mt-2">2. Get your Chat ID / Group ID:</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create a new Group or Channel in Telegram.</li>
                  <li>Add your bot as an <strong>Administrator</strong>.</li>
                  <li>If public, your Chat ID is <code>@your_channel_name</code>.</li>
                  <li>If private, send a test message in the group, then forward it to <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-brand-teal font-semibold underline hover:text-brand-teal/80">@userinfobot</a> or <a href="https://t.me/GetIdsBot" target="_blank" rel="noreferrer" className="text-brand-teal font-semibold underline hover:text-brand-teal/80">@GetIdsBot</a> to retrieve the group's ID (which starts with <code>-100</code>).</li>
                </ol>
              </>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-brand-soft/20">
            <button
              type="button"
              onClick={() => setActiveHelpModal(null)}
              className="bg-brand-teal hover:bg-brand-teal/90 text-white px-5 py-2 rounded-xl text-xs font-semibold transition"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  };

  const fetchSettings = async () => {
    try {
      const res = await api.instances.getSettings();
      res.forEach(item => {
        if (item.key === "slack_enabled") setSlackEnabled(item.value === "true");
        if (item.key === "slack_webhook_url") setSlackWebhookUrl(item.value || "");
        if (item.key === "slack_channel") setSlackChannel(item.value || "");
        if (item.key === "telegram_enabled") setTelegramEnabled(item.value === "true");
        if (item.key === "telegram_bot_token") setTelegramBotToken(item.value || "");
        if (item.key === "telegram_chat_id") setTelegramChatId(item.value || "");
      });
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    const payload = [
      { key: "slack_enabled", value: String(slackEnabled) },
      { key: "slack_webhook_url", value: slackWebhookUrl },
      { key: "slack_channel", value: slackChannel },
      { key: "telegram_enabled", value: String(telegramEnabled) },
      { key: "telegram_bot_token", value: telegramBotToken },
      { key: "telegram_chat_id", value: telegramChatId }
    ];
    try {
      await api.instances.saveSettings(payload);
      alert("Settings saved successfully.");
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchAccounts = async () => {
    setAccountsLoading(true);
    try {
      const data = await api.instances.listAccounts();
      setAccounts(data || []);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setAccountsLoading(false);
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: accountName,
        role_arn: accountRoleArn || null,
        access_key_id: accountAccessKeyId || null,
        secret_access_key: accountSecretAccessKey || null,
        external_id: accountExternalId || null,
        is_active: accountIsActive
      };
      await api.instances.saveAccount(payload);
      setAccountModalOpen(false);
      setAccountName("");
      setAccountRoleArn("");
      setAccountAccessKeyId("");
      setAccountSecretAccessKey("");
      setAccountExternalId("");
      setAccountIsActive(true);
      setSelectedAccountId(null);
      fetchAccounts();
      fetchData();
    } catch (err) {
      alert(err.message || "Failed to save account");
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!window.confirm("Are you sure you want to delete this AWS Account? All synced resources under it will be deleted too.")) return;
    try {
      await api.instances.deleteAccount(id);
      fetchAccounts();
      fetchData();
    } catch (err) {
      alert(err.message || "Failed to delete account");
    }
  };

  const handleTestAccountConnection = async (id) => {
    setTestingConnectionId(id);
    try {
      const res = await api.instances.testAccountConnection(id);
      setConnectionTestResults(prev => ({
        ...prev,
        [id]: res
      }));
    } catch (err) {
      setConnectionTestResults(prev => ({
        ...prev,
        [id]: { status: "error", message: err.message }
      }));
    } finally {
      setTestingConnectionId(null);
    }
  };

  useEffect(() => {
    if (activeTab === "settings") {
      fetchSettings();
    } else if (activeTab === "accounts") {
      fetchAccounts();
    }
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, regionFilter, typeFilter, accountFilter]);

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


  // Apply dark mode theme and persist preference
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("cloudnap-theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  // Fetch data if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      fetchAccounts();
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
      const [instList, logList] = await Promise.all([
        api.instances.list(),
        api.instances.logs()
      ]);
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
      }
      setInstances(instList);
      setLogs(logList || []);
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
    const payload = {
      schedule_type: schedType
    };

    if (schedType === "ONCE") {
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

      payload.start_time = startUTC.toISOString();
      payload.end_time = endUTC.toISOString();

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
    } else {
      const timeValS = parseTimeString(newSleepStartTimeStr);
      const timeValE = parseTimeString(newSleepEndTimeStr);

      const pad = (n) => String(n).padStart(2, '0');
      payload.time_start = `${pad(timeValS.h)}:${pad(timeValS.m)}`;
      payload.time_end = `${pad(timeValE.h)}:${pad(timeValE.m)}`;

      if (schedType === "WEEKLY") {
        const days = Object.keys(selectedDays).filter(k => selectedDays[k]).join(",");
        if (!days) {
          alert("Please select at least one active day for weekly schedule.");
          return;
        }
        payload.days_of_week = days;
      }

      if (!confirm(`Are you sure you want to add a recurring ${schedType.toLowerCase()} sleep window for ${instanceName}?\nWindow: ${payload.time_start} - ${payload.time_end} UTC`)) {
        return;
      }
    }

    try {
      await api.instances.addSchedule(instanceId, payload);
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
            <div key={w} className="text-brand-slate font-semibold py-1">{w}</div>
          ))}
          {slots.map((d, index) => {
            if (d === null) return <div key={`blank-${index}`} className="py-1.5" />;
            
            const cellDate = new Date(yr, mo, d);
            const cellTime = cellDate.getTime();
            
            const today = new Date();
            const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const isToday = cellTime === todayMs;

            let cellStyle = "text-slate-700 hover:bg-slate-100 hover:text-white rounded-lg cursor-pointer";
            if (isToday) {
              cellStyle = "text-brand-teal font-bold border border-brand-teal/40 rounded-lg hover:bg-slate-100 cursor-pointer";
            }
            if (startMs && cellTime === startMs) {
              cellStyle = "bg-brand-teal text-white font-bold rounded-lg border border-brand-teal shadow-md cursor-pointer";
            } else if (endMs && cellTime === endMs) {
              cellStyle = "bg-brand-teal text-white font-bold rounded-lg border border-brand-teal shadow-md cursor-pointer";
            } else if (startMs && endMs && cellTime > startMs && cellTime < endMs) {
              cellStyle = "bg-brand-teal/10 text-brand-teal font-semibold rounded-none cursor-pointer";
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
      <div className="bg-white border border-brand-soft/30 shadow-sm p-4 rounded-xl space-y-4">
        {/* Calendar Header with Navigation Chevrons */}
        <div className="flex justify-between items-center px-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 bg-slate-100 border border-brand-soft/30 hover:border-brand-soft/40 text-slate-500 hover:text-white rounded-lg transition"
          >
            &lt;
          </button>
          
          <div className="flex justify-around flex-1 text-xs font-semibold text-slate-700">
            <span>{months[leftMonth]} {leftYear}</span>
            <span>{months[rightMonth]} {rightYear}</span>
          </div>

          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 bg-slate-100 border border-brand-soft/30 hover:border-brand-soft/40 text-slate-500 hover:text-white rounded-lg transition"
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

    const totalDollarsSaved = instances.reduce((acc, i) => acc + (i.total_dollars_saved || 0), 0);
    const totalHoursSaved = instances.reduce((acc, i) => acc + (i.total_hours_saved || 0), 0);
    const activeSavingsRate = instances
      .filter(i => i.status === "stopped")
      .reduce((acc, i) => {
        const rate = i.custom_cost_per_hour !== null && i.custom_cost_per_hour !== undefined 
          ? i.custom_cost_per_hour 
          : (i.cost_per_hour || 0);
        return acc + rate;
      }, 0);

    return {
      totalInstances,
      runningInstances,
      sleepingInstances,
      scheduledInstances,
      activeOverrides,
      totalDollarsSaved,
      totalHoursSaved,
      activeSavingsRate
    };
  };

  const metrics = calculateMetrics();

  // Filters logic
  const filteredInstances = instances.filter(inst => {
    const matchesSearch = inst.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inst.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = regionFilter === "all" || inst.region === regionFilter;
    const matchesType = typeFilter === "all" || inst.type === typeFilter;
    const matchesAccount = accountFilter === "all" || 
                           (accountFilter === "none" && !inst.aws_account) ||
                           (inst.aws_account && String(inst.aws_account.id) === accountFilter);
    return matchesSearch && matchesRegion && matchesType && matchesAccount;
  });

  const totalPages = Math.ceil(filteredInstances.length / itemsPerPage);
  const paginatedInstances = filteredInstances.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Extract unique regions for filters
  const uniqueRegions = Array.from(new Set(instances.map(i => i.region)));

  // View: Login Page
  if (!isAuthenticated && authRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel w-full max-w-md p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-teal via-brand-slate to-brand-soft"></div>
          <div className="flex flex-col items-center mb-8">
            <img src="/favicon.svg" alt="CloudNap Logo" className="h-16 w-16 mb-4 rounded-2xl shadow-lg shadow-brand-teal/20" />
            <h1 className="text-3xl font-bold tracking-tight text-brand-teal">CloudNap</h1>
            <p className="text-slate-500 text-sm mt-1">AWS Instance Scheduler</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="glass-input w-full px-4 py-3 rounded-xl pr-10 text-white placeholder-zinc-500"
                  placeholder="Enter access password"
                  required
                />
                <Lock className="absolute right-3 top-3.5 h-5 w-5 text-brand-slate" />
              </div>
              {authError && <p className="text-red-400 text-xs mt-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {authError}</p>}
            </div>
            
            <button
              type="submit"
              className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white font-medium py-3 rounded-xl transition duration-200 shadow-lg shadow-blue-500/20"
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
            className="flex items-center gap-2 text-slate-500 hover:text-white text-sm font-semibold transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Resources
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-800 border border-brand-soft/40 px-4 py-2.5 rounded-xl border border-brand-soft/40 transition"
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
                inst.type === "ec2" ? "bg-blue-500/10 text-brand-teal" : "bg-purple-500/10 text-purple-400"
              }`}>
                {inst.type === "ec2" ? <Server className="h-3 w-3" /> : <Database className="h-3 w-3" />}
                {inst.type.toUpperCase()}
              </span>
              <h2 className="text-2xl font-bold text-slate-800">{inst.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold select-all">
                  {inst.instance_type}
                </span>
                <span className="text-slate-500 text-xs font-semibold">
                  • ${(inst.custom_cost_per_hour !== null && inst.custom_cost_per_hour !== undefined ? inst.custom_cost_per_hour : inst.cost_per_hour || 0.05).toFixed(4)}/hr
                </span>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0 select-none">
                  Saved: ${(inst.total_dollars_saved || 0).toFixed(2)}
                </span>
              </div>
              <p className="text-brand-slate text-xs font-mono mt-2">
                {inst.id} • {inst.region} {inst.aws_account && `• ${inst.aws_account.name}`}
              </p>
            </div>
            
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 mb-2">
                <span className={`h-2.5 w-2.5 rounded-full ${
                  inst.status === "running" ? "bg-emerald-500 shadow-md shadow-emerald-500/50" :
                  inst.status === "stopped" ? "bg-zinc-600" : "bg-yellow-500 animate-pulse"
                }`}></span>
                <span className={`text-sm font-bold capitalize ${
                  inst.status === "running" ? "text-emerald-400" :
                  inst.status === "stopped" ? "text-slate-500" : "text-yellow-400"
                }`}>{inst.status}</span>
              </div>
            </div>
          </div>

          {/* Quick manual overrides inside the detail view */}
          <div className="pt-4 border-t border-brand-soft/20">
            <span className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider mb-3">Manual Override controls</span>
            {inst.override ? (
              <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between gap-4">
                <div className="text-xs">
                  <span className="text-amber-700 font-semibold block mb-0.5">
                    {inst.override.override_type === "START" ? "Manually Started" : "Manually Stopped"}
                  </span>
                  <span className="text-brand-slate text-[10px]">Auto-schedule is paused while manual override is active</span>
                </div>
                <button
                  onClick={() => handleCancelOverride(inst.id)}
                  className="text-xs bg-brand-teal hover:bg-brand-teal/90 text-white font-semibold px-4 py-2 rounded-lg transition"
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
            <h3 className="text-lg font-bold text-brand-teal">Sleep Schedules</h3>
            
            {sortedSchedules.length === 0 ? (
              <p className="text-brand-slate text-sm italic py-4">Running 24/7 (No sleep schedules registered)</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {sortedSchedules.map(win => {
                  const parseUTC = (str) => {
                    if (!str) return new Date();
                    return new Date(str.endsWith("Z") ? str : str + "Z");
                  };
                  
                  const isRecurring = win.schedule_type === "DAILY" || win.schedule_type === "WEEKLY";

                  let statusText = "Scheduled";
                  let statusColor = "bg-blue-50 text-blue-800 border border-blue-200";

                  if (!isRecurring) {
                    const startDt = parseUTC(win.start_time);
                    const endDt = parseUTC(win.end_time);
                    const nowDt = new Date();
                    if (nowDt >= endDt) {
                      statusText = "Expired";
                      statusColor = "bg-slate-100 text-slate-700 border border-slate-300";
                    } else if (nowDt >= startDt && nowDt < endDt) {
                      statusText = "Sleeping";
                      statusColor = "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse";
                    }
                  } else {
                    statusText = win.schedule_type === "DAILY" ? "Daily" : "Weekly";
                    statusColor = "bg-purple-50 text-purple-800 border border-purple-200";
                  }

                  const formatUTC = (d) => {
                    try {
                      return d.toISOString().replace("T", " ").substring(0, 16) + " UTC";
                    } catch (e) {
                      return "Invalid Date";
                    }
                  };

                  return (
                    <div key={win.id} className="flex justify-between items-center text-xs bg-slate-50 border border-brand-soft/20 p-3.5 rounded-xl">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-slate-750 block truncate text-sm">
                          {isRecurring ? `${win.schedule_type.charAt(0) + win.schedule_type.slice(1).toLowerCase()} Sleep Plan` : "Sleep Duration"}
                        </span>
                        {!isRecurring ? (
                          <>
                            <span className="text-brand-slate font-mono text-[11px] block mt-1">
                              OFF: {formatUTC(parseUTC(win.start_time))}
                            </span>
                            <span className="text-brand-slate font-mono text-[11px] block">
                              ON:  {formatUTC(parseUTC(win.end_time))}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-brand-slate font-mono text-[11px] block mt-1">
                              Window: {win.time_start} - {win.time_end} UTC
                            </span>
                            {win.schedule_type === "WEEKLY" && (
                              <span className="text-brand-slate font-mono text-[10px] block text-slate-500 mt-0.5">
                                Days: {(() => {
                                  const weekdayNames = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun" };
                                  return (win.days_of_week || "")
                                    .split(",")
                                    .map(d => weekdayNames[d.trim()] || d)
                                    .join(", ");
                                })()}
                              </span>
                            )}
                          </>
                        )}
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

          {/* Right panel: Add Sleep Window / Lease Expiry */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-brand-teal">
                {schedType === "LEASE" ? "Lease Expiry (TTL)" : "Define Sleep Window"}
              </h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                schedType === "LEASE" 
                  ? "text-emerald-800 bg-emerald-100 border-emerald-300"
                  : "text-amber-800 bg-amber-100 border-amber-300"
              }`}>
                {schedType === "LEASE" ? "Temporary Lease" : "Offline/Sleep Plan"}
              </span>
            </div>
            
            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-brand-soft/30">
              {schedType === "LEASE" ? (
                <>
                  ℹ️ <strong className="text-brand-teal">Temporary Lease (TTL):</strong> Set a specific UTC date/time when this resource should be permanently turned off. Once expired, the scheduler will keep the resource stopped and ignore active schedules/holds.
                </>
              ) : (
                <>
                  ℹ️ <strong className="text-brand-teal">Sleep Duration:</strong> The resource will be stopped during the sleep window, and will run normally outside of it.
                </>
              )}
            </p>

            {/* Schedule Type / Lease Selection Tabs */}
            <div className="space-y-1.5">
              <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Configuration Type</label>
              <div className="flex flex-wrap gap-2">
                {["ONCE", "DAILY", "WEEKLY", "LEASE"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSchedType(t)}
                    className={`flex-1 min-w-[70px] py-2 text-xs font-semibold rounded-xl border transition ${
                      schedType === t 
                        ? "bg-brand-teal text-white border-brand-teal" 
                        : "bg-white text-slate-700 border-brand-soft/40 hover:bg-slate-50"
                    }`}
                  >
                    {t === "ONCE" ? "One-time" : t === "DAILY" ? "Daily" : t === "WEEKLY" ? "Weekly" : "Lease Expiry"}
                  </button>
                ))}
              </div>
            </div>

            {schedType === "LEASE" ? (
              // LEASE CONFIGURATION TAB
              <div className="space-y-4">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-brand-soft/20 text-xs">
                  <span className="font-semibold text-slate-700 block text-[11px]">Current Expiry Status</span>
                  {inst.expiry_date ? (
                    <div className="mt-1.5 space-y-1">
                      <span className="text-red-800 font-mono font-semibold block">
                        🛑 EXPIRES: {new Date(inst.expiry_date + "Z").toISOString().replace("T", " ").substring(0, 16)} UTC
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {new Date() > new Date(inst.expiry_date + "Z") 
                          ? "⚠️ Lease has expired! The resource is locked in STOPPED state." 
                          : `Active (Expires in ${Math.round((new Date(inst.expiry_date + "Z") - new Date()) / (1000 * 60 * 60 * 24))} days)`}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-500 italic block mt-1 text-[11px]">No lease expiry set (Runs indefinitely)</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Expiry Date</label>
                    <input
                      type="text"
                      placeholder="YYYY/MM/DD"
                      value={newExpiryDateStr}
                      onChange={(e) => setNewExpiryDateStr(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Expiry Time (UTC)</label>
                    <input
                      type="text"
                      placeholder="HH:MM"
                      value={newExpiryTimeStr}
                      onChange={(e) => setNewExpiryTimeStr(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    disabled={expirySaving}
                    onClick={() => handleSetExpiry(inst.id, inst.name)}
                    className="flex-1 bg-brand-teal hover:bg-brand-teal/90 text-white py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {expirySaving ? "Saving..." : "Set Expiry Date"}
                  </button>
                  {inst.expiry_date && (
                    <button
                      type="button"
                      disabled={expirySaving}
                      onClick={async () => {
                        if (expirySaving) return;
                        setNewExpiryDateStr("");
                        setExpirySaving(true);
                        try {
                          await api.instances.setExpiry(inst.id, null);
                          fetchData();
                        } catch (err) {
                          alert(`Failed to clear lease: ${err.message}`);
                        } finally {
                          setExpirySaving(false);
                        }
                      }}
                      className="px-4 border border-red-500 text-red-500 hover:bg-red-50 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                    >
                      Clear Lease
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // SLEEP WINDOW CONFIGURATION TABS
              <div className="space-y-4">
                {schedType === "WEEKLY" && (
                  <div className="space-y-1.5">
                    <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Active Days</label>
                    <div className="grid grid-cols-7 gap-1.5 text-center">
                      {[
                        { id: 1, label: "M" },
                        { id: 2, label: "T" },
                        { id: 3, label: "W" },
                        { id: 4, label: "T" },
                        { id: 5, label: "F" },
                        { id: 6, label: "S" },
                        { id: 7, label: "S" },
                      ].map((day) => (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => setSelectedDays(prev => ({ ...prev, [day.id]: !prev[day.id] }))}
                          className={`py-2 text-xs font-semibold rounded-lg border transition ${
                            selectedDays[day.id]
                              ? "bg-brand-teal text-white border-brand-teal"
                              : "bg-white text-slate-700 border-brand-soft/40 hover:bg-slate-50"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {schedType === "ONCE" && renderCalendar()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">
                      {schedType === "ONCE" ? "Turn OFF date & time" : "Turn OFF time"}
                    </label>
                    {schedType === "ONCE" && (
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
                        className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 font-mono"
                      />
                    )}
                    <input
                      type="text"
                      placeholder="HH:MM"
                      value={newSleepStartTimeStr}
                      onChange={(e) => setNewSleepStartTimeStr(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 font-mono"
                    />
                    {schedType === "ONCE" && newSleepStartStr && (
                      <span className="block text-[9px] text-brand-slate font-mono">
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
                    <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">
                      {schedType === "ONCE" ? "Turn ON date & time" : "Turn ON time"}
                    </label>
                    {schedType === "ONCE" && (
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
                        className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 font-mono"
                      />
                    )}
                    <input
                      type="text"
                      placeholder="HH:MM"
                      value={newSleepEndTimeStr}
                      onChange={(e) => setNewSleepEndTimeStr(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 font-mono"
                    />
                    {schedType === "ONCE" && newSleepEndStr && (
                      <span className="block text-[9px] text-brand-slate font-mono">
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
                {schedType === "ONCE" && <p className="text-[10px] text-brand-slate">For date, use YYYY/MM/DD.</p>}

                <button
                  type="button"
                  onClick={() => handleAddWindow(inst.id, inst.name)}
                  className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white py-2.5 rounded-xl text-xs font-semibold transition"
                >
                  Save Sleep Window
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 glass-panel md:min-h-screen flex flex-col border-r border-brand-soft/30">
        <div className="p-6 flex items-center gap-3 border-b border-brand-soft/30 animate-fadeIn">
          <img src="/favicon.svg" alt="CloudNap Logo" className="h-9 w-9 rounded-xl shadow-lg shadow-brand-teal/20" />
          <div>
            <h1 className="font-bold text-lg leading-tight text-slate-800">CloudNap</h1>
            <p className="text-brand-slate text-xs font-mono">SELF-HOSTED</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => {
              setActiveTab("dashboard");
              setSelectedInstanceId(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-150 ${activeTab === "dashboard" ? "bg-blue-600/20 text-brand-teal border border-brand-teal/20 font-medium" : "text-slate-500 hover:text-zinc-200 hover:bg-slate-100"}`}
          >
            <Activity className="h-5 w-5" />
            Dashboard
          </button>
          <button
            onClick={() => {
              setActiveTab("instances");
              setSelectedInstanceId(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-150 ${activeTab === "instances" ? "bg-blue-600/20 text-brand-teal border border-brand-teal/20 font-medium" : "text-slate-500 hover:text-zinc-200 hover:bg-slate-100"}`}
          >
            <Server className="h-5 w-5" />
            Instances
          </button>
          <button
            onClick={() => {
              setActiveTab("accounts");
              setSelectedInstanceId(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-150 ${activeTab === "accounts" ? "bg-blue-600/20 text-brand-teal border border-brand-teal/20 font-medium" : "text-slate-500 hover:text-zinc-200 hover:bg-slate-100"}`}
          >
            <Globe className="h-5 w-5" />
            AWS Accounts
          </button>
          <button
            onClick={() => {
              setActiveTab("settings");
              setSelectedInstanceId(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-150 ${activeTab === "settings" ? "bg-blue-600/20 text-brand-teal border border-brand-teal/20 font-medium" : "text-slate-500 hover:text-zinc-200 hover:bg-slate-100"}`}
          >
            <Settings className="h-5 w-5" />
            Settings
          </button>
        </nav>

        <div className="p-4 space-y-1">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(prev => !prev)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition duration-150 text-slate-500 hover:text-zinc-200 hover:bg-slate-100"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        {authRequired && (
          <div className="p-4 border-t border-brand-soft/30">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-500 hover:text-zinc-200 hover:bg-red-500/10 hover:text-red-400 transition duration-150"
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
            <h2 className="text-3xl font-bold text-brand-teal capitalize">{activeTab}</h2>
            <p className="text-slate-500 text-sm mt-1">Manage AWS compute and database schedules to sleep cost overheads.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="glass-panel px-4 py-2.5 rounded-xl border border-brand-soft/30 flex items-center gap-2 text-sm font-mono text-brand-teal shadow-lg shadow-brand-teal/5 select-none shrink-0">
              <Clock className="h-4 w-4 animate-pulse shrink-0" />
              <span>{utcTime}</span>
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-800 border border-brand-soft/40 px-4 py-2.5 rounded-xl border border-brand-soft/40 transition shrink-0"
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
          <div className="space-y-6">
            {/* Cost Savings Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-2xl border-l-4 border-emerald-500 relative overflow-hidden bg-gradient-to-r from-emerald-500/5 to-transparent">
                <div className="flex justify-between items-start mb-4">
                  <span className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600">
                    <DollarSign className="h-6 w-6" />
                  </span>
                  <div className="flex items-center gap-1.5 select-none">
                    <span className="text-xs font-mono text-emerald-600 font-bold">TOTAL SAVINGS</span>
                    <button
                      onClick={() => setSavingsModalType("total")}
                      className="text-emerald-600/70 hover:text-emerald-600 transition"
                      title="Learn how Total Savings is calculated"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="text-4xl font-extrabold text-slate-800">${metrics.totalDollarsSaved.toFixed(2)}</h3>
                <p className="text-slate-500 text-sm mt-1">Accumulated savings across {metrics.totalHoursSaved.toFixed(1)} sleeping hours</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl border-l-4 border-brand-teal relative overflow-hidden bg-gradient-to-r from-brand-teal/5 to-transparent">
                <div className="flex justify-between items-start mb-4">
                  <span className="p-3 bg-brand-teal/10 rounded-xl text-brand-teal">
                    <TrendingUp className="h-6 w-6" />
                  </span>
                  <div className="flex items-center gap-1.5 select-none">
                    <span className="text-xs font-mono text-brand-teal font-bold">SAVINGS RATE</span>
                    <button
                      onClick={() => setSavingsModalType("rate")}
                      className="text-brand-teal/70 hover:text-brand-teal transition"
                      title="Learn how Savings Rate is calculated"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="text-4xl font-extrabold text-slate-800">${metrics.activeSavingsRate.toFixed(2)} <span className="text-lg font-normal text-slate-500">/ hr</span></h3>
                <p className="text-slate-500 text-sm mt-1">Real-time savings from currently stopped instances</p>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex justify-between items-start mb-4">
                  <span className="p-3 bg-blue-500/10 rounded-xl text-brand-teal">
                    <Server className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-mono text-brand-slate">MANAGED</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">{metrics.totalInstances}</h3>
                <p className="text-slate-500 text-sm mt-1">Total AWS Resources</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex justify-between items-start mb-4">
                  <span className="p-3 bg-brand-teal/10 rounded-xl text-brand-teal">
                    <Clock className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-mono text-purple-500">SCHEDULED</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">{metrics.scheduledInstances}</h3>
                <p className="text-slate-500 text-sm mt-1">Automation active</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex justify-between items-start mb-4">
                  <span className="p-3 bg-amber-500/10 rounded-xl text-amber-600">
                    <AlertTriangle className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-mono text-amber-500">OVERRIDES</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">{metrics.activeOverrides}</h3>
                <p className="text-slate-500 text-sm mt-1">Manual holds active</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex justify-between items-start mb-4">
                  <span className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600">
                    <Moon className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-mono text-emerald-500">SLEEPING</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">{metrics.sleepingInstances} / {metrics.totalInstances}</h3>
                <p className="text-slate-500 text-sm mt-1">Stopped (Inactive)</p>
              </div>
            </div>

            {/* Logs & Audit Trail */}
            <div className="glass-panel p-6 rounded-2xl space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-brand-teal flex items-center gap-2">
                    <Clock className="h-5 w-5 text-brand-teal" />
                    System Logs & Audit Trail
                  </h3>
                  <p className="text-brand-slate text-xs mt-1">Audit log of system actions and user schedule operations</p>
                </div>
                
                {/* Search Logs */}
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    placeholder="Search logs by resource, action, message..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="glass-input w-full px-4 py-2 pl-10 rounded-xl text-white placeholder-zinc-500 text-xs"
                  />
                  <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-brand-slate" />
                  {logSearchQuery && (
                    <button 
                      onClick={() => setLogSearchQuery("")}
                      className="absolute right-3 top-3 text-brand-slate hover:text-slate-700 animate-fadeIn"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Logs list */}
              {(() => {
                const filteredLogs = logs.filter(log => {
                  const query = logSearchQuery.toLowerCase();
                  return (
                    (log.message || "").toLowerCase().includes(query) ||
                    (log.resource_name || "").toLowerCase().includes(query) ||
                    (log.resource_id || "").toLowerCase().includes(query) ||
                    (log.action || "").toLowerCase().includes(query)
                  );
                });

                if (filteredLogs.length === 0) {
                  return (
                    <div className="text-center py-8 border border-dashed border-brand-soft/20 rounded-xl bg-slate-100">
                      <p className="text-brand-slate text-xs italic">No logs found matching criteria.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {filteredLogs.map((log) => {
                      const logDate = new Date(log.timestamp.endsWith("Z") ? log.timestamp : log.timestamp + "Z");
                      const formattedTime = logDate.toISOString().replace("T", " ").substring(0, 19) + " UTC";
                      
                      // Different actions -> different styles
                      let actionBadge = "bg-slate-100 text-slate-800 border border-slate-300";
                      if (log.action.includes("SCHEDULE")) {
                        actionBadge = "bg-blue-50 text-blue-800 border border-blue-200";
                      } else if (log.action.includes("OVERRIDE")) {
                        actionBadge = "bg-amber-50 text-amber-800 border border-amber-200";
                      } else if (log.action === "SYSTEM_START" || log.action === "SYSTEM_STOP") {
                        actionBadge = log.action === "SYSTEM_START" 
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-red-50 text-red-800 border border-red-200";
                      }

                      return (
                        <div 
                          key={log.id} 
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50 hover:bg-slate-100/60 border border-brand-soft/30 p-3.5 rounded-xl transition duration-150"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border ${actionBadge}`}>
                                {log.action}
                              </span>
                              {log.resource_name && (
                                <button
                                  onClick={() => {
                                    if (log.resource_id) {
                                      setSelectedInstanceId(log.resource_id);
                                      setAddingWindowForInstanceId(log.resource_id);
                                      setActiveTab("instances");
                                    }
                                  }}
                                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2 py-0.5 rounded-md border border-brand-soft/30 transition flex items-center gap-1"
                                  title={`Click to view ${log.resource_name}`}
                                >
                                  🏷️ {log.resource_name}
                                </button>
                              )}
                              <span className="text-[10px] text-brand-slate font-mono">{formattedTime}</span>
                            </div>
                            <p className="text-slate-700 text-xs leading-relaxed">{log.message}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
                    <Search className="absolute left-3 top-3 h-4 w-4 text-brand-slate" />
                  </div>

                  <div className="flex flex-wrap gap-4 w-full md:w-auto">
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="glass-input px-4 py-2.5 rounded-xl text-sm bg-white text-slate-800 border border-brand-soft/40 min-w-[120px]"
                    >
                      <option value="all">All Types</option>
                      <option value="ec2">EC2 Instances</option>
                      <option value="rds">RDS Databases</option>
                    </select>

                    <select
                      value={regionFilter}
                      onChange={(e) => setRegionFilter(e.target.value)}
                      className="glass-input px-4 py-2.5 rounded-xl text-sm bg-white text-slate-800 border border-brand-soft/40 min-w-[140px]"
                    >
                      <option value="all">All Regions</option>
                      {uniqueRegions.map(reg => (
                        <option key={reg} value={reg}>{reg}</option>
                      ))}
                    </select>

                    <select
                      value={accountFilter}
                      onChange={(e) => setAccountFilter(e.target.value)}
                      className="glass-input px-4 py-2.5 rounded-xl text-sm bg-white text-slate-800 border border-brand-soft/40 min-w-[140px]"
                    >
                      <option value="all">All Accounts</option>
                      <option value="none">Default Host</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={String(acc.id)}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grid of Instances */}
                {filteredInstances.length === 0 ? (
                  <div className="glass-panel p-12 rounded-2xl text-center">
                    <p className="text-brand-slate">No resources found matching current criteria.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedInstances.map(inst => {
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
                                inst.type === "ec2" ? "bg-blue-500/10 text-brand-teal" : "bg-purple-500/10 text-purple-400"
                              }`}>
                                {inst.type === "ec2" ? <Server className="h-3 w-3" /> : <Database className="h-3 w-3" />}
                                {inst.type.toUpperCase()}
                              </span>
                              
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-mono text-brand-slate">{inst.region}</span>
                                {inst.aws_account && (
                                  <span className="text-[9px] font-bold bg-blue-500/10 text-brand-teal px-1.5 py-0.5 rounded mt-0.5 select-none">
                                    {inst.aws_account.name}
                                  </span>
                                )}
                              </div>
                            </div>

                            <h4 className="font-bold text-slate-800 text-lg truncate mb-1" title={inst.name}>{inst.name}</h4>
                            
                            <div className="flex justify-between items-center mb-2">
                              <span className="bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold select-all shrink-0">
                                {inst.instance_type}
                              </span>
                              <p className="text-slate-500 text-xs font-semibold select-all shrink-0">
                                ${(inst.custom_cost_per_hour !== null && inst.custom_cost_per_hour !== undefined ? inst.custom_cost_per_hour : inst.cost_per_hour || 0.05).toFixed(4)}/hr
                              </p>
                            </div>

                            <p className="text-brand-slate text-xs font-mono mb-3 truncate">{inst.id}</p>

                            {/* Status badge and savings */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${
                                  inst.status === "running" ? "bg-emerald-500 shadow-md shadow-emerald-500/50" :
                                  inst.status === "stopped" ? "bg-zinc-600" : "bg-yellow-500 animate-pulse"
                                }`}></span>
                                <span className={`text-sm font-semibold capitalize ${
                                  inst.status === "running" ? "text-emerald-400" :
                                  inst.status === "stopped" ? "text-slate-500" : "text-yellow-400"
                                }`}>{inst.status}</span>
                              </div>
                              
                              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0 select-none">
                                Saved: ${(inst.total_dollars_saved || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Bottom section: brief metadata summary */}
                          <div className="mt-4 pt-4 border-t border-brand-soft/20 flex items-center justify-between text-xs text-brand-slate">
                            <span>Schedules status:</span>
                            <span className={`font-semibold ${activeSchedulesCount > 0 ? "text-brand-teal" : "text-slate-500"}`}>
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

                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-4 mt-8 pt-4 border-t border-brand-soft/10">
                    <button
                      disabled={currentPage === 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPage(prev => Math.max(prev - 1, 1));
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 disabled:opacity-50 text-xs font-semibold transition cursor-pointer"
                    >
                      ← Previous
                    </button>
                    <span className="text-xs text-brand-slate font-semibold">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPage(prev => Math.min(prev + 1, totalPages));
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 disabled:opacity-50 text-xs font-semibold transition cursor-pointer"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Notification Settings</h2>
                <p className="text-xs text-brand-slate mt-1">Configure Slack webhooks and Telegram bots to receive real-time scheduling notifications.</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Slack Card */}
              <div className="glass-panel p-6 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-brand-soft/20 pb-3">
                  <h3 className="text-base font-bold text-brand-teal flex items-center gap-1.5">
                    <span>Slack Integration</span>
                    <button
                      type="button"
                      onClick={() => setActiveHelpModal("slack")}
                      className="text-slate-400 hover:text-brand-teal transition p-1 hover:bg-slate-100 rounded-lg"
                      title="Show Setup Guide"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={slackEnabled} 
                      onChange={(e) => setSlackEnabled(e.target.checked)} 
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-teal"></div>
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Incoming Webhook URL</label>
                    <input
                      type="text"
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackWebhookUrl}
                      onChange={(e) => setSlackWebhookUrl(e.target.value)}
                      disabled={!slackEnabled}
                      className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Slack Channel / Thread Override (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. #alerts or C1234567"
                      value={slackChannel}
                      onChange={(e) => setSlackChannel(e.target.value)}
                      disabled={!slackEnabled}
                      className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 disabled:opacity-50"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTestSettings("slack")}
                    disabled={!slackWebhookUrl || testingSlack}
                    className="w-full mt-2 border border-brand-teal text-brand-teal hover:bg-brand-teal/5 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                  >
                    {testingSlack ? "Sending Test Message..." : "⚡ Test Slack Connection"}
                  </button>
                </div>
              </div>

              {/* Telegram Card */}
              <div className="glass-panel p-6 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-brand-soft/20 pb-3">
                  <h3 className="text-base font-bold text-brand-teal flex items-center gap-1.5">
                    <span>Telegram Integration</span>
                    <button
                      type="button"
                      onClick={() => setActiveHelpModal("telegram")}
                      className="text-slate-400 hover:text-brand-teal transition p-1 hover:bg-slate-100 rounded-lg"
                      title="Show Setup Guide"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={telegramEnabled} 
                      onChange={(e) => setTelegramEnabled(e.target.checked)} 
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-teal"></div>
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Bot Token</label>
                    <input
                      type="text"
                      placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      disabled={!telegramEnabled}
                      className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 disabled:opacity-50 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Chat ID / Group ID</label>
                    <input
                      type="text"
                      placeholder="e.g. -100123456789 or 123456789"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      disabled={!telegramEnabled}
                      className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 disabled:opacity-50 font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTestSettings("telegram")}
                    disabled={!telegramBotToken || !telegramChatId || testingTelegram}
                    className="w-full mt-2 border border-brand-teal text-brand-teal hover:bg-brand-teal/5 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                  >
                    {testingTelegram ? "Sending Test Message..." : "⚡ Test Telegram Connection"}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="bg-brand-teal hover:bg-brand-teal/90 text-white px-6 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {savingSettings ? "Saving Settings..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "accounts" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">AWS Accounts</h2>
                <p className="text-xs text-brand-slate mt-1">Connect multiple AWS Accounts using Cross-Account Roles (STS Role Assumption) or encrypted Access Keys.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedAccountId(null);
                  setAccountName("");
                  setAccountRoleArn("");
                  setAccountAccessKeyId("");
                  setAccountSecretAccessKey("");
                  setAccountExternalId("");
                  setAccountIsActive(true);
                  setAccountModalOpen(true);
                }}
                className="bg-brand-teal hover:bg-brand-teal/90 text-white px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                + Add Account
              </button>
            </div>

            {accountsLoading ? (
              <div className="flex justify-center items-center py-20">
                <RefreshCw className="h-8 w-8 text-brand-teal animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-2xl border border-brand-soft/20">
                <Globe className="h-12 w-12 text-brand-slate mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-bold text-slate-700">No external accounts configured</h3>
                <p className="text-sm text-brand-slate mt-1 max-w-md mx-auto">
                  By default, CloudNap manages instances using the container's environment credentials. Add external accounts to schedule resources across other AWS Accounts.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {accounts.map(acc => (
                  <div key={acc.id} className="glass-panel p-6 rounded-2xl space-y-4 relative overflow-hidden border border-brand-soft/25">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{acc.name}</h3>
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded mt-1.5 ${
                          acc.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"
                        }`}>
                          {acc.is_active ? "Active" : "Disabled"}
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedAccountId(acc.id);
                            setAccountName(acc.name);
                            setAccountRoleArn(acc.role_arn || "");
                            setAccountAccessKeyId(acc.access_key_id || "");
                            setAccountSecretAccessKey("");
                            setAccountExternalId(acc.external_id || "");
                            setAccountIsActive(acc.is_active);
                            setAccountModalOpen(true);
                          }}
                          className="text-xs font-semibold text-brand-teal hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="text-xs font-semibold text-red-400 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-brand-slate font-mono">
                      {acc.role_arn ? (
                        <div className="truncate" title={acc.role_arn}>
                          <span className="font-semibold text-slate-600">Role ARN:</span> {acc.role_arn}
                        </div>
                      ) : (
                        <div>
                          <span className="font-semibold text-slate-600">Access Key:</span> {acc.access_key_id}
                        </div>
                      )}
                      {acc.external_id && (
                        <div>
                          <span className="font-semibold text-slate-600">External ID:</span> {acc.external_id}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-brand-soft/10 flex justify-between items-center">
                      <button
                        onClick={() => handleTestAccountConnection(acc.id)}
                        disabled={testingConnectionId !== null}
                        className="text-xs font-bold text-brand-teal hover:text-brand-teal/80 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {testingConnectionId === acc.id ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          "⚡ Test Connection"
                        )}
                      </button>

                      {connectionTestResults[acc.id] && (
                        <div className={`text-xs font-semibold flex items-center gap-1 ${
                          connectionTestResults[acc.id].status === "success" ? "text-emerald-500" : "text-red-400"
                        }`} title={connectionTestResults[acc.id].message}>
                          {connectionTestResults[acc.id].status === "success" ? (
                            <>
                              <CheckCircle className="h-3.5 w-3.5" />
                              Passed
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              Failed
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Account Form Modal */}
            {accountModalOpen && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                <div className="bg-white border border-brand-soft/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 modal-box">
                  <div className="flex justify-between items-center pb-2 border-b border-brand-soft/20">
                    <h3 className="text-lg font-bold text-slate-800">
                      {selectedAccountId ? "Edit AWS Account" : "Add AWS Account"}
                    </h3>
                    <button 
                      onClick={() => setAccountModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveAccount} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Account Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Staging, Production"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        required
                        className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Authentication Type</label>
                      <div className="text-xs text-slate-500 bg-slate-50 dark:bg-zinc-800/40 p-2.5 rounded-lg border border-brand-soft/10 mb-2">
                        Choose <strong>Role Assumption</strong> (ARN) for zero-credential security, or <strong>Access Key</strong> for static credentials.
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Cross-Account Role ARN (STS)</label>
                      <input
                        type="text"
                        placeholder="arn:aws:iam::123456789012:role/CloudNapRole"
                        value={accountRoleArn}
                        onChange={(e) => setAccountRoleArn(e.target.value)}
                        className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">External ID (Optional AssumeRole security)</label>
                      <input
                        type="text"
                        placeholder="e.g. MySecretExternalId"
                        value={accountExternalId}
                        onChange={(e) => setAccountExternalId(e.target.value)}
                        className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 font-mono"
                      />
                    </div>

                    <div className="border-t border-brand-soft/15 pt-3 space-y-3">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Or static credentials (encrypted at rest):</div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Access Key ID</label>
                          <input
                            type="text"
                            placeholder="AKIA..."
                            value={accountAccessKeyId}
                            onChange={(e) => setAccountAccessKeyId(e.target.value)}
                            className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-brand-slate text-[10px] font-semibold uppercase tracking-wider">Secret Access Key</label>
                          <input
                            type="password"
                            placeholder={selectedAccountId ? "••••••••" : "Secret Key"}
                            value={accountSecretAccessKey}
                            onChange={(e) => setAccountSecretAccessKey(e.target.value)}
                            className="glass-input w-full px-3 py-2 rounded-xl text-xs text-slate-800 bg-white border border-brand-soft/40 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <label className="text-xs text-slate-600 font-semibold flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={accountIsActive}
                          onChange={(e) => setAccountIsActive(e.target.checked)}
                          className="rounded text-brand-teal peer"
                        />
                        Enable Account
                      </label>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAccountModalOpen(false)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="bg-brand-teal hover:bg-brand-teal/90 text-white px-5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
        {renderHelpModal()}

        {/* Savings Info Modal */}
        {savingsModalType && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white border border-brand-soft/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 modal-box">
              <div className="flex justify-between items-center pb-2 border-b border-brand-soft/20">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Info className="h-5 w-5 text-brand-teal" />
                  {savingsModalType === "total" ? "About Total Savings" : "About Savings Rate"}
                </h3>
                <button 
                  onClick={() => setSavingsModalType(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {savingsModalType === "total" ? (
                <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                  <p>
                    <strong>Total Savings</strong> is the cumulative sum of money saved since the resource was added.
                  </p>
                  <p>
                    Every minute, the background scheduler checks if a resource is asleep (stopped). If so, it increments the saved duration and calculates the corresponding value:
                  </p>
                  <div className="bg-slate-50 p-3 rounded-xl font-mono text-xs text-brand-teal border border-brand-soft/20">
                    Savings += (1 / 60) * Hourly Cost Rate
                  </div>
                  <p className="text-xs text-slate-500">
                    Note: When a resource is turned back on, the accumulated savings remain preserved so you don't lose track of historical optimization.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                  <p>
                    <strong>Savings Rate</strong> represents your active hourly savings in real-time.
                  </p>
                  <p>
                    It calculates how much less money you are burning per hour right now, based on the sum of hourly costs of all resources currently sleeping:
                  </p>
                  <div className="bg-slate-50 p-3 rounded-xl font-mono text-xs text-brand-teal border border-brand-soft/20">
                    Rate = Sum of Sleeping Resource Rates
                  </div>
                  <p className="text-xs text-slate-500">
                    Note: As resources wake up or schedules change, the Savings Rate updates dynamically in real-time.
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSavingsModalType(null)}
                  className="bg-brand-teal hover:bg-brand-teal/90 text-white px-5 py-2 rounded-xl text-xs font-semibold transition"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
