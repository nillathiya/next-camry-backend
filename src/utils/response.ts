export class ApiResponse {
  public statusCode: number;
  public data: any;
  public message: string;
  public success: boolean;
  public pagination?: { total: number; page: number; limit: number };

  constructor(
    statusCode: number,
    data: any,
    message = "Success",
    pagination?: { total: number; page: number; limit: number }
  ) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
    this.pagination = pagination;
  }
}

export default { ApiResponse };