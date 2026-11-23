-- Expire one-time guest query credentials while keeping submission/audit records.
ALTER TABLE `items`
  ADD COLUMN `query_expires_at` DATETIME(3) NULL;

ALTER TABLE `canteen_feedback`
  ADD COLUMN `query_expires_at` DATETIME(3) NULL;

ALTER TABLE `lost_found_inquiries`
  ADD COLUMN `query_expires_at` DATETIME(3) NULL;

ALTER TABLE `mailbox_messages`
  ADD COLUMN `query_expires_at` DATETIME(3) NULL;

CREATE INDEX `items_query_expires_at_idx` ON `items`(`query_expires_at`);
CREATE INDEX `canteen_feedback_query_expires_at_idx` ON `canteen_feedback`(`query_expires_at`);
CREATE INDEX `lost_found_inquiries_query_expires_at_idx` ON `lost_found_inquiries`(`query_expires_at`);
CREATE INDEX `mailbox_messages_query_expires_at_idx` ON `mailbox_messages`(`query_expires_at`);
