-- Allow visitor submissions without creating a student account.
ALTER TABLE `items`
    MODIFY `user_id` INTEGER NULL,
    MODIFY `contact_type` ENUM('wechat', 'qq', 'phone', 'other') NULL,
    MODIFY `contact_value` VARCHAR(100) NULL;

ALTER TABLE `items` DROP FOREIGN KEY `items_user_id_fkey`;
ALTER TABLE `items` ADD CONSTRAINT `items_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `items`
    ADD COLUMN `query_no` VARCHAR(32) NULL,
    ADD COLUMN `query_credential_hash` CHAR(64) NULL,
    ADD COLUMN `idempotency_key_hash` CHAR(64) NULL,
    ADD COLUMN `content_fingerprint` CHAR(64) NULL,
    ADD COLUMN `attachments` JSON NULL,
    ADD COLUMN `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE UNIQUE INDEX `items_query_no_key` ON `items`(`query_no`);
CREATE INDEX `items_idempotency_key_hash_idx` ON `items`(`idempotency_key_hash`);

ALTER TABLE `canteen_feedback` ADD COLUMN `attachments` JSON NULL;
ALTER TABLE `lost_found_inquiries`
    ADD COLUMN `attachments` JSON NULL,
    ADD COLUMN `content_fingerprint` CHAR(64) NULL;
ALTER TABLE `mailbox_messages`
    ADD COLUMN `attachments` JSON NULL,
    ADD COLUMN `content_fingerprint` CHAR(64) NULL;
