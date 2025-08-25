-- 013_search_fts5.sql — add FTS5 + triggers + helper indexes

-- Drop old FTS/triggers if they exist (idempotent)
DROP TRIGGER IF EXISTS trg_txn_fts_ai;
DROP TRIGGER IF EXISTS trg_txn_fts_ad;  
DROP TRIGGER IF EXISTS trg_txn_fts_au;
DROP TABLE   IF EXISTS txn_fts;

-- Content-backed FTS5 (fast + small, stays in sync via triggers)
-- Weights can be tuned later; tokenizer supports diacritics removal and hyphen/underscore as token chars
CREATE VIRTUAL TABLE txn_fts USING fts5(
  description UNINDEXED,        -- stored but scoring uses copies via triggers
  merchant UNINDEXED,
  -- The indexed copies to influence bm25 weighting:
  c_description,
  c_merchant,
  content='transactions',
  content_rowid='id',
  tokenize = "unicode61 remove_diacritics 2 tokenchars '-_'"
);

-- Backfill from live rows (skip soft-deleted) - use actual column names
INSERT INTO txn_fts(rowid, description, merchant, c_description, c_merchant)
SELECT
  t.id,
  COALESCE(t.description_norm,''),
  COALESCE(t.merchant_norm,''),
  COALESCE(t.description_norm,''),
  COALESCE(t.merchant_norm,'')
FROM transactions t
WHERE COALESCE(t.is_deleted,0)=0;

-- Keep FTS in sync: INSERT
CREATE TRIGGER trg_txn_fts_ai
AFTER INSERT ON transactions
WHEN COALESCE(NEW.is_deleted,0)=0
BEGIN
  INSERT INTO txn_fts(rowid, description, merchant, c_description, c_merchant)
  VALUES(NEW.id,
         COALESCE(NEW.description_norm,''),
         COALESCE(NEW.merchant_norm,''),
         COALESCE(NEW.description_norm,''),
         COALESCE(NEW.merchant_norm,''));
END;

-- Keep FTS in sync: DELETE (or soft-delete flip to 1)
CREATE TRIGGER trg_txn_fts_ad
AFTER DELETE ON transactions
BEGIN
  INSERT INTO txn_fts(txn_fts, rowid, description, merchant, c_description, c_merchant)
  VALUES('delete', OLD.id, OLD.description_norm, OLD.merchant_norm, OLD.description_norm, OLD.merchant_norm);
END;

-- Keep FTS in sync: UPDATE (description_norm/merchant_norm/is_deleted)
CREATE TRIGGER trg_txn_fts_au
AFTER UPDATE OF description_norm, merchant_norm, is_deleted ON transactions
BEGIN
  -- remove previous version
  INSERT INTO txn_fts(txn_fts, rowid, description, merchant, c_description, c_merchant)
  VALUES('delete', OLD.id, OLD.description_norm, OLD.merchant_norm, OLD.description_norm, OLD.merchant_norm);

  -- re-add if still not soft-deleted
  INSERT INTO txn_fts(rowid, description, merchant, c_description, c_merchant)
  SELECT NEW.id,
         COALESCE(NEW.description_norm,''), COALESCE(NEW.merchant_norm,''),
         COALESCE(NEW.description_norm,''), COALESCE(NEW.merchant_norm,'')
  WHERE COALESCE(NEW.is_deleted,0)=0;
END;

-- Helper btree indexes for filters
CREATE INDEX IF NOT EXISTS idx_txn_date_notdeleted ON transactions(date(posted_date), is_deleted);
CREATE INDEX IF NOT EXISTS idx_txn_category_date   ON transactions(category_id, date(posted_date));
CREATE INDEX IF NOT EXISTS idx_txn_merchant_date   ON transactions(merchant_norm, date(posted_date));

ANALYZE;