import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const persistAuth = (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
    localStorage.setItem("user", JSON.stringify(nextUser));
    localStorage.setItem("token", nextToken);
  };

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const register = async (idToken) => {
    const { data } = await api.post("/api/users/register", { idToken });
    persistAuth(data.data.user, data.data.token);
    return data.data.user;
  };

  const login = async (idToken) => {
    const { data } = await api.post("/api/users/login", { idToken });
    persistAuth(data.data.user, data.data.token);
    return data.data.user;
  };

  const setUserProfile = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem("user", JSON.stringify(nextUser));
  };

  const logout = () => {
    clearAuth();
  };

  const refreshProfile = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/api/users/profile");
      setUser(data.data.user);
      localStorage.setItem("user", JSON.stringify(data.data.user));
    } catch (error) {
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, register, login, logout, setUserProfile }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
