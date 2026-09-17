# Pin Note

散歩で見つけた場所を気軽に記録する、スマートフォン向けWebアプリ。

## 構成

- 画面：React / TypeScript / Vite / MUI Icons / Leaflet
- サーバー：Java 17対応ソース / Spring Boot / JDBC（ポイント）・JPA（既存の授業画面）
- DB：PostgreSQL。Flywayでテーブルを作成し、起動時に消さない。
- 地図：OpenStreetMap。市区町村補完：Nominatim（任意、失敗時は日時のみ）。

## 起動（このMac / PostgreSQLコマンドが利用できる環境）

Node.js 22.12以上、JDK 17以上、PostgreSQLとpg_configが必要です。

```sh
node scripts/local-db.mjs
node scripts/backend.mjs
```

別のターミナルで：

```sh
cd frontend
npm install
npm run dev
```

画面：http://127.0.0.1:5173/points/

DBは `~/Library/Application Support/PinNote-db-koushin/postgres` に永続保存します。iCloud同期対象のDocumentsにはDBを置きません。接続パスワードは同フォルダーのdatabase.jsonへ権限600で保存し、ソースには含めません。別の保存先は `PIN_NOTE_DATA_DIR` で指定できます。`.local/postgres` は初回セットアップ調査時の未使用領域です。

DB停止は `node scripts/local-db.mjs stop`。停止しても記録は残ります。再開は同じ起動コマンドです。データフォルダーそのものを削除すると記録を失うので、削除しないでください。

## 提出用：Spring Bootから画面も配信

```sh
cd frontend
npm run build
cd ..
node scripts/backend.mjs package -DskipTests
node scripts/backend.mjs
```

画面：http://127.0.0.1:8080/points/
既存の授業画面は `/`、`/enshu/index`、`/kadai/index` に残しています。

Viteの出力先は `src/main/resources/static/points` です。生成物はGit管理しません。Maven単体でフロントはビルドされないので、パッケージ作成前に `npm run build` を実行してください。

## 別のPostgreSQLを使う

空の専用DBを作り、`DB_URL`（JDBC URL）、`DB_USER`、`DB_PASSWORD` を環境変数に設定して `./mvnw spring-boot:run`。既存アプリのDBをそのまま指定しないでください。Flywayは points / point_photos / app_users / point_history と既存授業画面用2テーブルを作成します。

## 機能

- 現在地取得・地図クリックで場所を選択
- 自動名（日時＋取得できた市区町村）、詳細をスキップして場所だけ保存
- 写真はJPEG/PNG、3枚まで、1枚5MB・2500万画素以下。画像はPostgreSQLのbyteaへ保存
- 一覧／格子切替、詳細、編集、削除確認
- 名前・メモ・市区町村の検索（全角半角・英字大小文字を吸収、空白区切りのAND検索）
- 一覧・詳細の星でお気に入りを保存。お気に入りの変更も取り消し／やり直しに対応
- 白・灰色の半透明パネルとオレンジ。選択ピンの強調、下から開く詳細カード、4:3の写真表示
- 市名取得失敗時も日時で保存。位置取得拒否時は地図選択
- ユーザー名とパスワードによるサインアップ・ログイン・ログアウト。ポイント・写真は本人だけが取得／変更可能
- 直近10操作まで登録・編集・削除を逆順に取り消し。写真も復元。履歴はPostgreSQLに永続保存
- 設定の表示方法切替と、プロフィールのユーザー名表示

## 動作確認

### コード整形（VS Code）

推奨拡張のPrettierを入れると、ワークスペース設定で保存時に整形できます。Java・XMLは4スペース、それ以外のソースは2スペースです。ルールは `.editorconfig` と `.prettierrc.cjs` に保存しています。

```sh
cd frontend
npm ci
npm run format
npm run format:check
```

依存ライブラリ、ビルド生成物、Mavenラッパーなどの生成ツールは除外しています。適用済みFlyway移行SQLもチェックサム維持のため変更しません。DBの変更は新しい移行ファイルで追加してください。

### バックエンド

```sh
PIN_NOTE_TEST_DB=true node scripts/backend.mjs test
```

実PostgreSQLの `pin_note_tests` 専用スキーマを使用します。通常ポイントとは分離しています。未指定での `test` はDB結合テストをスキップします。テストは写真保存、再送重複防止、編集、削除、不正入力、画像偽装、クロスサイトフォーム拒否を確認します。

## 利用範囲

アカウントごとに記録を分離したWebアプリです。初期設定は127.0.0.1だけで待ち受けます。スマホ実機で使う場合はHTTPSで配信できる環境が必要です（現在地取得の条件）。HTTPSで配信する場合は COOKIE_SECURE=true を設定します。公開運用向けのメール確認・パスワード再設定・高度な不正ログイン対策は未実装です。

位置情報は現在地ボタンの操作時にのみ取得します。市区町村名を補うため、選択した地点をNominatimへ送信します。不要なら `GEOCODING_ENABLED=false` を設定してください。外部サービス停止中でも日時だけで保存できます。地図の表示にはネット接続が必要です。

地図・市名取得の利用条件：

- https://operations.osmfoundation.org/policies/tiles/
- https://operations.osmfoundation.org/policies/nominatim/

市名取得はサーバー側でキャッシュし、リクエスト間隔を1秒以上空けます。この制御は単一サーバー用です。配信元は `GEOCODING_URL` で変更できます。地図の著作権表示を消さないでください。

## ログインと10操作の取り消し

最初にサインアップしてください。ユーザー名は英数字とアンダースコアで3〜40文字（大小文字を区別しない）、パスワードは8文字以上・UTF-8で72バイト以内です。パスワードはBCryptでハッシュ化して保存します。セッションはHttpOnly・SameSite=Strict Cookieを使い、1時間操作がない場合やアプリ再起動後は再ログインします。パスワード再設定は未対応です。

ヘッダーの左向き矢印から直近の操作を1つずつ取り消し、右向き矢印からやり直せます。登録の取り消しはそのポイントを消し、編集・削除の取り消しは写真も含めて以前の状態を復元します。利用者ごとに取り消し・やり直し合わせて最大10操作を保存し、11件目の新しい操作で一番古い履歴を破棄します。新しく登録・編集・削除すると、やり直し履歴はリセットされます。登録フォーム編集中は誤操作を避けるため無効になります。両方の履歴はDBに保存され、再起動後も残ります。

地図の紹介文は右上の×で閉じられます。このブラウザーに非表示設定を保存し、設定画面の「紹介文を再表示する」で戻せます。

認証追加前の所有者不明のポイントは削除せず owner_id=NULL で保持し、画面には表示しません。必要な場合は所有者を確認したうえで管理者が割り当てます。先着の登録者へ自動で割り当てることはありません。
