import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("bidzone_token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setUser(res.data.user))
      .catch(() => {
        setToken(null);
        localStorage.removeItem("bidzone_token");
      })
      .finally(() => setLoading(false));
  }, [token]);

  function persistAuth({ token: newToken, user: newUser }) {
    localStorage.setItem("bidzone_token", newToken);
    setToken(newToken);
    setUser(newUser);
  }

  async function register(name, email, password) {
    const res = await api.post("/auth/register", { name, email, password });
    persistAuth(res.data);
    return res.data.user;
  }

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    persistAuth(res.data);
    return res.data.user;
  }

  function logout() {
    localStorage.removeItem("bidzone_token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, register, login, logout, isAuthed: !!token }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
