# 八卦弈魂 · TapTap 发布构建说明

## 当前 Android 包

- 包名：`com.huli.baguayihun`
- 版本：`1.0` / versionCode `1`
- 方向：**竖屏**（`android:screenOrientation="portrait"`）
- 最低 Android：24
- Target SDK：36
- 技术栈：Capacitor + Android WebView
- 签名文件：`/Users/huli/Desktop/八卦弈魂-TapTap/bagua-release.jks`
- 签名别名：`bagua`
- 本地 APK：`/Users/huli/Desktop/八卦弈魂-TapTap/八卦弈魂-1.0-portrait.apk`

> keystore 和密码只保存在本机，不能丢；以后更新必须使用同一个签名。

## 重新构建

```bash
# 1. 在临时构建目录安装 Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. 把当前网页资源复制到 www/
#    pixel.html -> www/index.html
#    src/、assets/pixel、assets/art/cards-pixel、assets/fonts、assets/audio
#    复制 pixel.css / mobile.css / styles.css

# 3. 同步 Android 工程
npx cap sync android

# 4. release 签名包
cd android
ANDROID_HOME=$HOME/Library/Android/sdk ANDROID_SDK_ROOT=$HOME/Library/Android/sdk \
  ./gradlew assembleRelease
```

构建产物：`android/app/build/outputs/apk/release/app-release.apk`。

## 发布前必须处理

1. **BGM**：APK 不包含网易云《天地缓缓》，只带原创环境音回落；正式包必须使用自有/已授权音乐。
2. **素材权属**：卡图、字体（FusionPixel）、即梦生成素材保留授权或生成记录，移除所有第三方水印。
3. **隐私政策**：准备可访问链接、权限说明、第三方 SDK 清单、个人信息收集说明。
4. **防沉迷/实名**：接入合规实名与未成年人限制，TapTap 资质审核会要求演示视频。
5. **APP 备案 / ICP**：有联网服务时准备 APP 备案和 ICP；包名、签名、备案主体必须一致。
6. **版号**：无版号只能走试玩/开放试玩，不能有付费内容；正式下载/内购需要 ISBN，通常要找有资质的出版社/发行商。
7. **版本号**：每次正式提审前递增 versionCode/versionName。

## TapTap 后台流程

1. 注册 TapTap 账号，完成实名认证。
2. 开发者中心申请认证开发者（个人或企业）。
3. 首页 → 创建游戏 → 常规发布 → 手机。
4. 商店 → 当前版本 → 未发布版本 → 上传 APK。
5. 资质与审核 → 游戏资质提交软著、APP 备案、防沉迷、隐私材料。
6. 提交版本审核；版本约 1–3 天，资质约 5–7 天（以官方审核为准）。
7. 先内部测试，再开封闭/开放测试；测试前 72 小时上传 APK 和资质。
8. 选择「正式上线」或「正式上线试玩版」，设置立即/定时上线。
9. 商店素材：图标 512×512、至少 3 张竖屏截图（720×1280 以上）、16:9 宣传图 1920×1080、15 秒以上实机视频。
