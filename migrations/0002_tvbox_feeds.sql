-- 10 条由站长提供的 TVBox 配置入口。仅登记在后台待检查列表，不默认成为播放源。
CREATE TABLE IF NOT EXISTS tvbox_feeds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  last_status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  last_candidate_count INTEGER,
  last_total_sites INTEGER,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tvbox_feeds_checked ON tvbox_feeds (last_checked_at);
INSERT OR IGNORE INTO tvbox_feeds (id,name,url) VALUES ('sun','太阳配置 sun.json','https://9877.kstore.space/sun.json');
INSERT OR IGNORE INTO tvbox_feeds (id,name,url) VALUES ('easydc','EasyDC 图片扩展配置','https://easyzz.dpdns.org/easydc.jpg');
INSERT OR IGNORE INTO tvbox_feeds (id,name,url) VALUES ('fantaiying','饭太硬 TVBox 入口','http://www.饭太硬.cc/tv');
INSERT OR IGNORE INTO tvbox_feeds (id,name,url) VALUES ('tvbox-site','TVBox 配置入口','http://tvbox.xn--4kq62z5rby2qupq9ub.top/');
INSERT OR IGNORE INTO tvbox_feeds (id,name,url) VALUES ('hajimi','哈基米 图片扩展配置','https://17264.kstore.space/哈基米.png');
INSERT OR IGNORE INTO tvbox_feeds (id,name,url) VALUES ('feimao','肥猫 TVBox 入口','http://肥猫.net');
INSERT OR IGNORE INTO tvbox_feeds (id,name,url) VALUES ('xc','XC GitHub 配置（代理）','https://gh-proxy.com/https://raw.githubusercontent.com/yoursmile66/TVBox/main/XC.json');
INSERT OR IGNORE INTO tvbox_feeds (id,name,url) VALUES ('catvod-demo','CatVodSpider 示例配置（代理）','https://gh-proxy.com/https://raw.githubusercontent.com/ggrrttyyiii/CatVodSpider/refs/heads/main/json/demo.json');
INSERT OR IGNORE INTO tvbox_feeds (id,name,url) VALUES ('aowu','嗷呜 WebP 扩展配置','http://itv666.cc/aowu/config.webp');
INSERT OR IGNORE INTO tvbox_feeds (id,name,url) VALUES ('easytv','EasyTV 图片扩展配置','https://easyzz.dpdns.org/easytv.jpg');
