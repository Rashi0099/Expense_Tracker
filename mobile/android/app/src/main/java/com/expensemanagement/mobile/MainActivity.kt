package com.expensemanagement.mobile

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.graphics.Color
import android.graphics.Typeface
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  private var privacyOverlay: FrameLayout? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Request notification permission for Android 13+ (API 33)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
      }
    }
  }

  override fun onPause() {
    super.onPause()
    showNativePrivacyShield()
  }

  override fun onResume() {
    super.onResume()
    hideNativePrivacyShield()
  }

  private fun showNativePrivacyShield() {
    if (privacyOverlay != null) return
    try {
      val rootView = window.decorView as? ViewGroup ?: return
      val overlay = FrameLayout(this).apply {
        layoutParams = FrameLayout.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        setBackgroundColor(Color.parseColor("#0F1729"))
        isClickable = true
        isFocusable = true

        val container = LinearLayout(context).apply {
          orientation = LinearLayout.VERTICAL
          gravity = Gravity.CENTER
          layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
          )

          // App Logo
          val logoView = ImageView(context).apply {
            setImageResource(R.mipmap.ic_launcher)
            val size = TypedValue.applyDimension(
              TypedValue.COMPLEX_UNIT_DIP, 80f, resources.displayMetrics
            ).toInt()
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
              bottomMargin = TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 16f, resources.displayMetrics
              ).toInt()
              gravity = Gravity.CENTER_HORIZONTAL
            }
          }
          addView(logoView)

          // Title: Spending Book
          val titleView = TextView(context).apply {
            text = "Spending Book"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER_HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
              ViewGroup.LayoutParams.WRAP_CONTENT,
              ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
              bottomMargin = TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 8f, resources.displayMetrics
              ).toInt()
            }
          }
          addView(titleView)

          // Subtitle: 🔒 Financial details protected
          val subtitleView = TextView(context).apply {
            text = "🔒 Financial details protected"
            setTextColor(Color.parseColor("#9AAAC8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            gravity = Gravity.CENTER_HORIZONTAL
          }
          addView(subtitleView)
        }
        addView(container)
      }
      rootView.addView(overlay)
      privacyOverlay = overlay
    } catch (_: Exception) {}
  }

  private fun hideNativePrivacyShield() {
    privacyOverlay?.let { overlay ->
      (window.decorView as? ViewGroup)?.removeView(overlay)
      privacyOverlay = null
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ExpenseManagementMobile"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
