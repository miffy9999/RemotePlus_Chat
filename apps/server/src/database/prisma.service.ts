import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/** 애플리케이션 생명주기에 맞춰 데이터베이스 연결을 열고 안전하게 정리합니다. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** 서버가 요청을 받기 전에 데이터베이스 연결 가능 여부를 확인합니다. */
  async onModuleInit(): Promise<void> { await this.$connect(); }

  /** 개발 서버 재시작과 정상 종료 때 연결을 반환해 연결 누수를 방지합니다. */
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
