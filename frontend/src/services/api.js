import axios from "axios";

// Base URL comes from Vite env config so it can differ between
// local development and a deployed build without touching code.
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL,
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

export default api;
