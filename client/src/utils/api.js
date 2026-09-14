import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

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
    const originalRequest = error.config;

    // Handle 401 Unauthorized errors with token refresh
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      const isAuthEndpoint = originalRequest.url && (
        originalRequest.url.includes('/api/auth/login') ||
        originalRequest.url.includes('/api/auth/register') ||
        originalRequest.url.includes('/api/auth/refresh-token')
      );

      if (!isAuthEndpoint) {
        const refreshToken = localStorage.getItem('refreshToken');

        if (refreshToken) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
                return api(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            const baseURL = process.env.REACT_APP_API_URL || '';
            const res = await axios.post(`${baseURL}/api/auth/refresh-token`, {
              refreshToken,
            });

            if (res.data.success && res.data.token) {
              const newAccessToken = res.data.token;
              const newRefreshToken = res.data.refreshToken;

              localStorage.setItem('token', newAccessToken);
              if (newRefreshToken) {
                localStorage.setItem('refreshToken', newRefreshToken);
              }

              api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
              originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
              processQueue(null, newAccessToken);
              return api(originalRequest);
            }
          } catch (refreshErr) {
            processQueue(refreshErr, null);
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
            return Promise.reject(refreshErr);
          } finally {
            isRefreshing = false;
          }
        }
      }

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Request retry with backoff for network errors / 5xx
    if (!originalRequest || !originalRequest.retry) {
      if (originalRequest) {
        originalRequest.retry = 3;
        originalRequest.retryDelay = 1000;
        originalRequest.retryCount = 0;
      }
    }
    if (
      originalRequest &&
      (error.message === 'Network Error' ||
        error.code === 'ECONNABORTED' ||
        (error.response && error.response.status >= 500))
    ) {
      if (originalRequest.retryCount < originalRequest.retry) {
        originalRequest.retryCount += 1;
        const delay = originalRequest.retryDelay * Math.pow(2, originalRequest.retryCount - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

