import axios from "axios";


// Base URL comes from Vite env config so it can differ between
// local development and a deployed build without touching code.
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";


const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});


// Attach the JWT automatically so components never have to pass
// Authorization headers by hand.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bidzone_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


// Response interceptor: handle session expiration and normalize network erro
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== "undefined") {
        const hadToken = localStorage.getItem("bidzone_token");
        if (hadToken) {
          localStorage.removeItem("bidzone_token");
          localStorage.removeItem("bidzone_user");
          window.dispatchEvent(new Event("bidzone-auth-expired"));
        }
      }
    }
    return Promise.reject(error);
  }
);


export default api;

