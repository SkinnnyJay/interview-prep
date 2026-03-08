// pagination-types.ts
export enum PaginationType {
  PAGE_BASED = "page_based",
  OFFSET_BASED = "offset_based",
}

// Base interface for all pagination requests
export interface BasePaginationRequest {
  type: PaginationType;
  limit?: number; // Number of items per page/request (default: 10)
}

// Page-based pagination request (page number + limit)
export interface PageBasedRequest extends BasePaginationRequest {
  type: PaginationType.PAGE_BASED;
  page?: number; // Page number (1-based, default: 1)
}

// Offset-based pagination request (offset + limit)
export interface OffsetBasedRequest extends BasePaginationRequest {
  type: PaginationType.OFFSET_BASED;
  offset?: number; // Number of items to skip (0-based, default: 0)
}

// Union type for all pagination requests
export type PaginationRequest = PageBasedRequest | OffsetBasedRequest;

/** Base for paginated items; extend with specific fields (e.g. Employee) */
export interface DataItem {
  id: number;
  [key: string]: unknown;
}

// Base pagination result interface
export interface BasePaginationResult<T = DataItem> {
  data: T[];
  total: number;
  limit: number;
  type: PaginationType;
}

// Page-based pagination result
export interface PageBasedResult<T = DataItem> extends BasePaginationResult<T> {
  type: PaginationType.PAGE_BASED;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Offset-based pagination result
export interface OffsetBasedResult<T = DataItem> extends BasePaginationResult<T> {
  type: PaginationType.OFFSET_BASED;
  offset: number;
  hasMore: boolean;
}

// Union type for all pagination results
export type PaginationResult<T = DataItem> = PageBasedResult<T> | OffsetBasedResult<T>;

// Configuration for pagination
export interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
}

// Employee interface matching our fake data
export interface Employee extends DataItem {
  id: number;
  name: string;
  email: string;
  age: number;
  department: string;
  position: string;
  salary: number;
  joinDate: string;
}
