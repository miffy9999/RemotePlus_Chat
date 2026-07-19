import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "./database/prisma.service";

/** 배포 환경과 개발자가 서버 프로세스의 생존 여부를 확인할 수 있는 공개 헬스 체크입니다. */
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  /** 현재 서버 시각을 함께 반환해 타임존이나 시계 오차 조사에 활용합니다. */
  @Get()
  async check(): Promise<{ status: "ok"; database: "ok"; serverTime: string }> {
    try { await this.prisma.$queryRaw`SELECT 1`; return { status: "ok", database: "ok", serverTime: new Date().toISOString() }; }
    catch { throw new ServiceUnavailableException("데이터베이스 연결을 확인할 수 없습니다."); }
  }
}
