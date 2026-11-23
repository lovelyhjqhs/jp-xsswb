ALTER TABLE `items`
  MODIFY `status` ENUM('pending', 'open', 'resolved', 'cleaned', 'rejected', 'offline') NOT NULL DEFAULT 'open';
