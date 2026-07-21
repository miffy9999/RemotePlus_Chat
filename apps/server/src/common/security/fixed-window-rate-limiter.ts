interface RateBucket {
  count: number;
  resetAt: number;
}

/**
 * 단일 서버에서 IP 또는 소켓별 요청 횟수를 고정된 시간 창으로 제한합니다.
 * 만료된 키를 주기적으로 제거하고 연결 종료 키를 즉시 제거해 장기 운용 중 메모리가 계속 증가하지 않게 합니다.
 */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, RateBucket>();
  private nextCleanupAt = 0;

  constructor(private readonly windowMs = 60_000) {}

  /** 키의 현재 요청을 기록하고 제한 이내이면 true, 초과이면 false를 반환합니다. */
  allow(key: string, limit: number, now = Date.now()): boolean {
    this.cleanup(now);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= limit;
  }

  /** 연결이 종료된 소켓처럼 다시 사용할 필요가 없는 키를 즉시 제거합니다. */
  forget(key: string): void {
    this.buckets.delete(key);
  }

  /** 운영 진단과 회귀 테스트에서 현재 보관 중인 제한 키 수를 반환합니다. */
  trackedKeyCount(): number {
    return this.buckets.size;
  }

  /** 정리 주기가 되었을 때 제한 창이 끝난 기록만 제거합니다. */
  private cleanup(now: number): void {
    if (now < this.nextCleanupAt) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    this.nextCleanupAt = now + this.windowMs;
  }
}
