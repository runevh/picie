import { getRequest, postRequest } from "./api"; // Adjust path as needed

export const authService = {
  login: async (username: string, password: string) => {
    return await postRequest("login", { username, password });
  },

  register: async (username: string, email: string, password: string, firstName: string, lastName: string) => {
    return await postRequest("register", { username, email, password, firstName, lastName });
  },

  logout: async () => {
    return await postRequest("logout", {}); // Some backends require an empty body
  },

  fetchUser: async () => {
    return await getRequest("auth");
  },

  updateProfile: async (updates: Record<string, unknown>) => {
    // Endpoint name chosen to be generic; adjust when backend provides one.
    return await postRequest("user/update", updates);
  },

  requestDeletion: async (reason: string | null = null) => {
    return await postRequest("account/delete-request", { reason });
  },

  requestPasswordReset: async (email: string) => {
    return await postRequest("password/reset/request", { email });
  },
};
