export class ApiError extends Error {
  public statusCode: number;
  public data: null; // Explicitly null as per your original
  public success: boolean;
  public errors: any[];

  constructor(statusCode: number, message = "Something went wrong", errors: any[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.success = false;
    this.errors = errors;
  }
}

export default { ApiError };