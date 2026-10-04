package expo.modules.kimboactivity

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.interfaces.permissions.Permissions
import java.io.Serializable
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.max

class LiveActivityStartRecord : Record {
  @Field var type: String = "walking"
  @Field var current: Int = 0
  @Field var target: Int = 8000
  @Field var startingSteps: Int = 0
  @Field var startedAtMillis: Double = 0.0
  @Field var preferLiveUpdate: Boolean = true
}

class LiveActivityUpdateRecord : Record {
  @Field var current: Int = 0
  @Field var target: Int = 8000
  @Field var startingSteps: Int = 0
  @Field var startedAtMillis: Double = 0.0
  @Field var preferLiveUpdate: Boolean = true
}

private data class HealthPermissionRequest(
  val permissions: ArrayList<String>
) : Serializable

private class HealthPermissionContract : AppContextActivityResultContract<HealthPermissionRequest, Set<String>> {
  private val delegate = PermissionController.createRequestPermissionResultContract()

  override fun createIntent(context: Context, input: HealthPermissionRequest) =
    delegate.createIntent(context, input.permissions.toSet())

  override fun parseResult(input: HealthPermissionRequest, resultCode: Int, intent: android.content.Intent?) =
    delegate.parseResult(resultCode, intent)
}

private data class OverlayPermissionRequest(
  val packageName: String
) : Serializable

private class OverlayPermissionContract(
  private val applicationContext: Context
) : AppContextActivityResultContract<OverlayPermissionRequest, Boolean> {
  override fun createIntent(context: Context, input: OverlayPermissionRequest) =
    Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${input.packageName}"))

  override fun parseResult(input: OverlayPermissionRequest, resultCode: Int, intent: Intent?) =
    Settings.canDrawOverlays(applicationContext)
}

class KimboActivityModule : Module(), SensorEventListener {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
  private val stepPermission = HealthPermission.getReadPermission(StepsRecord::class)
  private var sensorManager: SensorManager? = null
  private var sensorStartValue: Float? = null
  private var baseTodaySteps: Int = 0
  private var activeTarget: Int? = null
  private var activeStartingSteps: Int? = null
  private var activeStartedAtMillis: Long? = null
  private var activePreferLiveUpdate: Boolean = false
  private lateinit var healthPermissionLauncher: AppContextActivityResultLauncher<HealthPermissionRequest, Set<String>>
  private lateinit var overlayPermissionLauncher: AppContextActivityResultLauncher<OverlayPermissionRequest, Boolean>

  override fun definition() = ModuleDefinition {
    Name("KimboActivity")
    Events("onStepUpdate", "onLiveActivityAction")

    OnCreate {
      activeModule = this@KimboActivityModule
    }

    OnDestroy {
      if (activeModule === this@KimboActivityModule) activeModule = null
    }

    Function("getHealthConnectAvailability") {
      when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> "available"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "updateRequired"
        else -> "unavailable"
      }
    }

