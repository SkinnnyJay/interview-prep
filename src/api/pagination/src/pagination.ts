// pagination.ts - Entry file that exports all pagination functionality
export {
  // Types and interfaces
  PaginationType,
  type BasePaginationRequest,
  type PageBasedRequest,
  type OffsetBasedRequest,
  type PaginationRequest,
  type DataItem,
  type BasePaginationResult,
  type PageBasedResult,
  type OffsetBasedResult,
  type PaginationResult,
  type PaginationConfig,
  type Employee,
} from "./pagination-types";

export {
  // Main pagination functions
  paginate,
  paginateWithPageBased,
  paginateWithOffsetBased,

  // Helper functions
  createPageBasedRequest,
  createOffsetBasedRequest,
  pageToOffset,
  offsetToPage,
} from "./pagination-methods";
