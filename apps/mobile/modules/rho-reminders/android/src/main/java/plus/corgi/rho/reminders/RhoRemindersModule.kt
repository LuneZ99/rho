package plus.corgi.rho.reminders

import android.app.*
import android.content.*
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class RhoRemindersModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RhoReminders")
    AsyncFunction("sync") { json: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("App context unavailable")
      ReminderEngine.sync(context, JSONArray(json))
      ReminderEngine.status(context).toString()
    }
    AsyncFunction("status") {
      val context = appContext.reactContext ?: throw IllegalStateException("App context unavailable")
      ReminderEngine.fire(context)
      ReminderEngine.status(context).toString()
    }
    AsyncFunction("openSettings") {
      val context = appContext.reactContext ?: throw IllegalStateException("App context unavailable")
      val intent = if (Build.VERSION.SDK_INT >= 31 && !context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()) {
        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
      } else Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
class ReminderReceiver : BroadcastReceiver() { override fun onReceive(context: Context, intent: Intent) { ReminderEngine.fire(context) } }
class RestoreReceiver : BroadcastReceiver() { override fun onReceive(context: Context, intent: Intent) { ReminderEngine.fire(context) } }

object ReminderEngine {
  private const val CHANNEL = "rho-reminders"
  private fun prefs(c: Context) = c.getSharedPreferences("rho-reminders", Context.MODE_PRIVATE)
  private fun rows(c: Context) = JSONObject(prefs(c).getString("rows", "{}")!!)
  private fun ledger(c: Context) = JSONObject(prefs(c).getString("ledger", "{}")!!)
  private fun manager(c: Context) = c.getSystemService(NotificationManager::class.java)
  private fun enabled(c: Context): Boolean = manager(c).areNotificationsEnabled() && (manager(c).getNotificationChannel(CHANNEL)?.importance ?: 3) != NotificationManager.IMPORTANCE_NONE
  private fun channel(c: Context) { manager(c).createNotificationChannel(NotificationChannel(CHANNEL, "事项提醒", NotificationManager.IMPORTANCE_HIGH).apply { description = "已同步到手机的事项提醒，断网仍然有效" }) }
  private fun alarm(c: Context): PendingIntent = PendingIntent.getBroadcast(c, 18870, Intent(c, ReminderReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  @Synchronized fun sync(c: Context, incoming: JSONArray) {
    channel(c)
    val previous = rows(c); val next = JSONObject()
    for (i in 0 until incoming.length()) {
      val r = incoming.getJSONObject(i)
      if (!r.getBoolean("active")) continue
      val id = r.getString("id"); val old = previous.optJSONObject(id)
      if (old != null && old.getInt("version") == r.getInt("version")) next.put(id, old)
      else { r.put("nextAt", OffsetDateTime.parse(r.getString("at")).toInstant().toEpochMilli()); next.put(id, r) }
    }
    prefs(c).edit().putString("rows", next.toString()).commit()
    fire(c)
  }
  @Synchronized fun fire(c: Context) {
    channel(c)
    val all = rows(c); val sent = ledger(c); val now = System.currentTimeMillis()
    val due = mutableListOf<Pair<String, JSONObject>>()
    for (id in all.keys()) {
      val r = all.getJSONObject(id); val time = r.getLong("nextAt")
      if (time > 0 && time <= now) {
        if (r.getString("repeat") == "once") due.add(id to r)
        else {
          var occurrence = Instant.ofEpochMilli(time).atZone(ZoneId.of(r.getString("timezone")))
          val step = if (r.getString("repeat") == "daily") 1L else 7L
          while (occurrence.toInstant().toEpochMilli() <= now) {
            due.add(id to JSONObject(r.toString()).put("nextAt", occurrence.toInstant().toEpochMilli()))
            occurrence = occurrence.plusDays(step)
          }
        }
      }
    }
    if (enabled(c) && due.isNotEmpty()) {
      val pending = due.filter { (id, r) -> !sent.has("$id:${r.getInt("version")}:${r.getLong("nextAt")}") }
      val missed = pending.any { now - it.second.getLong("nextAt") > 300000 }
      if (pending.isNotEmpty()) {
        if (missed || pending.size > 1) {
          val lines = pending.map { (_, r) -> r.getString("title") + " · " + Instant.ofEpochMilli(r.getLong("nextAt")).atZone(ZoneId.of(r.getString("timezone"))).format(DateTimeFormatter.ofPattern("M月d日 HH:mm")) }
          notify(c, pending.first().first.hashCode(), if (missed) "有 ${pending.size} 条错过的提醒" else "有 ${pending.size} 条事项提醒", lines.take(20).joinToString("\n"), "rho://reminders")
        } else {
          val (id,r) = pending.first(); notify(c, id.hashCode(), r.getString("title"), "点击查看事项", "rho://item/${r.getString("itemId")}")
        }
        for ((id,r) in pending) sent.put("$id:${r.getInt("version")}:${r.getLong("nextAt")}", JSONObject().put("title",r.getString("title")).put("at",r.getLong("nextAt")).put("itemId",r.getString("itemId")).put("deliveredAt",now).put("missed",missed))
      }
      for ((id,r) in due) {
        var next = Instant.ofEpochMilli(r.getLong("nextAt")).atZone(ZoneId.of(r.getString("timezone")))
        when (r.getString("repeat")) {
          "once" -> r.put("nextAt", 0)
          "daily", "weekly" -> {
            val step = if (r.getString("repeat") == "daily") 1L else 7L
            val elapsedDays = java.time.temporal.ChronoUnit.DAYS.between(next.toLocalDate(), Instant.ofEpochMilli(now).atZone(next.zone).toLocalDate())
            next = next.plusDays(maxOf(0L, elapsedDays / step) * step)
            while (next.toInstant().toEpochMilli() <= now) next = next.plusDays(step)
            r.put("nextAt", next.toInstant().toEpochMilli())
          }
        }
        all.put(id, r)
      }
      prefs(c).edit().putString("rows", all.toString()).putString("ledger", sent.toString()).commit()
    }
    schedule(c, all)
  }
  private fun notify(c: Context, id: Int, title: String, text: String, uri: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).setPackage(c.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val tap = PendingIntent.getActivity(c, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    manager(c).notify(id, Notification.Builder(c, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle(title).setContentText(text).setStyle(Notification.BigTextStyle().bigText(text)).setContentIntent(tap).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PRIVATE).build())
  }
  private fun schedule(c: Context, all: JSONObject) {
    val am = c.getSystemService(AlarmManager::class.java); am.cancel(alarm(c))
    if (!enabled(c)) return
    val next = all.keys().asSequence().map { all.getJSONObject(it).getLong("nextAt") }.filter { it > 0 }.minOrNull() ?: return
    val at = maxOf(System.currentTimeMillis() + 1000, next)
    if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
      val show = PendingIntent.getActivity(c, 18870, Intent(Intent.ACTION_VIEW, Uri.parse("rho://reminders")).setPackage(c.packageName), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      am.setAlarmClock(AlarmManager.AlarmClockInfo(at, show), alarm(c))
    }
    else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarm(c))
  }
  @Synchronized fun status(c: Context): JSONObject {
    val installed = JSONObject(); val all = rows(c); val sent = ledger(c)
    for (id in all.keys()) installed.put(id, all.getJSONObject(id).getInt("version"))
    val am = c.getSystemService(AlarmManager::class.java)
    val receiptKeys = sent.keys().asSequence().toList().sortedBy { sent.getJSONObject(it).getLong("deliveredAt") }.takeLast(1000)
    val history = JSONArray(); for (key in receiptKeys) history.put(sent.getJSONObject(key).put("key", key))
    return JSONObject().put("installedReminderVersions", installed).put("notificationPermission", enabled(c)).put("exactAlarmPermission", Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()).put("receipts", JSONArray(receiptKeys)).put("history",history)
  }
}
