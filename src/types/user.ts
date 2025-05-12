export interface IGetUserDirectsQuery {
  userId: string;
  limit?: number | string;
  sortOrder?: "asc" | "desc";
  sortBy?: string;
  page?: number | string; 
}
