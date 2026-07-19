import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/** Prisma 연결을 전역 단일 인스턴스로 제공해 모듈마다 불필요한 연결 풀이 생기지 않게 합니다. */
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
