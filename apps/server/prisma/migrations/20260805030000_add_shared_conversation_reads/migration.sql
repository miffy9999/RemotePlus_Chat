CREATE TABLE "ConversationRead" (
  "agentId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConversationRead_pkey" PRIMARY KEY ("agentId", "sessionId")
);

CREATE INDEX "ConversationRead_sessionId_lastReadAt_idx"
  ON "ConversationRead"("sessionId", "lastReadAt");

ALTER TABLE "ConversationRead"
  ADD CONSTRAINT "ConversationRead_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationRead"
  ADD CONSTRAINT "ConversationRead_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
