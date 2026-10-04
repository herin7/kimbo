package expo.modules.kimboactivity

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlin.math.max
import kotlin.math.min

private const val NOTIFICATION_CHANNEL_ID = "kimbo_activity"
private const val NOTIFICATION_ID = 4012
private const val ACTION_START = "expo.modules.kimboactivity.START"
private const val ACTION_UPDATE = "expo.modules.kimboactivity.UPDATE"
private const val EXTRA_CURRENT = "current"
private const val EXTRA_TARGET = "target"
private const val EXTRA_STARTING_STEPS = "startingSteps"
private const val EXTRA_STARTED_AT = "startedAt"
private const val EXTRA_PREFER_LIVE_UPDATE = "preferLiveUpdate"
private const val EXTRA_IS_ACTIVITY = "isActivity"
private const val ISLAND_PREFERENCES = "kimbo_island_preferences"
private const val ISLAND_ENABLED_KEY = "island_enabled"

internal data class ActivityProgress(
  val current: Int,
  val target: Int,
  val startingSteps: Int,
  val startedAtMillis: Long,
  val preferLiveUpdate: Boolean,
  val isActivity: Boolean = true
)

class ActivityLiveService : Service() {
  private var island: SystemActivityIsland? = null
  private var latestProgress: ActivityProgress? = null
  private var isForeground = false
  private val mainHandler = Handler(Looper.getMainLooper())
  private val elapsedTimeTicker = object : Runnable {
    override fun run() {
      latestProgress?.let(::present)
      mainHandler.postDelayed(this, 30_000L)
    }
  }

  override fun onCreate() {
    super.onCreate()
    activeService = this
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val progress = intent?.toProgress() ?: return START_NOT_STICKY
    latestProgress = progress
    present(progress)
    mainHandler.removeCallbacks(elapsedTimeTicker)
    mainHandler.postDelayed(elapsedTimeTicker, 30_000L)
    return START_NOT_STICKY
  }

  private fun present(progress: ActivityProgress) {
    val notification = createActivityNotification(this, progress)
    if (isForeground) {
      // Re-calling startForeground from the background with a while-in-use type would throw.
      (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification)
    } else {
      startForegroundOnce(notification)
      isForeground = true
    }

    val shouldShowIsland = isOverlayEnabled(this) &&
      Settings.canDrawOverlays(this)
    if (shouldShowIsland) {
      if (island == null) island = SystemActivityIsland(this)
      island?.show(progress)
    } else {
      island?.remove()
      island = null
    }
  }

  /**
   * One stable type set for the service's lifetime. The microphone type lets the island record a
   * meal while Kimbo is in the background, which Android only allows when the service was started
   * while the app was visible, so it is included only when that is possible and permitted.
   */
  private fun startForegroundOnce(notification: android.app.Notification) {
    var types = 0
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
      if (isGranted(Manifest.permission.ACTIVITY_RECOGNITION)) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
    }
    val withMicrophone = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && isGranted(Manifest.permission.RECORD_AUDIO)) {
      types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    } else {
      types
    }
    try {
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, withMicrophone)
      canUseMicrophone = withMicrophone != types
    } catch (_: SecurityException) {
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, types)
      canUseMicrophone = false
    }
  }

  private fun isGranted(permission: String) =
    ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

  override fun onDestroy() {
    activeService = null
    mainHandler.removeCallbacks(elapsedTimeTicker)
    latestProgress = null
    island?.remove()
    island = null
    super.onDestroy()
  }

  companion object {
    @Volatile private var activeService: ActivityLiveService? = null
    /** Whether the running service may record audio while Kimbo is in the background. */
    @Volatile internal var canUseMicrophone = false

    internal fun updateMeal(meal: IslandMeal) {
      activeService?.let { service -> service.mainHandler.post { service.island?.showMeal(meal) } }
    }

    internal fun isOverlayEnabled(context: Context): Boolean =
      context.getSharedPreferences(ISLAND_PREFERENCES, Context.MODE_PRIVATE)
        .getBoolean(ISLAND_ENABLED_KEY, false)

    internal fun setOverlayEnabled(context: Context, isEnabled: Boolean) {
      context.getSharedPreferences(ISLAND_PREFERENCES, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(ISLAND_ENABLED_KEY, isEnabled)
        .apply()
      activeService?.let { service ->
        service.mainHandler.post {
          // Called while Kimbo is visible: the one moment Android lets us add the microphone type.
          if (isEnabled && !canUseMicrophone) service.isForeground = false
          service.latestProgress?.let(service::present)
          if (!isEnabled) {
            service.island?.remove()
            service.island = null
            if (service.latestProgress?.isActivity != true) stop(context)
          }
        }
      }
      if (isEnabled && Settings.canDrawOverlays(context) && activeService == null) {
        startMode(context)
      }
    }

    internal fun updateSnapshot(context: Context, snapshot: IslandSnapshot) {
      snapshot.save(context)
      activeService?.let { service ->
        service.mainHandler.post { service.latestProgress?.let(service::present) }
      }
    }

    internal fun start(context: Context, progress: ActivityProgress) {
      ContextCompat.startForegroundService(context, serviceIntent(context, ACTION_START, progress))
    }

    internal fun update(context: Context, progress: ActivityProgress) {
      val service = activeService
      if (service != null) {
        service.mainHandler.post {
          service.latestProgress = progress
          service.present(progress)
        }
      } else {
        ContextCompat.startForegroundService(context, serviceIntent(context, ACTION_UPDATE, progress))
      }
    }

    internal fun stop(context: Context) {
      if (isOverlayEnabled(context) && Settings.canDrawOverlays(context)) {
        update(context, idleProgress())
      } else {
        context.stopService(Intent(context, ActivityLiveService::class.java))
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
      }
    }

    private fun startMode(context: Context) =
      ContextCompat.startForegroundService(context, serviceIntent(context, ACTION_START, idleProgress()))

    private fun idleProgress() =
      ActivityProgress(0, 8_000, 0, System.currentTimeMillis(), false, false)

    private fun serviceIntent(context: Context, action: String, progress: ActivityProgress) =
      Intent(context, ActivityLiveService::class.java)
        .setAction(action)
        .putExtra(EXTRA_CURRENT, progress.current)
        .putExtra(EXTRA_TARGET, progress.target)
        .putExtra(EXTRA_STARTING_STEPS, progress.startingSteps)
        .putExtra(EXTRA_STARTED_AT, progress.startedAtMillis)
        .putExtra(EXTRA_PREFER_LIVE_UPDATE, progress.preferLiveUpdate)
        .putExtra(EXTRA_IS_ACTIVITY, progress.isActivity)
  }
}

