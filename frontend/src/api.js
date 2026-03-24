const API_URL = import.meta.env.VITE_API_URL || 
                "https://app-futebol-minha-pelada-backend.onrender.com";

export default {
  get: (endpoint) => fetch(`${API_URL}${endpoint}`).then(r => r.json()),
  
  post: async (endpoint, data) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST", 
      headers: {"Content-Type": "application/json"}, 
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro servidor');
    }
    return response.json();  // ✅ RETORNA JSON!
  },
  
  put: async (endpoint, data) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "PUT", 
      headers: {"Content-Type": "application/json"}, 
      body: JSON.stringify(data)
    });
    return response.json();
  }
};
