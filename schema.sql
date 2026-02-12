-- 決算短信レポートテーブル
CREATE TABLE IF NOT EXISTS reports (
  id         TEXT    PRIMARY KEY,
  code       TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  sales_pct  REAL,
  profit_pct REAL,
  is_double_growth INTEGER DEFAULT 0,
  summary    TEXT,
  pdf_url    TEXT,
  created_at INTEGER NOT NULL
);

-- 最新順の取得を高速化
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- 増収増益フィルタ用
CREATE INDEX IF NOT EXISTS idx_reports_double_growth ON reports(is_double_growth, created_at DESC);

-- 証券コード検索用
CREATE INDEX IF NOT EXISTS idx_reports_code ON reports(code);
