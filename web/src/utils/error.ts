import axios, { AxiosError } from 'axios';
import { ApiErrorEnvelope } from '@/types/api';

export class AppApiError extends Error {
  code: string;
  status?: number;
  requestId?: string;
  fieldErrors: Record<string, string>;

  constructor(
    message: string,
    code = 'UNKNOWN_ERROR',
    status?: number,
    requestId?: string,
    fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.name = 'AppApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.fieldErrors = fieldErrors;
  }
}

export function parseApiError(error: unknown): AppApiError {
  if (error instanceof AppApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorEnvelope>;

    // Timeout
    if (axiosError.code === 'ECONNABORTED') {
      return new AppApiError(
        'Connection timed out. The server took too long to respond.',
        'TIMEOUT'
      );
    }

    // Network / Offline Error
    if (axiosError.code === 'ERR_NETWORK' || !axiosError.response) {
      return new AppApiError(
        'Unable to connect to the server. Please check your network connection.',
        'NETWORK_ERROR'
      );
    }

    const status = axiosError.response.status;
    const errorData = axiosError.response.data?.error;

    if (errorData) {
      const fieldErrors: Record<string, string> = {};
      if (Array.isArray(errorData.details)) {
        for (const detail of errorData.details) {
          if (detail.field && detail.message) {
            fieldErrors[detail.field] = detail.message;
            const camelField = detail.field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            fieldErrors[camelField] = detail.message;
          }
        }
      }

      return new AppApiError(
        errorData.message || 'An error occurred with your request.',
        errorData.code || 'API_ERROR',
        status,
        errorData.requestId,
        fieldErrors
      );
    }

    // Status code fallbacks
    if (status === 401) {
      return new AppApiError('Session expired or authentication failed. Please sign in again.', 'UNAUTHORIZED', 401);
    }
    if (status === 403) {
      return new AppApiError('You do not have permission to perform this action.', 'FORBIDDEN', 403);
    }
    if (status === 404) {
      return new AppApiError('The requested resource was not found.', 'NOT_FOUND', 404);
    }
    if (status >= 500) {
      return new AppApiError('Server error occurred. Please try again shortly.', 'SERVER_ERROR', status);
    }

    return new AppApiError(axiosError.message || 'An unexpected error occurred.', 'HTTP_ERROR', status);
  }

  if (error instanceof Error) {
    return new AppApiError(error.message);
  }

  return new AppApiError('An unknown error occurred.');
}
