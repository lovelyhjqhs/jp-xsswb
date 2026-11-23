-- 先建 (user_id, created_at) 复合索引，让外键有索引可依赖
CREATE INDEX `items_user_id_created_at_idx` ON `items`(`user_id`, `created_at`);

-- 再删被取代的单列 user_id 索引
DROP INDEX `items_user_id_idx` ON `items`;

-- 同一用户对同一帖子只能举报一次
CREATE UNIQUE INDEX `reports_item_id_reporter_id_key` ON `reports`(`item_id`, `reporter_id`);