    AsyncFunction("hasStepPermissions") Coroutine { ->
      if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) return@Coroutine false
      try {
        HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions().contains(stepPermission)
      } catch (_: SecurityException) {
        false
      }
    }

    RegisterActivityContracts {
      healthPermissionLauncher = registerForActivityResult(HealthPermissionContract())
      overlayPermissionLauncher = registerForActivityResult(OverlayPermissionContract(context))
    }

    AsyncFunction("requestStepPermissions") Coroutine { ->
      if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
        return@Coroutine false
      }
      val grantedPermissions = healthPermissionLauncher.launch(
        HealthPermissionRequest(arrayListOf(stepPermission))
      )
      grantedPermissions.contains(stepPermission)
    }

    Function("hasActivityRecognitionPermission") { hasActivityRecognitionPermission() }

    AsyncFunction("requestActivityRecognitionPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        promise.resolve(null)
      } else {
        Permissions.askForPermissionsWithPermissionsManager(
          appContext.permissions,
          promise,
          Manifest.permission.ACTIVITY_RECOGNITION
        )
      }
    }

    AsyncFunction("getTodaySteps") Coroutine { ->
      if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) return@Coroutine 0
      val client = HealthConnectClient.getOrCreate(context)
      if (!client.permissionController.getGrantedPermissions().contains(stepPermission)) return@Coroutine 0
      try {
        val zone = ZoneId.systemDefault()
        val start = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        val result = client.aggregate(AggregateRequest(metrics = setOf(StepsRecord.COUNT_TOTAL), timeRangeFilter = TimeRangeFilter.between(start, Instant.now())))
        (result[StepsRecord.COUNT_TOTAL] ?: 0L).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
      } catch (_: SecurityException) {
        0
      }
    }

    AsyncFunction("startStepUpdates") { initialTodaySteps: Int ->
      baseTodaySteps = max(0, initialTodaySteps)
      sensorStartValue = null
      val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
      val sensor = manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
      sensorManager = manager
      if (sensor != null && hasActivityRecognitionPermission()) {
        manager.registerListener(this@KimboActivityModule, sensor, SensorManager.SENSOR_DELAY_NORMAL)
      }
    }

    AsyncFunction("stopStepUpdates") {
      sensorManager?.unregisterListener(this@KimboActivityModule)
      sensorManager = null
      sensorStartValue = null
    }

    Function("hasNotificationPermission") { hasNotificationPermission() }

    AsyncFunction("requestNotificationPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        promise.resolve(null)
      } else {
        Permissions.askForPermissionsWithPermissionsManager(
          appContext.permissions,
          promise,
          Manifest.permission.POST_NOTIFICATIONS
        )
      }
    }

    Function("isLiveUpdateSupported") {
      if (Build.VERSION.SDK_INT < 36) return@Function false
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.canPostPromotedNotifications()
    }

    Function("hasOverlayPermission") {
      Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
    }

    AsyncFunction("requestOverlayPermission") Coroutine { ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)) {
        return@Coroutine true
      }
      overlayPermissionLauncher.launch(OverlayPermissionRequest(context.packageName))
    }

    Function("isOverlayEnabled") {
      ActivityLiveService.isOverlayEnabled(context)
    }

    Function("setOverlayEnabled") { isEnabled: Boolean ->
      ActivityLiveService.setOverlayEnabled(context, isEnabled)
    }

    Function("setIslandSnapshot") { input: IslandSnapshotRecord ->
      ActivityLiveService.updateSnapshot(context, input.toSnapshot())
    }

    Function("setIslandMeal") { input: IslandMealRecord ->
      ActivityLiveService.updateMeal(input.toMeal())
    }

    Function("consumePendingLiveActivityAction") {
      val preferences = context.getSharedPreferences(ACTION_PREFERENCES, Context.MODE_PRIVATE)
      val action = preferences.getString(PENDING_ACTION_KEY, null) ?: return@Function null
      val uri = preferences.getString(PENDING_URI_KEY, null)
      preferences.edit().remove(PENDING_ACTION_KEY).remove(PENDING_URI_KEY).apply()
      mapOf("action" to action, "uri" to uri)
    }

    AsyncFunction("startLiveActivity") { input: LiveActivityStartRecord ->
      activeTarget = input.target
      activeStartingSteps = input.startingSteps
      activeStartedAtMillis = input.startedAtMillis.toLong()
      activePreferLiveUpdate = input.preferLiveUpdate
      ActivityLiveService.start(
        context,
        ActivityProgress(input.current, input.target, input.startingSteps, input.startedAtMillis.toLong(), input.preferLiveUpdate)
      )
    }

    AsyncFunction("updateLiveActivity") { input: LiveActivityUpdateRecord ->
      ActivityLiveService.update(
        context,
        ActivityProgress(input.current, input.target, input.startingSteps, input.startedAtMillis.toLong(), input.preferLiveUpdate)
      )
    }

    AsyncFunction("endLiveActivity") {
      activeTarget = null
      activeStartingSteps = null
      activeStartedAtMillis = null
      activePreferLiveUpdate = false
      ActivityLiveService.stop(context)
    }
  }

  override fun onSensorChanged(event: SensorEvent) {
    val initial = sensorStartValue
    if (initial == null) {
      sensorStartValue = event.values[0]
      sendEvent("onStepUpdate", mapOf("steps" to baseTodaySteps))
      return
    }
    val sessionSteps = max(0, (event.values[0] - initial).toInt())
    val steps = baseTodaySteps + sessionSteps
    sendEvent("onStepUpdate", mapOf("steps" to steps))
    val target = activeTarget
    val startingSteps = activeStartingSteps
    val startedAt = activeStartedAtMillis
    if (target != null && startingSteps != null && startedAt != null) {
      ActivityLiveService.update(
        context,
        ActivityProgress(steps, target, startingSteps, startedAt, activePreferLiveUpdate)
      )
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  private fun hasActivityRecognitionPermission(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED

  private fun hasNotificationPermission(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
    ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

  companion object {
    private const val ACTION_PREFERENCES = "kimbo_live_activity_actions"
    private const val PENDING_ACTION_KEY = "pending_action"
    private const val PENDING_URI_KEY = "pending_uri"
    @Volatile private var activeModule: KimboActivityModule? = null

    internal fun dispatchLiveActivityAction(context: Context, action: String, uri: String? = null): Boolean {
      context.getSharedPreferences(ACTION_PREFERENCES, Context.MODE_PRIVATE)
        .edit()
        .putString(PENDING_ACTION_KEY, action)
        .putString(PENDING_URI_KEY, uri)
        .apply()
      val module = activeModule ?: return false
      module.sendEvent("onLiveActivityAction", mapOf("action" to action, "uri" to uri))
      return true
    }
  }

}
