# Spresense Extension テスト

このテストは、SDKコンフィギュレーションツールで使用しているWebViewコンテンツ内のJavascriptコードのテストをChromeを使用して行うためのプログラムです。

テスト用プログラムはPythonで書かれていますが、`resources/config/main.js`はVSCode拡張機能と連動するため、これをエミュレーションする必要があります。それらはJavascriptで書かれており、Pythonテストスクリプトと連携して動作します。

WebViewコンテンツとなるHTMLドキュメント`index.html`は、WebViewで使用するためにセキュリティメタデータが埋め込まれていますが、テストでは必要ないため実行時に削除されます。テスト対象である`resources/config/main.js`は改変なしで読み込まれ、テストが実行されます。

## 動作環境

- Ubuntu 18.04以上
- python3
- chromiumブラウザ
- chromium用WebDriver

## セットアップ

下記の方法でテストに必要なアプリケーションおよびライブラリをインストールします。既にインストールされている場合はスキップしてください。

### ChromiumブラウザおよびWebDriverのインストール

```
$ sudo apt install chromium-browser chromium-chromedriver
```

### Seleniumのインストール

```
$ python3 -m pip install selenium
```

## テストの実行

テストを実行する場合は`spresense-vscode-ide/test`以下で`test.py`スクリプトを実行します。

```
$ cd spresense-vscode-ide/test
$ ./test.py
```

引数には、実行したいテストスイート名を指定することができます。省略した場合はすべてのテストスイートを実行します。
デフォルトでは、Chromiumブラウザウィンドウは表示されません。`-nc`オプションを指定するとウィンドウが表示されますが、テストの実行には影響しません。ブラウザの表示・非表示にかかわらず、スクリーンショットは保存されます。

```
usage: test.py [-h] [-d] [-nc] [TESTSUITE [TESTSUITE ...]]

positional arguments:
  TESTSUITE    test suite name(s) ['evaluate', 'menu', 'bool', 'choice',
               'defconfig']

optional arguments:
  -h, --help   show this help message and exit
  -d, --debug  debug mode, test is not run
  -nc          show window and not close when test finished
```

※ TESTSUITEは今後追加される予定です。最新のヘルプメッセージを参照してください。
