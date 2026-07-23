import "reflect-metadata";
import "dotenv/config";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import type { NextFunction, Request, Response } from "express";
import { allowedWebOrigins, serverPort, validateRuntimeEnvironment } from "./common/config/environment";
import { FixedWindowRateLimiter } from "./common/security/fixed-window-rate-limiter";
import { restRateLimitPolicy } from "./common/security/rest-rate-limit-policy";

/** 단일 서버 MVP용 메모리 요청 제한기다. 운영 다중 서버에서는 Redis 저장소로 교체해야 한다. */
const restRateLimiter = new FixedWindowRateLimiter();

function rateLimit(request: Request, response: Response, next: NextFunction): void {
  const { key, limit } = restRateLimitPolicy({
    // 프록시·테스트 환경에서 Express가 IP를 확정하지 못해도 모든 익명 요청이 임의 키로 분산되지 않게 안정된 대체값을 사용합니다.
    ip: request.ip ?? request.socket.remoteAddress ?? "unknown",
    method: request.method,
    path: request.path,
    authorization: request.header("authorization"),
  });
  if (!restRateLimiter.allow(key, limit)) { response.status(429).json({ statusCode: 429, message: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." }); return; }
  next();
}

/**
 * HTTP API와 WebSocket 서버를 함께 시작합니다.
 * 전역 검증 파이프는 DTO에 선언되지 않은 필드를 제거하고 잘못된 입력을 API 진입점에서 차단합니다.
 */
async function bootstrap(): Promise<void> {
  validateRuntimeEnvironment();
  const port = serverPort();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.use(helmet());
  // 로그인·접근 키·세션 API를 포함한 모든 REST 요청에 IP·경로별 상한을 적용한다.
  app.use(rateLimit);
  app.enableCors({
    // 개발 확인 링크가 localhost와 127.0.0.1 중 어느 주소를 사용해도 같은 로컬 앱으로 인식합니다.
    origin: allowedWebOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(port, "0.0.0.0");
  new Logger("Bootstrap").log(JSON.stringify({ event: "server.started", port }));
}

void bootstrap();
