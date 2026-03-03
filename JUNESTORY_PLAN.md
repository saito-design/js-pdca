# ジュネストリー PDCAシステム実装計画

作成日: 2026-02-24

## 概要
既存PDCAアプリを拡張し、ジュネストリー（飲食チェーン18店舗）のPOS分析・予実管理をシステム化する。

## 対象店舗（18店舗）

| 業態 | 店舗数 | 店番範囲 |
|------|--------|---------|
| 均タロー | 11店舗 | 1102-1113 |
| 鶏ヤロー | 4店舗 | 2301-2305 |
| きんたろう | 1店舗 | 3102 |
| 魚ゑもん | 2店舗 | 4101-4102 |

## データソース

### POSデータ（590 CSVファイル）
```
c:\Users\yasuh\OneDrive - 株式会社日本コンサルタントグループ　\MyDocuments\00_Junes\2026年10月期_データ\POS分析\
```
- **dinii単品/売上**: 魚えもん用、UTF-8
- **fun単品/売上**: 複数チェーン、UTF-8、ABC分析
- **POS単品出数/売上/売上**: Shift-JIS、店舗コード付き

### 損益データ
```
c:\Users\yasuh\OneDrive - 株式会社日本コンサルタントグループ　\MyDocuments\00_Junes\2026年10月期_データ\予実管理\損益元データ\
```
- TKC FX4 部門別損益比較表PDF
- store_map_auto.json（店舗コードマッピング）

### 店舗マスタ
```
c:\Users\yasuh\OneDrive - 株式会社日本コンサルタントグループ　\MyDocuments\00_Junes\2026年10月期_データ\【予実管理表】1_業態店舗一覧2026年10月期12月分_株式会社ジュネストリー.pdf
```

---

## Phase 1: 基盤構築

### 1.1 店舗マスタ登録
- ジュネストリーをclientとして登録
- 18店舗をentityとして登録（店舗コード・業態・ランク・店長名等）

### 1.2 型定義追加 (`src/lib/types.ts`)
```typescript
interface Store extends Entity {
  store_code: string;      // 1102, 2301等
  brand: string;           // 均タロー, 鶏ヤロー等
  rank: string;            // A-I
  location_type: string;   // 繁華街、学生街等
  manager_name: string;
  opened_at: string;
}
```

### 1.3 店舗一覧画面
- `/clients/[clientId]/stores` - 業態別カード表示
- フィルタ機能（業態・ランク・立地）

---

## Phase 2: POSデータ取り込み

### 2.1 変換スクリプト作成 (`scripts/convert_junestory_pos.py`)
- 3種類のCSV対応（dinii/fun/POS）
- エンコーディング自動検出（UTF-8/Shift-JIS）
- 店舗コード紐付け
- 縦持ち形式に変換 → `pos_data.json`

### 2.2 データ構造（縦持ち）
```json
{
  "年月": "2025-12",
  "店舗コード": "2305",
  "店舗名": "鶏ヤロー!歌舞伎町2号店",
  "大項目": "売上",
  "中項目": "純売上高",
  "区分": "実績",
  "値": 14277000
}
```

### 2.3 インポートAPI
- `POST /api/clients/[clientId]/pos-data/import`
- 手動アップロード or フォルダ監視

---

## Phase 3: ダッシュボード

### 3.1 新規コンポーネント
| コンポーネント | 機能 |
|--------------|------|
| `sales-trend-chart.tsx` | 売上推移（日/週/月） |
| `customer-analysis.tsx` | 客数・客単価・組数推移 |
| `category-pie-chart.tsx` | カテゴリ構成比 |
| `day-of-week-chart.tsx` | 曜日別売上・客数 |
| `item-ranking.tsx` | 単品ランキング（ABC分析） |

### 3.2 店舗ダッシュボード画面
- `/clients/[clientId]/stores/[storeId]/dashboard`
- KPIカード（売上・客数・客単価・前年比）
- 上記グラフ群
- PDCA課題リスト

---

## Phase 4: PDCA連携

### 4.1 店舗別PDCA管理
- 既存PDCAコンポーネントを流用
- 店舗ごとの課題・施策・サイクル管理

### 4.2 データ連携
- POSデータからの自動アラート（売上低下等）
- 施策効果測定（施策前後の売上比較）

---

## Phase 5: 予実管理

### 5.1 損益データ取り込み（Pythonスクリプト一括変換）
既存スクリプト `ジュネストリー様_損益試算表エクセル化_差し替え版_v4.py` を拡張：

```
TKC PDF → CSV変換（既存） → JSON変換（追加） → Google Drive保存（追加）
```

**拡張スクリプト**: `scripts/convert_junestory_pl.py`
- 入力: 損益元データフォルダのPDF
- 出力: `pl_data.json`（縦持ち形式）→ Google Drive保存

### 5.2 予実比較画面
- 予算 vs 実績グラフ
- 差異分析
- 店舗間比較

---

## 実装順序と依存関係

```
Phase 1 (基盤) ─────────────────┐
    │                          │
    ▼                          ▼
Phase 2 (POS取込)        Phase 4 (PDCA)
    │
    ▼
Phase 3 (ダッシュボード)
    │
    ▼
Phase 5 (予実管理)
```

---

## 主要ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/types.ts` | Store, PosRecord型追加 |
| `src/lib/entity-helpers.ts` | 店舗データ読み書き関数 |
| `src/app/api/clients/[clientId]/stores/` | 店舗API |
| `src/app/api/clients/[clientId]/pos-data/` | POSデータAPI |
| `src/app/clients/[clientId]/stores/` | 店舗一覧・詳細画面 |
| `src/components/` | 新規グラフコンポーネント群 |
| `scripts/convert_junestory_pos.py` | POS CSV変換 |

---

## 検証方法

1. **Phase 1完了時**: 店舗一覧画面で18店舗が表示されること
2. **Phase 2完了時**: CSVアップロード後、pos_data.jsonにデータが保存されること
3. **Phase 3完了時**: ダッシュボードでグラフが表示されること
4. **Phase 4完了時**: PDCA課題にPOSデータが反映されること
5. **Phase 5完了時**: 予実比較グラフが表示されること

---

## 技術的考慮事項

- **エンコーディング**: POS系CSVはShift-JIS対応必須
- **パフォーマンス**: 590ファイル処理はバッチ化
- **キャッシュ**: 5分TTL維持
- **セキュリティ**: ファイルサイズ制限10MB
