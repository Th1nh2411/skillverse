/** Lỗi nghiệp vụ có mã ổn định để packages/api map sang mã tRPC và UI hiển thị thông điệp tiếng Việt. */
export type DomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "BAD_REQUEST";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
