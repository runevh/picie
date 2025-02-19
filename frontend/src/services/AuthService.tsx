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
};
