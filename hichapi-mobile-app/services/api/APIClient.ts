/**
 * Singleton Axios-based API client for HiChapi Mobile App.
 * Handles authentication token injection, 401 logout, and 5xx error logging.
 */

import axios, { AxiosInstance } from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../../config/api';
import { logError } from '../../utils/errorLogger';

class APIClient {
  private static instance: APIClient;
  private axiosInstance: AxiosInstance;
  private authToken: string | null = null;

  /** Callback invoked when the server returns 401 Unauthorized. */
  onUnauthorized: (() => void) | null = null;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    });
    this.setupInterceptors();
  }

  /**
   * Returns the singleton instance of APIClient.
   */
  static getInstance(): APIClient {
    if (!APIClient.instance) {
      APIClient.instance = new APIClient();
    }
    return APIClient.instance;
  }

  // ---------------------------------------------------------------------------
  // Interceptors
  // ---------------------------------------------------------------------------

  private setupInterceptors(): void {
    // Task 4.2 — Request interceptor: inject Authorization header
    this.axiosInstance.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });

    // Task 4.3 — Response interceptor: handle 401 and 5xx errors
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Notify AuthContext to handle logout
          this.onUnauthorized?.();
        } else if (error.response?.status >= 500) {
          logError(error, {
            action: 'api_request',
            status: error.response?.status,
          });
          // Toast notification is handled by the caller
        } else if (!error.response) {
          logError(error, { action: 'network_error' });
        }
        return Promise.reject(error);
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Token management
  // ---------------------------------------------------------------------------

  /**
   * Sets the Bearer token used for authenticated requests.
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clears the stored Bearer token (e.g. on logout).
   */
  clearAuthToken(): void {
    this.authToken = null;
  }

  // ---------------------------------------------------------------------------
  // HTTP methods
  // ---------------------------------------------------------------------------

  /**
   * Performs a GET request and returns the response data.
   */
  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const finalParams = { ...params, _t: Date.now() };
    const response = await this.axiosInstance.get<T>(endpoint, { params: finalParams });
    return response.data;
  }

  /**
   * Performs a POST request and returns the response data.
   */
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await this.axiosInstance.post<T>(endpoint, data);
    return response.data;
  }

  /**
   * Performs a PATCH request and returns the response data.
   */
  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await this.axiosInstance.patch<T>(endpoint, data);
    return response.data;
  }

  /**
   * Performs a DELETE request and returns the response data.
   */
  async delete<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await this.axiosInstance.delete<T>(endpoint, { data });
    return response.data;
  }
}

/** Singleton instance of the API client. */
export const apiClient = APIClient.getInstance();
