/** Request body for `POST /budget/categories`. */
export interface CreateCategoryRequest {
  readonly name: string;
}

/** Request body for `PATCH /budget/categories/:id`. */
export interface UpdateCategoryRequest {
  readonly name: string;
}

/** Response shape for a single category. */
export interface CategoryResponse {
  readonly id: string;
  readonly name: string;
  /** ISO date-time string, present only once the category is archived. */
  readonly archivedAt?: string;
}

/** Response body for `GET /budget/categories`. */
export type CategoryListResponse = readonly CategoryResponse[];
