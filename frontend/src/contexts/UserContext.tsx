import { createContext, useState, ReactNode, useEffect, useContext } from "react";
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
  logout: () => void;
  refreshUser: () => Promise<ResponseBody | null>;
  updateProfile: (updates: Partial<User>) => Promise<ResponseBody>;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await authService.fetchUser();
        if (res.success && res.data) {
          console.log(res.data.data);
          setUser(res.data.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  const register = async (username: string, email: string, password: string, firstName: string, lastName: string): Promise<ResponseBody> => {
    const res = await authService.register(username, email, password, firstName, lastName);
    if (res.success) setUser(res.data.user);
    return res;
  }

  const login = async (username: string, password: string): Promise<ResponseBody> => {
    const res = await authService.login(username, password);
    if (res.success) setUser(res.data.user);
    console.log(res.data.user);
    return res;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const refreshUser = async (): Promise<ResponseBody | null> => {
    setLoading(true);
    try {
      const res = await authService.fetchUser();
      if (res.success && res.data) {
        const fetched = (res.data as any).data ?? (res.data as any).user ?? res.data;
        setUser(fetched);
      }
      return res;
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<ResponseBody> => {
    const res = await authService.updateProfile(updates);
    if (res.success && res.data) {
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
      {children}
    </UserContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useAuth must be used within a UserProvider");
  return context;
}
