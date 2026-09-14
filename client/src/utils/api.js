import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config } = error;
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    
    // Request retry with backoff for network errors
    if (!config || !config.retry) {
      if (config) {
        config.retry = 3;
        config.retryDelay = 1000;
        config.retryCount = 0;
      }
    }
    if (config && (error.message === 'Network Error' || error.code === 'ECONNABORTED' || (error.response && error.response.status >= 500))) {
      if (config.retryCount < config.retry) {
        config.retryCount += 1;
        const delay = config.retryDelay * Math.pow(2, config.retryCount - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(config);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
