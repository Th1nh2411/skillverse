/**
 * Tác vụ nền đặt sau interface JobRunner để sau này thay bằng hàng đợi thật (BullMQ, SQS...)
 * mà không sửa logic nghiệp vụ. MVP: InlineJobRunner chạy ngay trong request / trong /api/cron.
 */
export type JobName =
  | "reassignExpiredReviews"
  | "closeExpiredProposals"
  | "weeklyReputationRecovery"
  | "closeDuels";

export interface JobRunner {
  /** Chạy (hoặc xếp hàng) một tác vụ. */
  enqueue(name: JobName, payload?: unknown): Promise<void>;
}

export type JobHandler = (payload?: unknown) => Promise<unknown>;

export class InlineJobRunner implements JobRunner {
  constructor(private readonly handlers: Partial<Record<JobName, JobHandler>>) {}
  async enqueue(name: JobName, payload?: unknown): Promise<void> {
    const h = this.handlers[name];
    if (!h) throw new Error(`Chưa đăng ký handler cho job ${name}`);
    await h(payload);
  }
}
