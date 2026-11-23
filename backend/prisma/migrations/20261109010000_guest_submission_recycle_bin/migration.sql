-- Add soft-delete support and recent-duplicate lookup indexes after the original
-- guest submission migration has already been deployed in some environments.
ALTER TABLE `items`
    ADD COLUMN `deleted_at` DATETIME(3) NULL;

CREATE INDEX `items_content_fingerprint_submitted_at_idx`
    ON `items`(`content_fingerprint`, `submitted_at`);
CREATE INDEX `canteen_feedback_content_fingerprint_submitted_at_idx`
    ON `canteen_feedback`(`content_fingerprint`, `submitted_at`);
CREATE INDEX `lost_found_inquiries_content_fingerprint_submitted_at_idx`
    ON `lost_found_inquiries`(`content_fingerprint`, `submitted_at`);
CREATE INDEX `mailbox_messages_content_fingerprint_submitted_at_idx`
    ON `mailbox_messages`(`content_fingerprint`, `submitted_at`);
