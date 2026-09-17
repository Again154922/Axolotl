ALTER TABLE settings ADD COLUMN experimental_features_enabled INTEGER NOT NULL DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN experimental_features TEXT NOT NULL DEFAULT '{}';
