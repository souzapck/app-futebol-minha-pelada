import axios from "axios";

const api = axios.create({
  baseURL: "https://app-futebol-minha-pelada-backend.onrender.com"
});

export default api;