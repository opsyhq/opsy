CREATE INDEX "thinking_block_artifacts_claim_idx" ON "thinking_block_artifacts" USING btree ("block_name","status","updated_at","created_at");
