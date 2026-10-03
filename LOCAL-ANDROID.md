# All News Android

Open the `android` directory in Android Studio. The application ID remains
`com.rssallnews.allnews`, matching the existing All News Play Store app.

The native Kotlin WebView shell was restored from the PC backup. Gradle packages
the repository's `public/` directory directly, so web and Android use the same
HTML, JavaScript and CSS. Pull Git updates in the repository root before building.

The WebView serves packaged files at
`https://appassets.androidplatform.net/assets/index.html`. It enables DOM storage,
uses the frontend's HTTPS API endpoint, and opens article links in the browser.

## Build and run

Android Studio, Android SDK platform 36, build tools 35 and a private JDK 17
installation are set up on this PC. The SDK is at `%USERPROFILE%/Android/Sdk`
and Java is under `%USERPROFILE%/.jdks`. The wrapper uses Gradle 8.11.1 with Android
Gradle Plugin 8.10.1, targeting Android 16 / API 36. Its Java 17
setting is in the ignored `android/.gradle/config.properties`. Android Studio's
newer bundled Java is not used for this older Gradle project.

From the repository root:

```powershell
npm start
npm run android:debug
npm run android:bundle
```

The website runs at `http://localhost:3000`. The Android scripts select JDK 17
without changing your system-wide Java settings. Set `ALLNEWS_JAVA_HOME` to
override that selection. The SDK path is in the ignored `android/local.properties`.
Node.js is required: the build script regenerates `public/privacy.html` from
`public/privacy-policy.txt` before packaging the web assets.

To install on a running emulator or an authorized USB debugging device:

```powershell
npm run android:debug -- installDebug
```

The debug variant uses the normal Android debug key and needs no upload key.

## Release signing

Set the Gradle property `allNewsSigningProperties` to the absolute path of a private
properties file outside this repository. For Android Studio and command-line
builds on this PC, the path can be configured in the user's
`%USERPROFILE%/.gradle/gradle.properties`. Use forward slashes in Windows paths.

The external signing file must supply `storeFile`, `storePassword`, `keyAlias`
and `keyPassword`. `storeFile` may be absolute or relative to that properties file.
Keep the keystore and this file outside the repository; never commit passwords.

On this PC the upload key alias is `allnews-upload`. Its private signing settings
are already configured under `%USERPROFILE%/AndroidSigningKeys/AllNews/2026-10-01/`.
The encrypted key and public certificate also have a backup on
`E:/AllNews-signing-key-backup/2026-10-01/`. The password is not in Git.
Google Play confirmed this upload key active on 3 October 2026 after 22:01 Israel
time (19:01 UTC). Upload eligibility and policy review must still be checked in
Play Console before submitting a release.

```powershell
npm run android:bundle
```

Release builds stop with a configuration message if the signing file is absent or
incomplete. This release is `1.1.37` (code `37`), following the internal testing
release `1.1.36` published on 3 October 2026. Increase the version code for each
future Play upload. Local builds do not upload or publish anything.

The WebView applies Android 16 system-bar, cutout and keyboard insets so controls
remain accessible. Android's Back action returns from bundled Contact/Privacy
pages to the feed. Android backup remains enabled for app data, including local
reading preferences and any saved-story metadata retained from older versions.

## Public policy pages

The editable source is `public/privacy-policy.txt`. Run
`node scripts/build-policy.cjs` to regenerate `public/privacy.html`; the Android
build script does this automatically.

- Privacy: https://renanbazinin.github.io/allNews/public/privacy.html
- Contact: https://renanbazinin.github.io/allNews/public/contact.html

GitHub Pages publishes the repository root from `main`, including the mobile
redesign and these public pages. When changing the policy, regenerate the HTML
and commit both files to `main`; the Android bundle packages the same pages.

## References

- [Android: load in-app WebView content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [AndroidX WebKit releases](https://developer.android.com/jetpack/androidx/releases/webkit)
- [AGP 8.10 compatibility](https://developer.android.com/build/releases/agp-8-10-0-release-notes)
- [Android 16 behavior changes](https://developer.android.com/about/versions/16/behavior-changes-16)
