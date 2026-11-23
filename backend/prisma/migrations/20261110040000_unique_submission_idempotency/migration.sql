-- Keep existing submissions but drop duplicate legacy idempotency hashes before
-- enforcing one record per key. MySQL unique indexes permit multiple NULLs.
CREATE TEMPORARY TABLE `_items_idempotency_keep` AS
SELECT MIN(`id`) AS `keep_id`, `idempotency_key_hash`
FROM `items`
WHERE `idempotency_key_hash` IS NOT NULL
GROUP BY `idempotency_key_hash`;
UPDATE `items` AS target
JOIN `_items_idempotency_keep` AS kept
  ON kept.`idempotency_key_hash` = target.`idempotency_key_hash`
SET target.`idempotency_key_hash` = NULL
WHERE target.`id` <> kept.`keep_id`;
DROP TEMPORARY TABLE `_items_idempotency_keep`;
ALTER TABLE `items` DROP INDEX `items_idempotency_key_hash_idx`;
CREATE UNIQUE INDEX `items_idempotency_key_hash_key` ON `items`(`idempotency_key_hash`);

CREATE TEMPORARY TABLE `_canteen_idempotency_keep` AS
SELECT MIN(`id`) AS `keep_id`, `idempotency_key_hash`
FROM `canteen_feedback`
WHERE `idempotency_key_hash` IS NOT NULL
GROUP BY `idempotency_key_hash`;
UPDATE `canteen_feedback` AS target
JOIN `_canteen_idempotency_keep` AS kept
  ON kept.`idempotency_key_hash` = target.`idempotency_key_hash`
SET target.`idempotency_key_hash` = NULL
WHERE target.`id` <> kept.`keep_id`;
DROP TEMPORARY TABLE `_canteen_idempotency_keep`;
ALTER TABLE `canteen_feedback` DROP INDEX `canteen_feedback_idempotency_key_hash_idx`;
CREATE UNIQUE INDEX `canteen_feedback_idempotency_key_hash_key` ON `canteen_feedback`(`idempotency_key_hash`);

CREATE TEMPORARY TABLE `_mailbox_idempotency_keep` AS
SELECT MIN(`id`) AS `keep_id`, `idempotency_key_hash`
FROM `mailbox_messages`
WHERE `idempotency_key_hash` IS NOT NULL
GROUP BY `idempotency_key_hash`;
UPDATE `mailbox_messages` AS target
JOIN `_mailbox_idempotency_keep` AS kept
  ON kept.`idempotency_key_hash` = target.`idempotency_key_hash`
SET target.`idempotency_key_hash` = NULL
WHERE target.`id` <> kept.`keep_id`;
DROP TEMPORARY TABLE `_mailbox_idempotency_keep`;
ALTER TABLE `mailbox_messages` DROP INDEX `mailbox_messages_idempotency_key_hash_idx`;
CREATE UNIQUE INDEX `mailbox_messages_idempotency_key_hash_key` ON `mailbox_messages`(`idempotency_key_hash`);

CREATE TEMPORARY TABLE `_inquiry_idempotency_keep` AS
SELECT MIN(`id`) AS `keep_id`, `idempotency_key_hash`
FROM `lost_found_inquiries`
WHERE `idempotency_key_hash` IS NOT NULL
GROUP BY `idempotency_key_hash`;
UPDATE `lost_found_inquiries` AS target
JOIN `_inquiry_idempotency_keep` AS kept
  ON kept.`idempotency_key_hash` = target.`idempotency_key_hash`
SET target.`idempotency_key_hash` = NULL
WHERE target.`id` <> kept.`keep_id`;
DROP TEMPORARY TABLE `_inquiry_idempotency_keep`;
ALTER TABLE `lost_found_inquiries` DROP INDEX `lost_found_inquiries_idempotency_key_hash_idx`;
CREATE UNIQUE INDEX `lost_found_inquiries_idempotency_key_hash_key` ON `lost_found_inquiries`(`idempotency_key_hash`);
