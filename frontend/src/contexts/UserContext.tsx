import { createContext, useState, ReactNode, useEffect, useContext, Fragment, useRef } from "react";
import { authService } from "../services/AuthService";
import { ResponseBody } from "../services/api";

export interface User {
  username: string,
  email: string,
  firstName: string,
  lastName: string,
  admin: boolean
}

interface UserContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<ResponseBody>;
  register: (username: string, email: string, password: string, firstName: string, lastName: string) => Promise<ResponseBody>;
  logout: () => Promise<ResponseBody>;
  refreshUser: () => Promise<ResponseBody | null>;
  updateProfile: (updates: Partial<User>) => Promise<ResponseBody>;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionVersion = useRef(0);
  const changeUser = (next: User | null) => {
    sessionVersion.current++;
    setUser(next);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const version = sessionVersion.current;
    const fetchUser = async () => {
      try {
        const res = await authService.fetchUser();
        if (!cancelled && version === sessionVersion.current && res.success && res.data) {
          console.log(res.data.data);
          setUser(res.data.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled && version === sessionVersion.current) setLoading(false);
      }
    }
    fetchUser();
    return () => { cancelled = true; };
  }, []);

  const register = async (username: string, email: string, password: string, firstName: string, lastName: string): Promise<ResponseBody> => {
    const res = await authService.register(username, email, password, firstName, lastName);
    if (res.success) changeUser(res.data.user);
    return res;
  }

  const login = async (username: string, password: string): Promise<ResponseBody> => {
    const res = await authService.login(username, password);
    if (res.success) changeUser(res.data.user);
    console.log(res.data.user);
    return res;
  };

  const logout = async () => {
    const res = await authService.logout();
    if (res.success) changeUser(null);
    return res;
  };

  const refreshUser = async (): Promise<ResponseBody | null> => {
    const version = sessionVersion.current;
    setLoading(true);
    try {
      const res = await authService.fetchUser();
      if (version === sessionVersion.current && res.success && res.data) {
        const fetched = (res.data as any).data ?? (res.data as any).user ?? res.data;
        setUser(fetched);
      }
      return res;
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      if (version === sessionVersion.current) setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<ResponseBody> => {
    const version = sessionVersion.current;
    const res = await authService.updateProfile(updates);
    if (version === sessionVersion.current && res.success && res.data) {
      const updated = (res.data as any).user ?? (res.data as any).data ?? res.data;
      if (updated) setUser(updated);
    }
    return res;
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        updateProfile,
        loading,
      }}
    >
      {/* Reset account-specific caches and dialogs when authentication changes. */}
      <Fragment key={user?.username ?? "signed-out"}>{children}</Fragment>
    </UserContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useAuth must be used within a UserProvider");
  return context;
}
