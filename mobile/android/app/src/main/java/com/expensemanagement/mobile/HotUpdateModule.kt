package com.expensemanagement.mobile

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
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
            val tempFile = File(otaDir, "temp_bundle.js")
            val targetFile = File(otaDir, "index.android.bundle")
            val versionFile = File(otaDir, "version.txt")

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

                // Atomic rename to production bundle file
                if (targetFile.exists()) {
                    targetFile.delete()
                }
                val renamed = tempFile.renameTo(targetFile)
                if (!renamed) {
                    // Fallback copy if rename fails
                    tempFile.copyTo(targetFile, overwrite = true)
                    tempFile.delete()
                }

                // Record active OTA version
                versionFile.writeText(targetVersion)

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
        if (activity == null) {
            return
        }

        activity.runOnUiThread {
            try {
                val launchIntent = activity.packageManager.getLaunchIntentForPackage(activity.packageName)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    activity.startActivity(launchIntent)
                    activity.finish()
                    Runtime.getRuntime().exit(0)
                }
            } catch (e: Exception) {
                e.printStackTrace()
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
