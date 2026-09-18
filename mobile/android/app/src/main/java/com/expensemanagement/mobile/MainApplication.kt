package com.expensemanagement.mobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.flipper.ReactNativeFlipper
import com.facebook.soloader.SoLoader
import java.io.File

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> {
          val packages = PackageList(this).packages.toMutableList()
          packages.add(HotUpdatePackage())
          packages.add(ReminderNotificationPackage())
          packages.add(FileSharePackage())
          return packages
        }

        override fun getJSBundleFile(): String? {
          val otaDir = File(applicationContext.filesDir, "ota_bundle")
          if (!otaDir.exists()) {
            return super.getJSBundleFile()
          }

          try {
            val packageInfo = applicationContext.packageManager.getPackageInfo(applicationContext.packageName, 0)
            val apkLastUpdateTime = packageInfo.lastUpdateTime
            val versionFile = File(otaDir, "version.txt")

            // If versionFile doesn't exist, or was created before this APK was installed/updated,
            // the APK binary is newer: purge the OTA directory and load default bundle.
            if (!versionFile.exists() || versionFile.lastModified() < apkLastUpdateTime) {
              otaDir.deleteRecursively()
              return super.getJSBundleFile()
            }

            val version = versionFile.readText().trim()
            if (version.isNotEmpty()) {
              val versionedBundle = File(otaDir, "bundle_$version.bundle")
              if (versionedBundle.exists() && versionedBundle.isFile && versionedBundle.length() > 100000) {
                return versionedBundle.absolutePath
              }
              val defaultOtaBundle = File(otaDir, "index.android.bundle")
              if (defaultOtaBundle.exists() && defaultOtaBundle.isFile && defaultOtaBundle.length() > 100000) {
                return defaultOtaBundle.absolutePath
              }
            }
          } catch (e: Exception) {
            e.printStackTrace()
          }

          return super.getJSBundleFile()
        }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(this.applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    ReactNativeFlipper.initializeFlipper(this, reactNativeHost.reactInstanceManager)
  }
}
