-- Expired guest query credentials are cleared by the maintenance job.
ALTER TABLE `canteen_feedback` MODIFY `query_credential_hash` CHAR(64) NULL;
ALTER TABLE `lost_found_inquiries` MODIFY `query_credential_hash` CHAR(64) NULL;
ALTER TABLE `mailbox_messages` MODIFY `query_credential_hash` CHAR(64) NULL;
