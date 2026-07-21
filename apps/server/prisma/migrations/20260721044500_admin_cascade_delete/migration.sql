-- 호텔 삭제 시 소속 룸을 삭제하고, 룸 삭제 시 상담과 메시지까지 DB가 원자적으로 정리하도록 외래 키 정책을 변경합니다.
ALTER TABLE "Room" DROP CONSTRAINT "Room_hotelId_fkey";
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatSession" DROP CONSTRAINT "ChatSession_roomId_fkey";
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
