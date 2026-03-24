const API_URL = import.meta.env.VITE_API_URL || 
                "https://app-futebol-minha-pelada-backend.onrender.com";

export default {
  get: (endpoint) => fetch(`${API_URL}${endpoint}`).then(r => r.json()),
  post: (endpoint, data) => fetch(`${API_URL}${endpoint}`, {
    method: "POST", 
    headers: {"Content-Type": "application/json"}, 
    body: JSON.stringify(data)
  }),
  put: (endpoint, data) => fetch(`${API_URL}${endpoint}`, {
    method: "PUT", 
    headers: {"Content-Type": "application/json"}, 
    body: JSON.stringify(data)
  })
};
