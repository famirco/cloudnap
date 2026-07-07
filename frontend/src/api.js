const API_BASE = import.meta.env.DEV ? "http://localhost:8000/api" : "/api";

/**
 * Get the stored auth password.
 */
export function getStoredPassword() {
  return localStorage.getItem("cloudnap_password") || "";
}

/**
 * Store the auth password.
 */
export function setStoredPassword(password) {
  if (password) {
    localStorage.setItem("cloudnap_password", password);
  } else {
    localStorage.removeItem("cloudnap_password");
  }
}

/**
 * Base request handler that injects Bearer authorization and handles standard errors.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const password = getStoredPassword();
  
  const headers = {
    ...options.headers,
  };
  
  if (password) {
    headers["Authorization"] = `Bearer ${password}`;
  }
  
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    // If unauthorized, clear password and trigger redirect/reload to login
    setStoredPassword("");
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }
  
  if (response.status === 204) {
    return null;
  }
  
  return response.json();
}

export const api = {
  auth: {
    getStatus: () => request("/auth/status"),
    login: async (password) => {
      // Validate credentials by calling status with temporary storage override
      localStorage.setItem("cloudnap_password", password);
      try {
        const res = await request("/auth/status");
        if (res.authenticated) {
          return true;
        }
        localStorage.removeItem("cloudnap_password");
        return false;
      } catch (err) {
        localStorage.removeItem("cloudnap_password");
        throw err;
      }
    },
    logout: () => {
      setStoredPassword("");
    }
  },
  
  instances: {
    list: (refresh = false) => request("/instances" + (refresh ? "?refresh=true" : "")),
    logs: () => request("/instances/logs"),
    addSchedule: (id, payload) => request(`/instances/${id}/schedules`, {
      method: "POST",
      body: payload
    }),
    deleteSchedule: (id, scheduleId) => request(`/instances/${id}/schedules/${scheduleId}`, {
      method: "DELETE"
    }),
    setOverride: (id, overrideType) => request(`/instances/${id}/override`, {
      method: "POST",
      body: { override_type: overrideType }
    }),
    deleteOverride: (id) => request(`/instances/${id}/override`, {
      method: "DELETE"
    }),
    getSettings: () => request("/instances/settings"),
    saveSettings: (settingsList) => request("/instances/settings", {
      method: "POST",
      body: { settings: settingsList }
    }),
    testSettings: (payload) => request("/instances/settings/test", {
      method: "POST",
      body: payload
    }),
    setExpiry: (id, expiryDate) => request(`/instances/${id}/expiry`, {
      method: "POST",
      body: { expiry_date: expiryDate }
    }),
    listAccounts: () => request("/instances/accounts"),
    saveAccount: (payload) => request("/instances/accounts", {
      method: "POST",
      body: payload
    }),
    deleteAccount: (id) => request(`/instances/accounts/${id}`, {
      method: "DELETE"
    }),
    testAccountConnection: (id) => request(`/instances/accounts/${id}/test`, {
      method: "POST"
    })
  }
};
