import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 
  import.meta.env.DEV 
    ? 'http://127.0.0.1:8000'      // ← LOCAL
    : 'https://app-futebol-minha-pelada-backend.onrender.com';  // ← PROD

const api = axios.create({
  baseURL: API_URL,
});

export default api;