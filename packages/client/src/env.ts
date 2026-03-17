/**
 * Environment variable management for Blobverse Client
 * Supports Vite's import.meta.env for type-safe environment access
 */

export const getApiBaseUrl = (): string => {
  // In development, use localhost; in production, use the Railway URL
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
};

export const getEnvironment = (): string => {
  return import.meta.env.VITE_ENVIRONMENT || 'development';
};

export const isDevelopment = (): boolean => {
  return getEnvironment() === 'development';
};

export const isProduction = (): boolean => {
  return getEnvironment() === 'production';
};
