export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export function apiSuccess<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}
