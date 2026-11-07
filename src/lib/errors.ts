/** What data access throws, so the UI can show `message` as is. */
export class ApiError extends Error {}

export function fail(error: { message: string } | null): never {
  throw new ApiError(error?.message ?? "Something went wrong");
}
