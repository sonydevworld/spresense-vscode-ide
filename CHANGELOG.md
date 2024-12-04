# Change Log

# Spresense VSCode IDE v1.5.101 release (2024/12/04)

## Summary

* Feature improvements are available
* This release has a **new [bootloader which have to be loaded](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html#_installing_the_boot_loader)** before use.

## Improved features

* [Serial Terminal] The problem that the serial terminal could not be opened properly in Windows MSYS2 environment has been improved.

## Confirmation Information

* VSCode: v1.95.3

## Documentation

Please refer to the following document for detailed usage.

[Spresense SDK Getting Started Guide (IDE)](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html) 

------------------------

(Below is in Japanese)

## 概要

* 機能改善を行いました。
* 今回のリリースにより **[ブートローダーの更新](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html#_ブートローダのインストール)** が必要になります。

## 改善された機能

* [シリアルターミナル] Windows(MSYS2)環境において、シリアルターミナルが正常に開けない問題を改善しました。

## 動作確認情報

以下のバージョンのVSCodeと組み合わせて動作確認をしています。

* VSCode: v1.95.3

## ドキュメント

詳しい使い方については以下のドキュメントを参照してください。

[Spresense SDK スタートガイド (IDE 版)](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html)

# Spresense VSCode IDE v1.5.100 release (2024/02/09)

## Summary

* Feature improvements are available
* This release has a **new [bootloader which have to be loaded](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html#_installing_the_boot_loader)** before use.

## Improved features

* [SDK Build] Fixed an issue that prevented configuration build with VSCode 1.80.2 or later.
* [SDK Config] Improved the startup speed of Kconfig UI.

## Confirmation Information

* VSCode: v1.86.0

## Documentation

Please refer to the following document for detailed usage.

[Spresense SDK Getting Started Guide (IDE)](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html) 

------------------------

(Below is in Japanese)

## 概要

* 機能改善を行いました。
* 今回のリリースにより **[ブートローダーの更新](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html#_ブートローダのインストール)** が必要になります。

## 改善された機能

* [SDK Build] VSCode 1.80.2以降でコンフィグレーション・ビルド出来ない不具合を修正しました。
* [SDK Config] KconfigのUIの起動速度を改善しました。

## 動作確認情報

以下のバージョンのVSCodeと組み合わせて動作確認をしています。

* VSCode: v1.86.0

## ドキュメント

詳しい使い方については以下のドキュメントを参照してください。

[Spresense SDK スタートガイド (IDE 版)](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html)

# Spresense VSCode IDE v1.4.101 release (2023/7/21)

## Summary

* Feature improvements are available
* This release has a **new [bootloader which have to be loaded](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html#_installing_the_boot_loader)** before use.

## Improved features

* [SDK Build] Fix an issue that caused errors during build time when using some functions in the ASMP worker source code.

## Confirmation Information

* VSCode: v1.80.0

## Documentation

Please refer to the following document for detailed usage.

[Spresense SDK Getting Started Guide (IDE)](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html) 

------------------------

(Below is in Japanese)

## 概要

* 機能改善を行いました。
* 今回のリリースにより **[ブートローダーの更新](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html#_ブートローダのインストール)** が必要になります。

## 改善された機能

* [SDK Build] ASMPワーカーのソースコードで一部の関数を利用した場合、ビルド時にエラーが起きる不具合を修正しました。

## 動作確認情報

以下のバージョンのVSCodeと組み合わせて動作確認をしています。

* VSCode: v1.80.0

## ドキュメント

詳しい使い方については以下のドキュメントを参照してください。

[Spresense SDK スタートガイド (IDE 版)](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html)

# v1.4.100

## Summary

* Feature improvements are available
* This release has a **new [bootloader which have to be loaded](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html#_installing_the_boot_loader)** before use.

## New features and feature enhancements

* [Build] Support Windows11 as one of operation system supported for development environment.
  * The support environment on Windows11 is only WSL2. the environment on Windows11 with MSYS2 is not supported.
  * Build times are significantly reduced using WSL2.

## Improved features

* [SDK Config] Fix an issue that get stuck when there are many search targets when using the search in the SDK config.

* [SerialTerminal] Fixed an issue that the serial terminal may not open automatically after writing the application.

## Contribution

* Add a menu of `Application flash`. (Thanks to @ROMAINPC)

## Confirmation Information

* VSCode: v1.75.1

------------------------

(Below is in Japanese)

## 概要

* 機能改善を行いました。
* 今回のリリースにより **[ブートローダーの更新](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html#_ブートローダのインストール)** が必要になります。

## 新規機能追加および機能拡張

* Windows11に対応しました。
  * Windows11上でのサポート環境はWSL2になります。(Windows11でのMSYS2は非サポートとなります。)
  * WSL2になったことにより、ビルド時間が大幅に短縮されます。

## 改善された機能

* [SDK Config] SDKコンフィグ内での検索を使っている際、検索対象が多い場合固まってしまう問題を修正しました。

* [シリアルターミナル] アプリケーションの書き込み後、自動でシリアルターミナルが開かない場合がある問題を修正しました。

## コントリビューション

* `アプリケーションの書き込み` メニューを追加しました。 (Thanks to @ROMAINPC)

## 動作確認情報

以下のバージョンのVSCodeと組み合わせて動作確認をしています。

* VSCode: v1.75.1

# v1.3.200

(日本語の説明文は英語の後に記載しています。)

## Summary

* Feature improvements are available

## Improved features

* The following minor problems have been corrected.

  * Fix a problem in which some parameters were not reflected when Makefile was edited manually.

  * Fix an unintentional ".vscode/include not found" warning.

------------------------

(Below is in Japanese)

## 概要

* 機能改善を行いました。

## 改善された機能

* 下記の軽微な不具合を修正しました。

  * Makefileを手動で編集した際に一部パラメータが反映されない問題を修正しました。

  * ".vscode/includeが見つかりません" という意図しない警告が表示されないように修正しました。

# v1.3.100

(日本語の説明文は英語の後に記載しています。)

## Summary

* Support for Spresense SDK version 2.3.0 or later.

* This release has a new [bootloader which have to be loaded](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html#_installing_the_boot_loader) before use.
  * Applications will not be able to start without the update. Please make sure to update it.

## Feature enhancements

* Support for Spresense SDK v2.3.0. If you are using Spresense SDK v2.3.0 or later, please upgrade to this version.

* Support for Windows environment installed Python 3.9.5 or later.

* Support for macOS Big Sur.

## Improved features

* Fix a problem that cannot re-build the application that has `worker` if it is cleaned.

------------------------

(Below is in Japanese)

## 概要

* Version 2.3.0以降のSpresense SDKに対応しました。

* 機能拡張および機能改善を行いました。

* 今回のリリースにより [ブートローダーの更新](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html#_ブートローダのインストール) が必要になります。
  * アップデートを行わないとアプリケーションが起動できなくなります。必ず更新を行ってください。

## 新規機能追加および機能拡張

* Spresense SDK v2.3.0に対応しました。これ以降のSpresense SDKをお使いの場合はこのバージョンにバージョンアップしてください。

* Python 3.9.5以降がインストールされたWindows環境に対応しました。

* macOS Big Surに対応しました。

## 改善された機能

* ワーカーを追加している状態でアプリケーションのクリーンを行うと再度ビルドが出来なくなる問題を修正しました。

# v1.2.1

(日本語の説明文は英語の後に記載しています。)

## Summary

* Feature enhancements are available.

* This release has a new [bootloader which have to be loaded](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html#_installing_the_boot_loader) before use.

## Improved features

* [Configuration] Fixed an issue in the configuration function using the "SDK Config".

* [Build System] Fixed build failure for older SDK versions (v1.x series) on macOS.

------------------------

(Below is in Japanese)

## 概要

* 機能拡張および機能改善を行いました。

* 今回のリリースにより [ブートローダーの更新](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html#_ブートローダのインストール) が必要になります。

## 改善された機能

* [Configuration] 「SDKコンフィグ」を利用したコンフィグレーション機能の不具合を改善しました。

* [Build System] macOS環境で古いSDK バージョン（v1.x系）のビルドが失敗する事象を改善しました。

## v1.2.0

(日本語の説明文は英語の後に記載しています。)

### Summary

* Feature enhancements are available

* This release has a new [bootloader which have to be loaded](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html#_installing_the_boot_loader) before use.

### New features and feature enhancements

* [Build System] Support Spresense SDK v2.0.0 new build system.

* [User Interface] Update a configuration user interface.
  * Hierarchical structure is visualized.
  * The selection status is color coded.

    <img src="https://raw.githubusercontent.com/sonydevworld/spresense-vscode-ide/master/images/v1.2.0_config_update_en.png" width="50%">

  * The description is displayed in the preset dialog.

    <img src="https://raw.githubusercontent.com/sonydevworld/spresense-vscode-ide/master/images/v1.2.0_config_preset_update.png" width="20%">

### Improved features

* [Other] Fix a problem that keyword completion does not work when dealing with multiple projects.

------------------------

(Below is in Japanese)

### 概要

* 新規機能追加および機能拡張を行いました

* 今回のリリースにより[ブートローダーの更新](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html#_ブートローダのインストール)が必要になります

### 新規機能追加および機能拡張


* [Build System] Spresense SDK v2.0.0の新ビルドシステムに対応しました。

* [User Interface] コンフィグのユーザインタフェースを更新しました。
  * 階層構造がビジュアル化されるようになりました。
  * 選択状態が色分けされました。

    <img src="https://raw.githubusercontent.com/sonydevworld/spresense-vscode-ide/master/images/v1.2.0_config_update_ja.png" width="50%">

  * プリセットに説明が表示されるようになりました。

    <img src="https://raw.githubusercontent.com/sonydevworld/spresense-vscode-ide/master/images/v1.2.0_config_preset_update.png" width="20%">

### 改善された機能

* [その他] 複数プロジェクトを扱っている場合、一部キーワード補完が効かなくなってしまう問題を修正しました。

## v1.1.0

(日本語の説明文は英語の後に記載しています。)

### Summary

* Feature enhancements are available

* This release has a new [bootloader which have to be loaded](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html#_installing_the_boot_loader) before use.

### New features and feature enhancements

* [UI] Add a wizard to create a workspace easily for the project.

* [UI] Add a wizard to add application commands and ASMP workers easily.

* [Debug] Add supports for ICE debugging of multi-core applications.

### Improved features

* [Config] Fixed the problem that the Kernel/SDK config could not be opened in Ubuntu 18.04 environment.

------------------------

(Below is in Japanese)

### 概要

* 新規機能追加および機能拡張を行いました

* 今回のリリースにより[ブートローダーの更新](https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html#_ブートローダのインストール)が必要になります

### 新規機能追加および機能拡張

* [UI] プロジェクト用のワークスペースを簡単に作成するウィザードを追加しました。

* [UI] アプリケーションコマンドやASMPワーカーを簡単に追加するためのウィザードを追加しました。

* [デバッグ] マルチコアアプリケーションのICEデバッグに対応しました。

### 改善された機能

* [コンフィグ] Ubuntu18.04の環境においてコンフィグが開かない問題を解消しました。

## v1.0.2

(日本語の説明文は英語の後に記載しています。)

### Summary

- Feature improvement is available

### New features and feature enhancements

- [Config] Add Kernel/SDK Config in the right click menu.

### Improved features

- [Build] Add support for using a user name with multi-byte code in a Windows environment.

  - Limitation: https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_en.html#_function_restrictions_by_user_name_and_folder_name

------------------------

(Below is in Japanese)

### 概要

- 新規機能追加および機能拡張を行いました

### 新規機能追加および機能拡張

- [コンフィグ] 右クリックメニューからコンフィグコマンドを実行できるようになりました。

### 改善された機能

- [ビルド] Windows環境でマルチバイトコードが入ったユーザ名を利用していた場合にも対応しました。

  - 制限事項：https://developer.sony.com/develop/spresense/docs/sdk_set_up_ide_ja.html#_ユーザー名やフォルダー名における制限事項

## v1.0.1

(日本語の説明文は英語の後に記載しています。)

### Summary

- Feature improvement is available

### Improved features

- [Config] Fixed an issue where some configuration loads were not correctly reflected.

- [Build] Fixed an issue where the build would not run under certain conditions.

- [Build] Removed an unnecessary warning message when building an application.

- [Build] Fixed an issue that could not be built in a project that contains a hyphen (-) in the folder name.

------------------------

(Below is in Japanese)

### 概要

- 機能改善を行いました

### 改善された機能

- [コンフィグ] コンフィグレーションのロードが一部正しく反映されていない不具合を修正しました。

- [ビルド] 特定の条件下でビルドが実行されない不具合を修正しました。

- [ビルド] アプリケーションのビルド時に不要なWarningが出る不具合を修正しました。

- [ビルド] フォルダー名にハイフン(-)が含まれるプロジェクトでビルドできない不具合を修正しました。

## v1.0.0

(日本語の説明文は英語の後に記載しています。)

- Initial release

(Below is in Japanese)

- 初回リリース
