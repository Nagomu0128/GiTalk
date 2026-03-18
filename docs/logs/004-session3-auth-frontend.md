# 004 - Session 3: 認証基盤（フロントエンド）

## 日時
2026-03-18

## 対象タスク
- T0-2: Firebase Auth セットアップ（Firebase Console）
- T1-3: フロントエンド認証（Firebase Auth SDK、AuthProvider、Google ログイン画面）

## 実施内容

### パッケージ追加
- `firebase`: Firebase クライアント SDK（Auth 用）
- `zustand`: 状態管理（specs 12-development-guide.md に基づく）

### 作成ファイル

| ファイル | 内容 |
|---------|------|
| `lib/firebase.ts` | Firebase クライアント初期化。環境変数（NEXT_PUBLIC_FIREBASE_*）から設定読込 |
| `stores/auth-store.ts` | Zustand ストア。user, loading, setUser, setLoading |
| `components/providers/auth-provider.tsx` | `onIdTokenChanged` で認証状態を監視。未認証時は `/login` にリダイレクト、ログイン済みで `/login` にいれば `/dashboard` にリダイレクト。ローディング中はスピナー表示 |
| `app/login/page.tsx` | Google ログイン画面。ワイヤーフレーム（11-wireframes.md セクション2）に準拠。Google OAuth ボタンのみ |
| `app/dashboard/page.tsx` | ダッシュボードのプレースホルダー。ユーザー名表示 + ログアウトボタン（Session 9 で本実装） |
| `app/layout.tsx` | AuthProvider をルートレイアウトに統合。title を "GiTalk"、lang を "ja" に変更 |

### アーキテクチャ判断
- `onIdTokenChanged` を使用（`onAuthStateChanged` ではなく）— spec 06-auth-and-access.md に準拠。トークンリフレッシュ時も検知できる
- 認証状態は Zustand `auth-store` で管理 — spec 12-development-guide.md に準拠
- `/` と `/login` は公開パス、それ以外は認証必須（AuthProvider 内でチェック）
- ダッシュボードは Session 9 で本実装するため、プレースホルダーのみ作成

## スキップした項目
- **T0-2 Firebase Console 設定:** Firebase Console での Authentication 有効化と Google プロバイダ設定はユーザーが実施済み
- **Firebase ビルドスクリプト承認:** `@firebase/util`, `protobufjs` の pnpm approve-builds はユーザーが手動で実施済み。`frontend/pnpm-workspace.yaml` が生成されコミット済み
- **E2E 認証テスト:** Firebase プロジェクト + バックエンド起動が必要なため未実施

## 完了済みの追加作業
- **環境変数の設定:** Firebase MCP で SDK config を取得し、`.env.local` に NEXT_PUBLIC_FIREBASE_* を設定済み（.gitignore で除外されるためコミット対象外）

## 確認結果
- `tsc --noEmit`: パス
- `pnpm lint`: パス

## 次のステップ
Session 4: 会話コア バックエンド（T2-1 + T2-2 + T2-3 + T2-4）
