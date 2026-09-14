package com.expensemanagement.mobile

import android.app.Activity
import android.content.Intent
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class HotUpdateModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val executor = Executors.newSingleThreadExecutor()

    override fun getName(): String = "HotUpdateModule"

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    private fun getOtaDir(): File {
        val dir = File(reactContext.filesDir, "ota_bundle")
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN built-in Event Emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN built-in Event Emitter
    }

    @ReactMethod
    fun getCurrentOtaVersion(promise: Promise) {
        try {
            val versionFile = File(getOtaDir(), "version.txt")
            if (versionFile.exists() && versionFile.isFile) {
                val version = versionFile.readText().trim()
                promise.resolve(version)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.reject("ERR_READ_VERSION", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun downloadUpdate(urlStr: String, targetVersion: String, promise: Promise) {
        executor.execute {
            var connection: HttpURLConnection? = null
            var inputStream: BufferedInputStream? = null
            var outputStream: FileOutputStream? = null

            val otaDir = getOtaDir()
            val tempFile = File(otaDir, "temp_${System.currentTimeMillis()}.bundle")
            val versionFile = File(otaDir, "version.txt")
            val versionedFile = File(otaDir, "bundle_$targetVersion.bundle")
            val legacyFile = File(otaDir, "index.android.bundle")

            try {
                if (tempFile.exists()) {
                    tempFile.delete()
                }

                val url = URL(urlStr)
                connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 15000
                connection.readTimeout = 60000
                connection.instanceFollowRedirects = true
                connection.requestMethod = "GET"
                connection.connect()

                val responseCode = connection.responseCode
                if (responseCode !in 200..299) {
                    throw Exception("Server returned HTTP $responseCode")
                }

                val fileLength = connection.contentLength
                inputStream = BufferedInputStream(connection.inputStream)
                outputStream = FileOutputStream(tempFile)

                val buffer = ByteArray(8192)
                var totalBytesRead: Long = 0
                var bytesRead: Int
                var lastReportedPercent = -1

                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                    totalBytesRead += bytesRead

                    if (fileLength > 0) {
                        val percent = ((totalBytesRead * 100) / fileLength).toInt()
                        if (percent != lastReportedPercent) {
                            lastReportedPercent = percent
                            val params = Arguments.createMap().apply {
                                putDouble("progress", totalBytesRead.toDouble() / fileLength.toDouble())
                                putInt("percentage", percent)
                                putDouble("bytesDownloaded", totalBytesRead.toDouble())
                                putDouble("totalBytes", fileLength.toDouble())
                            }
                            sendEvent("onDownloadProgress", params)
                        }
                    }
                }

                outputStream.flush()
                outputStream.close()
                outputStream = null

                if (tempFile.length() == 0L) {
                    throw Exception("Downloaded bundle is empty")
                }

                // 1. Save versioned bundle file (safe from file lock collisions)
                if (versionedFile.exists()) {
                    versionedFile.delete()
                }
                tempFile.copyTo(versionedFile, overwrite = true)

                // 2. Also update index.android.bundle safely for backwards compatibility
                try {
                    val trash = File(otaDir, "trash_${System.currentTimeMillis()}")
                    if (legacyFile.exists()) {
                        legacyFile.renameTo(trash)
                        trash.delete()
                    }
                    tempFile.copyTo(legacyFile, overwrite = true)
                } catch (_: Exception) {
                    // Ignored if legacy file is locked, versionedFile is primary
                }

                tempFile.delete()

                // 3. Write active version manifest
                versionFile.writeText(targetVersion)

                // 4. Cleanup older versioned bundles
                try {
                    otaDir.listFiles()?.forEach { f ->
                        if (f.isFile && f.name.startsWith("bundle_") && f.name.endsWith(".bundle") && f.name != versionedFile.name) {
                            f.delete()
                        }
                    }
                } catch (_: Exception) {}

                val completeParams = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("version", targetVersion)
                }
                sendEvent("onDownloadComplete", completeParams)

                promise.resolve(completeParams)

            } catch (e: Exception) {
                if (tempFile.exists()) {
                    tempFile.delete()
                }
                promise.reject("ERR_DOWNLOAD_FAILED", e.localizedMessage, e)
            } finally {
                try {
                    inputStream?.close()
                    outputStream?.close()
                    connection?.disconnect()
                } catch (_: Exception) {}
            }
        }
    }

    @ReactMethod
    fun reloadApp() {
        val activity: Activity? = currentActivity

        UiThreadUtil.runOnUiThread {
            try {
                if (activity != null) {
                    // Full process-level restart: kills the current task and relaunches from scratch.
                    // This ensures getJSBundleFile() is called again and the new OTA bundle is picked up.
                    val packageName = activity.packageName
                    val launchIntent = activity.packageManager.getLaunchIntentForPackage(packageName)
                    if (launchIntent != null) {
                        launchIntent.addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP
                        )
                        activity.startActivity(launchIntent)
                        // Finish all activities in the stack so the process restarts cleanly
                        activity.finishAffinity()
                        // Kill the current process after a tiny delay so the new intent is queued
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            android.os.Process.killProcess(android.os.Process.myPid())
                        }, 300)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                // Last-resort fallback: just finish and relaunch
                try {
                    activity?.let {
                        val intent = it.packageManager.getLaunchIntentForPackage(it.packageName)
                        if (intent != null) {
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                            it.startActivity(intent)
                            it.finishAffinity()
                        }
                    }
                } catch (_: Exception) {}
            }
        }
    }

    @ReactMethod
    fun clearUpdates(promise: Promise) {
        try {
            val otaDir = getOtaDir()
            if (otaDir.exists()) {
                otaDir.deleteRecursively()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_CLEAR_FAILED", e.localizedMessage, e)
        }
    }
}