private fun Intent.toProgress() = ActivityProgress(
  current = max(0, getIntExtra(EXTRA_CURRENT, 0)),
  target = max(1, getIntExtra(EXTRA_TARGET, 8_000)),
  startingSteps = max(0, getIntExtra(EXTRA_STARTING_STEPS, 0)),
  startedAtMillis = getLongExtra(EXTRA_STARTED_AT, System.currentTimeMillis()),
  preferLiveUpdate = getBooleanExtra(EXTRA_PREFER_LIVE_UPDATE, false),
  isActivity = getBooleanExtra(EXTRA_IS_ACTIVITY, true)
)

private fun createActivityNotification(context: Context, progress: ActivityProgress): android.app.Notification {
  val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  manager.createNotificationChannel(
    NotificationChannel(NOTIFICATION_CHANNEL_ID, "Active walking", NotificationManager.IMPORTANCE_DEFAULT).apply {
      description = "Progress while an activity is running"
      setSound(null, null)
      enableVibration(false)
    }
  )
  val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
  val contentIntent = launchIntent?.let {
    PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  val current = progress.current
  val target = progress.target
  val remaining = max(0, target - current)
  val elapsedMinutes = max(0, (System.currentTimeMillis() - progress.startedAtMillis) / 60_000)
  val completed = current >= target
  val builder = NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
    .setSmallIcon(R.drawable.kimbo_ic_walk)
    .setContentTitle(if (!progress.isActivity) "Kimbo Mode" else if (completed) "Goal complete" else "Walking")
    .setContentText(if (!progress.isActivity) IslandSnapshot.load(context).line else if (completed) "$current steps · Daily goal reached" else "$current of $target steps · $remaining remaining")
    .setSubText(if (progress.isActivity) "$elapsedMinutes min" else null)
    .setOnlyAlertOnce(true)
    .setOngoing(true)
    .setCategory(NotificationCompat.CATEGORY_WORKOUT)
    .setContentIntent(contentIntent)

  if (progress.isActivity && Build.VERSION.SDK_INT >= 36 && progress.preferLiveUpdate) {
    builder.setRequestPromotedOngoing(true).setStyle(
      NotificationCompat.ProgressStyle()
        .setStyledByProgress(true)
        .setProgress(min(current, target))
        .addProgressSegment(
          NotificationCompat.ProgressStyle.Segment(target).setColor(Color.rgb(39, 115, 86))
        )
    )
  } else {
    builder.setProgress(target, min(current, target), false)
  }
  return builder.build()
}
