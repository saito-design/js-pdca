# ジュネストリー データファイル一覧

**Google DriveフォルダID**: `1Bt8WpIQWUiHiOCct_c1AikDOZ5CKprCL`
**フォルダURL**: https://drive.google.com/drive/folders/1Bt8WpIQWUiHiOCct_c1AikDOZ5CKprCL

---

## ファイル一覧

| ファイル名 | 用途 | データ元 | 作成スクリプト |
|-----------|------|---------|--------------|
| junestory_master_data.json | 統合マスターデータ（API用メインファイル） | pos_data + pl_data を統合・加工 | create_junestory_master_data.py |
| pos_data.json | POSデータ（売上・客数・客単価等） | POS分析フォルダ内CSV | convert_junestory_pos.py |
| pl_data.json | 損益データ（売上・原価・販管費等） | TKC部門別損益PDF → CSV | convert_junestory_pl.py |
| store_metrics.json | 店舗指標（家賃比率・席回転率・坪売上） | pos_data + pl_data + 店舗マスタ | calc_store_metrics.py |
| entities.json | 店舗（エンティティ）一覧 | junestory_stores.json | migrate_junestory_to_clients.py |
| index.json | 分割ファイルのインデックス | master_data作成時に生成 | create_junestory_master_data.py |
| store_{店舗コード}.json | 店舗別データ（分割） | master_dataを分割 | create_junestory_master_data.py |
| brand_{業態}.json | 業態別データ（分割） | master_dataを分割 | create_junestory_master_data.py |
| status_{new/existing}.json | 新店/既存店別データ（分割） | master_dataを分割 | create_junestory_master_data.py |

---

## 詳細

### 1. junestory_master_data.json（統合マスターデータ）

**用途**: ダッシュボードAPIが参照するメインデータファイル

**データ構造**:
```json
{
  "company_name": "株式会社ジュネストリー",
  "format": "long",
  "generated_at": "2026-02-27T00:17:00",
  "columns": ["年月", "部門", "店舗コード", "大項目", "中項目", "単位", "区分", "値"],
  "departments": ["均タロー!横浜店", "鶏ヤロー蒲田店", ...],
  "total_records": 27783,
  "data": [...]
}
```

**区分一覧**:
- 実績、実績平均、実績累計
- 前年、前年平均、前年累計
- 前年比（%）
- 売上比、売上比累計（PLの費用項目用）

**注意点**:
- 大容量ファイル（約36MB）のため resumable upload を使用
- 会計期間は11月〜10月（10月決算）

---

### 2. pos_data.json（POSデータ）

**用途**: 店舗別の売上・客数・客単価等のPOSデータ

**データ元**:
- `POS分析/POS売上/` - レジ集計CSV（Shift-JIS）
- `POS分析/fun売上/` - fun POS CSV（UTF-8）
- `POS分析/dinii売上/` - dinii POS CSV（UTF-8）

**主な項目**:
- 純売上高(税抜)、客数、組数、客単価(税抜)

**注意点**:
- 税抜き統一（diniiは税込み→税抜き変換）
- 店舗コードはPOSコード→正式店番に変換
- 店名も正式名に変換

---

### 3. pl_data.json（損益データ）

**用途**: TKC会計システムの部門別損益データ

**データ元**:
- `損益元データ/部門別損益比較表_*.csv`
- 元は TKC PDFファイル → `convert_pl_pdf_batch.py` でCSV変換

**主な項目**:
- 売上高: 純売上高、飲食店売上高合計
- 売上原価: 当期売上原価、飲食店原価合計
- 販管費: 人件費合計、店舗家賃、水道光熱費、広告宣伝費 等
- 利益: 売上総利益、営業利益、経常利益

**注意点**:
- TKC部門コード（3桁）→正式店番（4桁）の変換が必要
- 括弧付き数値は負数として処理
- PDFファイルは仕様が変わることがある。おかしなデータを吸い込んだときは、それが原因のことが多い。吸い込みが終わったらAIで整合を判定させるとよい

---

### 4. store_metrics.json（店舗指標）

**用途**: 店舗別のKPI・効率指標

**計算指標**:
| 指標 | 計算式 | 単位 |
|-----|-------|-----|
| 家賃比率 | 家賃 ÷ 売上 × 100 | % |
| 席回転率 | 客数 ÷ 席数 | 回/月 |
| 坪売上 | 売上 ÷ 坪数 | 円 |
| 費用比率 | 各費用 ÷ 売上 × 100 | % |

