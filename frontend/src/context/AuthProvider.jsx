import { useState, useEffect } from "react";
import { AuthContext } from "./AuthContext.js"; // import context
import { setAccessToken, clearAccessToken, getUser } from "../utils/tokenManager.js";
import { startTokenRefresh, stopTokenRefresh } from "../utils/apiClient.js";
import { authApi, } from "../utils/authClient.js";


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const expiresIn = params.get("expiresIn");

      try {
        if (token && expiresIn) {
          setAccessToken(token, parseInt(expiresIn));
          window.history.replaceState({}, "", window.location.pathname);
          startTokenRefresh();
        } else {
          const { data } = await authApi.refresh();
          setAccessToken(data.accessToken, data.expiresIn);
          startTokenRefresh();
        }
        setUser(getUser())
      } catch {
        console.log("Error in auth");
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const logout = async () => {
    stopTokenRefresh();
    await authApi.logout();
    clearAccessToken();
    setUser(null)
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};