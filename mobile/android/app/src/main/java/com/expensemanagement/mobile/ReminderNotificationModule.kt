package com.expensemanagement.mobile

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Calendar

class ReminderNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ReminderNotificationModule"

    companion object {
        const val REQ_MORNING = 101
        const val REQ_AFTERNOON = 102
        const val REQ_NIGHT = 103

        fun scheduleSlot(context: Context, type: String, hour: Int, minute: Int, requestCode: Int) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return

            val intent = Intent(context, DailyReminderReceiver::class.java).apply {
                putExtra(DailyReminderReceiver.EXTRA_REMINDER_TYPE, type)
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val calendar = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                if (timeInMillis <= System.currentTimeMillis()) {
                    add(Calendar.DAY_OF_YEAR, 1)
                }
            }

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        calendar.timeInMillis,
                        pendingIntent
                    )
                } else {
                    alarmManager.setExact(
                        AlarmManager.RTC_WAKEUP,
                        calendar.timeInMillis,
                        pendingIntent
                    )
                }
            } catch (_: Exception) {
                // In case exact alarm permission is restricted, fallback to inexact
                alarmManager.set(
                    AlarmManager.RTC_WAKEUP,
                    calendar.timeInMillis,
                    pendingIntent
                )
            }
        }

        fun scheduleAllReminders(context: Context) {
            DailyReminderReceiver.createNotificationChannel(context)

            // 1. Morning Reminder (09:00 AM)
            scheduleSlot(context, DailyReminderReceiver.TYPE_MORNING, 9, 0, REQ_MORNING)

            // 2. Afternoon Reminder (02:00 PM / 14:00)
            scheduleSlot(context, DailyReminderReceiver.TYPE_AFTERNOON, 14, 0, REQ_AFTERNOON)

            // 3. Night Reminder (09:00 PM / 21:00)
            scheduleSlot(context, DailyReminderReceiver.TYPE_NIGHT, 21, 0, REQ_NIGHT)
        }

        fun cancelAllReminders(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val requestCodes = listOf(REQ_MORNING, REQ_AFTERNOON, REQ_NIGHT)
            for (code in requestCodes) {
                val intent = Intent(context, DailyReminderReceiver::class.java)
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    code,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                alarmManager.cancel(pendingIntent)
            }
        }
    }

    @ReactMethod
    fun scheduleDailyReminders(promise: Promise) {
        try {
            scheduleAllReminders(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_SCHEDULE", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun cancelReminders(promise: Promise) {
        try {
            cancelAllReminders(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_CANCEL", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun sendTestNotification(typeStr: String?, promise: Promise) {
        try {
            DailyReminderReceiver.createNotificationChannel(reactContext)

            val type = typeStr?.uppercase() ?: DailyReminderReceiver.TYPE_NIGHT
            val (title, body, notifId) = when (type) {
                "MORNING" -> Triple(
                    "Good Morning! ☀️",
                    "Don't forget to track your morning expenses & breakfast spending.",
                    DailyReminderReceiver.NOTIF_ID_MORNING
                )
                "AFTERNOON" -> Triple(
                    "Afternoon Check-in 🥪",
                    "Did you have lunch or coffee? Don't forget to record your expenses!",
                    DailyReminderReceiver.NOTIF_ID_AFTERNOON
                )
                else -> Triple(
                    "Daily Expense Review 🌙",
                    "Take 30 seconds to review and update today's expenses.",
                    DailyReminderReceiver.NOTIF_ID_NIGHT
                )
            }

            val launchIntent = Intent(reactContext, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                data = Uri.parse("expense-tracker://quick-add")
            }
            val pendingIntent = PendingIntent.getActivity(
                reactContext,
                notifId,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val largeIcon = android.graphics.BitmapFactory.decodeResource(reactContext.resources, R.mipmap.ic_launcher)

            val builder = NotificationCompat.Builder(reactContext, DailyReminderReceiver.CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setLargeIcon(largeIcon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setSound(soundUri)
                .setVibrate(longArrayOf(0, 250, 150, 250))
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)

            val notificationManager =
                reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(notifId, builder.build())

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_TEST_NOTIF", e.localizedMessage, e)
        }
    }
}
