-- Simple FTS5 setup for transaction search
CREATE VIRTUAL TABLE txn_fts USING fts5(
  description,
  merchant,
  tokenize = "unicode61 remove_diacritics 2 tokenchars '-_'"
);

-- Populate with current data
INSERT INTO txn_fts(rowid, description, merchant)
SELECT 
  id, 
  COALESCE(description_norm, ''), 
  COALESCE(merchant_norm, '')
FROM transactions 
WHERE COALESCE(is_deleted, 0) = 0;

-- Triggers to keep in sync
CREATE TRIGGER trg_txn_fts_ai
AFTER INSERT ON transactions
WHEN COALESCE(NEW.is_deleted, 0) = 0
BEGIN
  INSERT INTO txn_fts(rowid, description, merchant)
  VALUES(NEW.id, 
         COALESCE(NEW.description_norm, ''), 
         COALESCE(NEW.merchant_norm, ''));
END;

CREATE TRIGGER trg_txn_fts_au
AFTER UPDATE OF description_norm, merchant_norm, is_deleted ON transactions
BEGIN
  DELETE FROM txn_fts WHERE rowid = OLD.id;
  INSERT INTO txn_fts(rowid, description, merchant)
  SELECT NEW.id, 
         COALESCE(NEW.description_norm, ''), 
         COALESCE(NEW.merchant_norm, '')
  WHERE COALESCE(NEW.is_deleted, 0) = 0;
END;

CREATE TRIGGER trg_txn_fts_ad
AFTER DELETE ON transactions
BEGIN
  DELETE FROM txn_fts WHERE rowid = OLD.id;
END;