**注意点**:
- 店舗マスタ（junestory_stores.json）の坪数・席数・家賃情報が必要

---

### 5. entities.json（店舗一覧）

**用途**: クライアントシステムのエンティティ（部署/店舗）マスタ

**データ構造**:
```json
[
  {
    "id": "client-junestory-1102",
    "client_id": "client-junestory",
    "name": "均タロー!大宮店",
    "sort_order": 100,
    "store_code": "1102",
    "brand": "kintaro",
    "brand_name": "均タロー"
  }
]
```

---

### 6. 分割ファイル（index.json, store_*.json, brand_*.json, status_*.json）

**用途**: 大量データの効率的な読み込み用

**分割単位**:
- **店舗別**: `store_1102.json`, `store_2301.json` 等
- **業態別**: `brand_kintaro.json`, `brand_toriyaro.json` 等
- **新店/既存店**: `status_new.json`, `status_existing.json`

**index.json**:
```json
{
  "generated_at": "...",
  "company_name": "株式会社ジュネストリー",
  "fiscal_year": "2026",
  "total_records": 27783,
  "files": [...],
  "stores": [...],
  "brands": [...]
}
```

---

## 作成手順

### 通常の更新フロー

```bash
cd PDCA/scripts

# 1. POSデータ変換（→ pl変換 → master作成 → 指標計算 を自動実行）
python convert_junestory_pos.py
```

**実行順序**（自動チェーン）:
1. `convert_junestory_pos.py` → pos_data.json
2. `convert_junestory_pl.py` → pl_data.json
3. `create_junestory_master_data.py` → junestory_master_data.json + 分割ファイル
4. `calc_store_metrics.py` → store_metrics.json

### 個別実行

```bash
# POSデータのみ
python convert_junestory_pos.py

# PLデータのみ
python convert_junestory_pl.py

# マスターデータ作成のみ
python create_junestory_master_data.py

# 店舗指標のみ
python calc_store_metrics.py

# クライアントシステムへの統合
python migrate_junestory_to_clients.py
```

---

## 注意点・トラブルシューティング

### 1. 環境変数
```bash
# .env.local に設定
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY_BASE64=...
# 企業マスタフォルダ（ジュネストリー様フォルダ）
MASTER_FOLDER_ID=1L_TJrrzfFHDrsYYY83vjzt-jSOs0JNqE
# 注意: 旧GOOGLE_DRIVE_JUNESTORY_FOLDER_ID(1Bt8WpIQWUiHiOCct_c1AikDOZ5CKprCL)は廃止
```

### 2. 前年データについて
- POSデータ: 2024-11以降のデータのみ（それ以前は前年データなし）
- PLデータ: 2024年分のPDFが未変換の場合は前年比が計算されない

### 3. 店舗コードの変換
- TKC部門コード（3桁）と正式店番（4桁）のマッピングは `create_junestory_master_data.py` 内の `TKC_TO_OFFICIAL` で定義
- 新店舗追加時は店舗マスタ（junestory_stores.json）の更新が必要

### 4. 大容量ファイルのアップロード
- junestory_master_data.json は resumable upload を使用
- タイムアウト時は自動リトライ（最大3回、指数バックオフ）

### 5. 店舗マスタ・従業員マスタの更新
- `update_store_master.py` でスプレッドシートから自動更新
- `calc_store_metrics.py` 実行時に更新日時をチェックし、必要なら自動更新

**マスタデータ取得元**:
- 店舗マスタ: https://drive.google.com/file/d/1tvdlX073h1jjHgrhFMxs0U6TzgdM936t/view
- 従業員マスタ（店長）: https://drive.google.com/file/d/1PygDvHV2dBrBCT2BLN3RKlxBm8mQtbaN/view
- 店舗管理表: https://drive.google.com/file/d/1tjeEk_z_pU-1oB6FqDvBexEgu99XpUgo/view

---

## 関連ファイル

| ファイル | 場所 | 用途 |
|---------|-----|------|
| junestory_stores.json | scripts/ | 店舗マスタ（ローカル） |
| convert_lib.py | scripts/ | 共通ライブラリ |
| store_code_mapping.csv | scripts/ | 店舗コードマッピング（参考） |

---

**最終更新**: 2026-02-27
