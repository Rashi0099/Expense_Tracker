package com.expensemanagement.mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import java.util.Calendar

class DailyReminderReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_ID = "expense_daily_reminders"
        const val CHANNEL_NAME = "Daily Expense Reminders"
        const val EXTRA_REMINDER_TYPE = "extra_reminder_type"

        const val TYPE_MORNING = "MORNING"
        const val TYPE_AFTERNOON = "AFTERNOON"
        const val TYPE_NIGHT = "NIGHT"

        const val NOTIF_ID_MORNING = 2001
        const val NOTIF_ID_AFTERNOON = 2002
        const val NOTIF_ID_NIGHT = 2003

        fun createNotificationChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Morning, afternoon, and night reminders to update expenses"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 250, 150, 250)
                }
                val notificationManager =
                    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val reminderType = intent.getStringExtra(EXTRA_REMINDER_TYPE) ?: TYPE_NIGHT
        createNotificationChannel(context)

        val (title, body, notifId) = when (reminderType) {
            TYPE_MORNING -> Triple(
                "Good Morning! ☀️",
                "Don't forget to track your morning expenses & breakfast spending.",
                NOTIF_ID_MORNING
            )
            TYPE_AFTERNOON -> Triple(
                "Afternoon Check-in 🥪",
                "Did you have lunch or coffee? Don't forget to record your expenses!",
                NOTIF_ID_AFTERNOON
            )
            else -> Triple(
                "Daily Expense Review 🌙",
                "Take 30 seconds to review and update today's expenses.",
                NOTIF_ID_NIGHT
            )
        }

        // Tap action: Launch MainActivity with quick-add intent
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            data = Uri.parse("expense-tracker://quick-add")
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            notifId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val largeIcon = android.graphics.BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
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
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(notifId, builder.build())

        // Reschedule next occurrence for this slot 24 hours later
        val hour = when (reminderType) {
            TYPE_MORNING -> 9
            TYPE_AFTERNOON -> 14
            else -> 21
        }
        val requestCode = when (reminderType) {
            TYPE_MORNING -> 101
            TYPE_AFTERNOON -> 102
            else -> 103
        }
        ReminderNotificationModule.scheduleSlot(context, reminderType, hour, 0, requestCode)
    }
}
