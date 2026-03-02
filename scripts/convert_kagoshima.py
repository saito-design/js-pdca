"""
鹿児島県市町村職員共済組合 - データ変換スクリプト

Excel報告書を縦持ちJSON/CSVに変換し、Google Driveにアップロードします。
"""

import os
import sys
import json
from pathlib import Path
import tkinter as tk
from tkinter import filedialog

# 共通ライブラリをインポート
sys.path.insert(0, str(Path(__file__).parent))
from convert_lib import (
    setup_google_auth,
    get_drive_service,
    find_folder_by_name,
    convert_excel_to_master_db,
)

# ========== 鹿児島用設定 ==========
COMPANY_NAME = 'kagoshima'
CLIENT_FOLDER_NAME = '鹿児島県市町村職員共済組合'

# デフォルトのExcelファイルパス
DEFAULT_EXCEL_DIR = r'C:\Users\yasuh\OneDrive\デスクトップ'

# ローカル出力先
OUTPUT_DIR = Path(__file__).parent.parent / 'data' / COMPANY_NAME

# 環境変数ファイル
ENV_FILE = Path(__file__).parent.parent / '.env.local'

# 設定ファイル（選択履歴を保存）
CONFIG_FILE = Path(__file__).parent / 'convert_config.json'
# =====================================


def load_config():
    """設定ファイルを読み込む"""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {}


def save_config(config):
    """設定ファイルを保存"""
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def get_last_path(company_name):
    """企業の最後に使用したパスを取得"""
    config = load_config()
    return config.get(company_name, {}).get('last_file', None)


def save_last_path(company_name, file_path):
    """企業の最後に使用したパスを保存"""
    config = load_config()
    if company_name not in config:
        config[company_name] = {}
    config[company_name]['last_file'] = file_path
    save_config(config)


def select_excel_file():
    """ファイル選択ダイアログを表示"""
    # 前回のパスを取得
    last_path = get_last_path(COMPANY_NAME)
    if last_path and Path(last_path).exists():
        initial_dir = str(Path(last_path).parent)
        initial_file = Path(last_path).name
    else:
        initial_dir = DEFAULT_EXCEL_DIR
        initial_file = None

    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)

    # 前回のファイルがある場合は表示
    if last_path and Path(last_path).exists():
        print(f'前回のファイル: {last_path}')
        print('同じファイルを使用する場合はそのまま選択してください。')

    file_path = filedialog.askopenfilename(
        title=f'{CLIENT_FOLDER_NAME} - Excelファイルを選択',
        initialdir=initial_dir,
        filetypes=[
            ('Excel files', '*.xlsx *.xls'),
            ('All files', '*.*')
        ]
    )
    root.destroy()

    # 選択したパスを保存
    if file_path:
        save_last_path(COMPANY_NAME, file_path)

    return file_path


def main():
    print('=' * 50)
    print(f'  {CLIENT_FOLDER_NAME} データ変換')
    print('=' * 50)

    # Excelファイル選択ダイアログ
    print('\nExcelファイルを選択してください...')
    excel_file = select_excel_file()

    if not excel_file:
        print('[キャンセル] ファイルが選択されませんでした。')
        if sys.stdin.isatty():
            input('\nEnterキーで終了...')
        return

    print(f'選択: {excel_file}')

    # Google認証セットアップ
    print('\n認証情報を読み込み中...')
    setup_google_auth(str(ENV_FILE))

    # PDCAフォルダID取得
    pdca_folder_id = os.environ.get('GOOGLE_DRIVE_PDCA_FOLDER_ID')

    # クライアントフォルダ検索
    client_folder_id = None
    if pdca_folder_id:
        print('Google Drive接続中...')
        service = get_drive_service()
        if service:
            client_folder_id = find_folder_by_name(service, CLIENT_FOLDER_NAME, pdca_folder_id)
            if client_folder_id:
                print(f'  -> クライアントフォルダ: {CLIENT_FOLDER_NAME}')
            else:
                print(f'[WARN] クライアントフォルダが見つかりません: {CLIENT_FOLDER_NAME}')
                print('       ローカル保存のみ実行します。')
    else:
        print('[WARN] GOOGLE_DRIVE_PDCA_FOLDER_ID が設定されていません')
        print('       ローカル保存のみ実行します。')

    # 変換実行
    print('\n変換開始...')
    try:
        df = convert_excel_to_master_db(
            excel_path=excel_file,
            output_path=str(OUTPUT_DIR),
            company_name=COMPANY_NAME,
            drive_folder_id=client_folder_id
        )

        print('\n' + '=' * 50)
        print('  変換完了!')
        print('=' * 50)
        print(f'\nローカル出力先: {OUTPUT_DIR}')
        if client_folder_id:
            print(f'Google Drive: {CLIENT_FOLDER_NAME}フォルダにアップロード済み')

    except Exception as e:
        print(f'\n[ERROR] 変換に失敗しました: {e}')
        import traceback
        traceback.print_exc()

    # 対話的環境でのみ待機
    if sys.stdin.isatty():
        input('\nEnterキーで終了...')


if __name__ == '__main__':
    main()
