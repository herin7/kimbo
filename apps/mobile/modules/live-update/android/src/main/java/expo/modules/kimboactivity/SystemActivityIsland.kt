package expo.modules.kimboactivity

import android.Manifest
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.SweepGradient
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewTreeObserver
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.content.res.ResourcesCompat
import app.rive.runtime.kotlin.RiveAnimationView
import app.rive.runtime.kotlin.core.Alignment
import app.rive.runtime.kotlin.core.Fit
import app.rive.runtime.kotlin.core.Rive
import java.io.File
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Android owns only the cross-app surface. Health data, Kimbo's mood and every action's real work
 * stay in React Native: today's numbers arrive as an [IslandSnapshot], and taps are sent back
 * through [KimboActivityModule].
 */
internal class SystemActivityIsland(private val context: Context) {
  private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val handler = Handler(Looper.getMainLooper())
  private val density = context.resources.displayMetrics.density
  private val statusBarInset = context.resources.getIdentifier("status_bar_height", "dimen", "android")
    .takeIf { it > 0 }
    ?.let(context.resources::getDimensionPixelSize)
    ?: dp(28)
  private val compactWidth = dp(208)
  private val compactHeight = dp(46)
  private val expandedWidth = min(context.resources.displayMetrics.widthPixels - dp(20), dp(372))
  private val fontMedium = font(R.font.kimbo_manrope_medium)
  private val fontSemiBold = font(R.font.kimbo_manrope_semibold)
  private val fontBold = font(R.font.kimbo_manrope_bold)
  private val number = NumberFormat.getIntegerInstance()

  private var root: FrameLayout? = null
  private var windowParams: WindowManager.LayoutParams? = null
  private var compactContent: View? = null
  private var expandedContent: LinearLayout? = null
  private val moodViews = mutableListOf<RiveAnimationView>()
  private var lastMood: String? = null

  // Compact
  private var compactEyebrow: TextView? = null
  private var compactValue: TextView? = null
  private var compactRing: RingView? = null

  // Expanded
  private var expandedEyebrow: TextView? = null
  private var lineText: TextView? = null
  private var walkStats: View? = null
  private var elapsedText: TextView? = null
  private var sessionStepsText: TextView? = null
  private var distanceText: TextView? = null
  private val metrics = mutableMapOf<String, MetricViews>()
  private var primaryAction: PillButton? = null
  private var secondaryAction: PillButton? = null
  private var metricBlock: View? = null
  private var actionRow: View? = null

  // Meal logging, completed inside the island.
  private var mealPanel: View? = null
  private var mealTitle: TextView? = null
  private var mealDetail: TextView? = null
  private var mealMic: ImageView? = null
  private var mealPrimary: PillButton? = null
  private var mealSecondary: PillButton? = null
  private var meal = IslandMeal("idle")
  private var recorder: MediaRecorder? = null
  private var recordingStartedAt = 0L
  private var heardSound = false
  private val recordingTicker = object : Runnable {
    override fun run() {
      val active = recorder ?: return
      val level = runCatching { active.maxAmplitude }.getOrDefault(0)
      if (level > 0) heardSound = true
      val seconds = (System.currentTimeMillis() - recordingStartedAt) / 1_000
      mealDetail?.text = "Say what you ate, then tap Done · ${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}"
      val scale = 1f + (level.coerceAtMost(12_000) / 12_000f) * 0.35f
      mealMic?.animate()?.scaleX(scale)?.scaleY(scale)?.setDuration(110L)?.start()
      handler.postDelayed(this, 120L)
    }
  }

  private var latestProgress: ActivityProgress? = null
  private var isExpanded = false
  private var isConfirmingEnd = false
  private var isStarting = false
  private val autoCollapse = Runnable { if (!isConfirmingEnd && meal.phase == "idle") setExpanded(false) }

  fun show(progress: ActivityProgress) {
    val wasWalking = latestProgress?.isActivity == true
    latestProgress = progress
    if (progress.isActivity != wasWalking) {
      isConfirmingEnd = false
      isStarting = false
    }
    if (root == null) addToWindow()
    render(progress, IslandSnapshot.load(context))
  }

  fun remove() {
    discardRecording()
    handler.removeCallbacksAndMessages(null)
    root?.animate()?.cancel()
    root?.let { runCatching { windowManager.removeView(it) } }
    root = null
    windowParams = null
    compactContent = null
    expandedContent = null
    compactEyebrow = null
    compactValue = null
    compactRing = null
    expandedEyebrow = null
    lineText = null
    walkStats = null
    elapsedText = null
    sessionStepsText = null
    distanceText = null
    metrics.clear()
    primaryAction = null
    secondaryAction = null
    moodViews.forEach { it.stop() }
    moodViews.clear()
    lastMood = null
    isExpanded = false
  }

  // region Layout

  private fun addToWindow() {
    val container = FrameLayout(context).apply {
      background = islandBackground(compactHeight / 2f)
      elevation = dp(20).toFloat()
      clipToOutline = true
    }
    compactContent = buildCompactContent().also {
      container.addView(it, FrameLayout.LayoutParams(compactWidth, compactHeight, Gravity.TOP or Gravity.CENTER_HORIZONTAL))
    }
    expandedContent = buildExpandedContent().also {
      it.visibility = View.GONE
      container.addView(it, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))
    }

    val params = WindowManager.LayoutParams(
      compactWidth,
      compactHeight,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
      // Third-party overlays cannot own the system status bar's touch region. Keeping the island
      // immediately below it makes the full compact surface interactive on OEM Android builds.
      y = statusBarInset + dp(4)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      }
    }

    windowManager.addView(container, params)
    root = container
    windowParams = params
    container.alpha = 0f
    container.scaleX = 0.86f
    container.scaleY = 0.86f
    container.animate()
      .alpha(1f).scaleX(1f).scaleY(1f)
      .setDuration(if (animationsEnabled()) 260L else 0L)
      .setInterpolator(OvershootInterpolator(0.7f))
      .start()
  }

  private fun buildCompactContent(): View {
    val row = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(6), 0, dp(12), 0)
    }
    row.addView(moodView(), LinearLayout.LayoutParams(dp(34), dp(34)))
    val copy = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(8), 0, dp(8), 0)
    }
    compactEyebrow = label("KIMBO", 9.5f, MUTED, fontBold).apply { letterSpacing = 0.14f }
    compactValue = label("", 14f, PRIMARY, fontBold)
    copy.addView(compactEyebrow)
    copy.addView(compactValue)
    row.addView(copy, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    compactRing = RingView(context, dp(3.5f), TRACK).also { row.addView(it, LinearLayout.LayoutParams(dp(24), dp(24))) }
    installHeaderGestures(row)
    return row
  }

  private fun buildExpandedContent(): LinearLayout {
    val content = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(16), dp(14), dp(16), dp(16))
    }

    // Header: Kimbo, his line, and a collapse control.
    val header = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    header.addView(moodView(), LinearLayout.LayoutParams(dp(56), dp(56)))
    val speech = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(10), 0, dp(6), 0)
    }
    expandedEyebrow = label("KIMBO", 10f, MUTED, fontBold).apply { letterSpacing = 0.14f }
    lineText = label("", 14.5f, PRIMARY, fontSemiBold).apply {
      maxLines = 3
      ellipsize = TextUtils.TruncateAt.END
      setLineSpacing(0f, 1.12f)
    }
    speech.addView(expandedEyebrow)
    speech.addView(lineText, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(2) })
    header.addView(speech, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    header.addView(iconButton(R.drawable.kimbo_ic_chevron_up, "Minimise Kimbo", SURFACE, SECONDARY, 34) { setExpanded(false) })
    installHeaderGestures(header)
    content.addView(header)

    // Live walk stats (only while walking).
    val stats = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    elapsedText = addStat(stats, "elapsed")
    sessionStepsText = addStat(stats, "walk steps")
    distanceText = addStat(stats, "distance")
    walkStats = stats
    content.addView(stats, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(14) })

    // Today: three clean progress rows.
    val metricBlock = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      background = rounded(SURFACE, dp(18).toFloat())
      setPadding(dp(14), dp(12), dp(14), dp(14))
    }
    metrics["calories"] = addMetric(metricBlock, "Calories", CALORIES_FROM, CALORIES_TO, first = true)
    metrics["protein"] = addMetric(metricBlock, "Protein", PROTEIN_FROM, PROTEIN_TO)
    metrics["steps"] = addMetric(metricBlock, "Steps", STEPS_FROM, STEPS_TO)
    this.metricBlock = metricBlock
    content.addView(metricBlock, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(14) })
    content.addView(buildMealPanel(), LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(14) })

    // Actions: the main one finishes right here; meal logging needs the camera or mic, so it opens Kimbo.
    val actions = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    primaryAction = PillButton().also { actions.addView(it.view, LinearLayout.LayoutParams(0, dp(46), 1.15f)) }
    secondaryAction = PillButton().also {
      actions.addView(it.view, LinearLayout.LayoutParams(0, dp(46), 1f).apply { marginStart = dp(8) })
    }
    actions.addView(
      iconButton(R.drawable.kimbo_ic_open, "Open Kimbo", SURFACE, PRIMARY, 46) { openKimbo() },
      LinearLayout.LayoutParams(dp(46), dp(46)).apply { marginStart = dp(8) }
    )
    actionRow = actions
    content.addView(actions, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(46)).apply { topMargin = dp(14) })
    return content
  }

  // endregion

  // region Rendering

  private fun render(progress: ActivityProgress, snapshot: IslandSnapshot) {
    val walking = progress.isActivity
    val steps = if (walking) progress.current else snapshot.steps
    val stepTarget = if (walking) progress.target else snapshot.stepTarget
    val caloriesLeft = snapshot.calorieTarget - snapshot.calories
    val moodTint = moodTint(snapshot.mood)

    compactEyebrow?.apply {
      text = if (walking) "WALKING" else moodLabel(snapshot.mood)
      setTextColor(if (walking) STEPS_FROM else moodTint)
    }
    compactValue?.text = when {
      walking -> "${number.format(steps)} steps"
      caloriesLeft >= 0 -> "${number.format(caloriesLeft)} kcal left"
      else -> "${number.format(-caloriesLeft)} kcal over"
    }
    compactRing?.apply {
      if (walking) setColors(STEPS_FROM, STEPS_TO) else setColors(CALORIES_FROM, CALORIES_TO)
      setProgress(if (walking) fraction(steps, stepTarget) else fraction(snapshot.calories, snapshot.calorieTarget))
    }

    expandedEyebrow?.apply {
      text = if (walking) "LIVE WALK" else moodLabel(snapshot.mood)
      setTextColor(if (walking) STEPS_FROM else moodTint)
    }
    if (meal.line == null) lineText?.text = snapshot.line

    walkStats?.visibility = if (walking) View.VISIBLE else View.GONE
    if (walking) {
      val elapsedSeconds = max(0, (System.currentTimeMillis() - progress.startedAtMillis) / 1_000)
      val sessionSteps = max(0, progress.current - progress.startingSteps)
      elapsedText?.text = "${elapsedSeconds / 60}:${(elapsedSeconds % 60).toString().padStart(2, '0')}"
      sessionStepsText?.text = number.format(sessionSteps)
      distanceText?.text = String.format(Locale.getDefault(), "%.1f km", sessionSteps * 0.76 / 1_000)
    }

    metrics["calories"]?.set("${number.format(snapshot.calories)} / ${number.format(snapshot.calorieTarget)}", fraction(snapshot.calories, snapshot.calorieTarget))
    metrics["protein"]?.set("${snapshot.protein} / ${snapshot.proteinTarget} g", fraction(snapshot.protein, snapshot.proteinTarget))
    metrics["steps"]?.set("${number.format(steps)} / ${number.format(stepTarget)}", fraction(steps, stepTarget))

    root?.contentDescription = if (walking) {
      "Kimbo, walking. ${number.format(steps)} of ${number.format(stepTarget)} steps. Tap to expand."
    } else {
      "Kimbo. ${snapshot.line} Tap to expand."
    }
    configureActions()
    updateMood(meal.mood ?: snapshot.mood)
    applyMealVisibility()
    if (isExpanded) resizeToContent()
  }

  private fun configureActions() {
    val walking = latestProgress?.isActivity == true
    val primary = primaryAction ?: return
    val secondary = secondaryAction ?: return
    when {
      walking && isConfirmingEnd -> {
        primary.configure("End walk", R.drawable.kimbo_ic_stop, DANGER, Color.WHITE) { confirmEnd() }
        secondary.configure("Keep going", null, SURFACE, PRIMARY) {
          isConfirmingEnd = false
          configureActions()
          scheduleAutoCollapse()
        }
      }
      walking -> {
        primary.configure("End walk", R.drawable.kimbo_ic_stop, DANGER_SOFT, DANGER) {
          isConfirmingEnd = true
          handler.removeCallbacks(autoCollapse)
          root?.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
          configureActions()
        }
        secondary.configure("Log meal", R.drawable.kimbo_ic_mic, SURFACE, PRIMARY) { startListening() }
      }
      else -> {
        primary.configure(if (isStarting) "Starting…" else "Start walk", R.drawable.kimbo_ic_play, ACCENT, INK, enabled = !isStarting) { startWalk() }
        secondary.configure("Log meal", R.drawable.kimbo_ic_mic, SURFACE, PRIMARY) { startListening() }
      }
    }
  }

  /** Starts the walk without leaving the current app when Kimbo is running in the background. */
  private fun startWalk() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED
    ) {
      openKimbo("activity")
      return
    }
    isStarting = true
    configureActions()
    root?.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
    val snapshot = IslandSnapshot.load(context)
    val now = System.currentTimeMillis()
    val progress = ActivityProgress(snapshot.steps, snapshot.stepTarget, snapshot.steps, now, false)
    if (runCatching { ActivityLiveService.start(context, progress) }.isFailure) {
      openKimbo("activity")
      return
    }
    // Start the native foreground service immediately so the walk survives RN suspension. The
    // durable event lets React Native persist its local session when its JS runtime is available.
    KimboActivityModule.dispatchLiveActivityAction(context, "start")
  }

  private fun confirmEnd() {
    primaryAction?.configure("Ending…", R.drawable.kimbo_ic_stop, DANGER, Color.WHITE, enabled = false) {}
    secondaryAction?.view?.isEnabled = false
    root?.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
    KimboActivityModule.dispatchLiveActivityAction(context, "end")
    KimboActivityModule.endLiveActivityFromIsland(context)
  }

  private fun updateMood(mood: String) {
    val trigger = when (mood) {
      "happy" -> "Happy"
      "playful" -> "Crazy"
      "sad" -> "Sad"
      "angry" -> "Angry"
      else -> null
    }
    if (mood == lastMood) return
    lastMood = mood
    trigger ?: return
    moodViews.forEach { view ->
      view.postDelayed({ runCatching { view.fireState("State Machine 1", trigger) } }, 180L)
    }
  }

  // endregion

  // region Meal logging

  private fun buildMealPanel(): View {
    val panel = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      background = rounded(SURFACE, dp(18).toFloat())
      setPadding(dp(14), dp(14), dp(14), dp(14))
      visibility = View.GONE
    }
    val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    mealMic = ImageView(context).apply {
      setImageResource(R.drawable.kimbo_ic_mic)
      imageTintList = ColorStateList.valueOf(INK)
      setPadding(dp(11), dp(11), dp(11), dp(11))
      background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(ACCENT) }
    }
    row.addView(mealMic, LinearLayout.LayoutParams(dp(44), dp(44)))
    val copy = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(12), 0, 0, 0) }
    mealTitle = label("", 15f, PRIMARY, fontBold).apply { maxLines = 2 }
    mealDetail = label("", 12.5f, SECONDARY, fontMedium).apply { maxLines = 3 }
    copy.addView(mealTitle)
    copy.addView(mealDetail, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(3) })
    row.addView(copy, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    panel.addView(row)
    val buttons = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    mealPrimary = PillButton().also { buttons.addView(it.view, LinearLayout.LayoutParams(0, dp(44), 1.2f)) }
    mealSecondary = PillButton().also { buttons.addView(it.view, LinearLayout.LayoutParams(0, dp(44), 1f).apply { marginStart = dp(8) }) }
    panel.addView(buttons, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(44)).apply { topMargin = dp(12) })
    mealPanel = panel
    return panel
  }

  /** Called by React Native as the recording is transcribed, analysed and saved. */
  fun showMeal(next: IslandMeal) {
    // Ignore late updates for a flow the user already closed.
    if (meal.phase == "idle" || meal.phase == "listening") return
    meal = next
    if (next.phase == "saved") handler.postDelayed({ if (meal.phase == "saved") resetMeal() }, 2_400L)
    renderMeal()
  }

  private fun renderMeal() {
    val primary = mealPrimary ?: return
    val secondary = mealSecondary ?: return
    mealTitle?.text = meal.title
    mealDetail?.text = meal.detail
    meal.line?.let { lineText?.text = it }
    meal.mood?.let { updateMood(it) }
    mealMic?.visibility = if (meal.phase == "listening" || meal.phase == "processing") View.VISIBLE else View.GONE
    when (meal.phase) {
      "listening" -> {
        primary.configure("Done", R.drawable.kimbo_ic_check, ACCENT, INK) { finishListening() }
        secondary.configure("Cancel", null, TRACK, PRIMARY) {
          discardRecording()
          resetMeal()
        }
      }
      "processing" -> {
        mealMic?.animate()?.scaleX(1f)?.scaleY(1f)?.setDuration(160L)?.start()
        primary.configure("Thinking…", null, TRACK, SECONDARY, enabled = false) {}
        secondary.configure("Cancel", null, TRACK, PRIMARY) {
          KimboActivityModule.dispatchLiveActivityAction(context, "meal-discard")
          resetMeal()
        }
      }
      "review" -> {
        primary.configure("Save meal", R.drawable.kimbo_ic_check, ACCENT, INK) {
          primary.configure("Saving…", R.drawable.kimbo_ic_check, ACCENT, INK, enabled = false) {}
          if (!KimboActivityModule.dispatchLiveActivityAction(context, "meal-save")) openKimbo("meal/confirm")
        }
        secondary.configure("Discard", null, TRACK, PRIMARY) {
          KimboActivityModule.dispatchLiveActivityAction(context, "meal-discard")
          resetMeal()
        }
      }
      "saved" -> {
        primary.configure("Saved", R.drawable.kimbo_ic_check, STEPS_FROM, INK, enabled = false) {}
        secondary.configure("Close", null, TRACK, PRIMARY) { resetMeal() }
      }
      "error" -> {
        primary.configure("Try again", R.drawable.kimbo_ic_mic, ACCENT, INK) { startListening() }
        secondary.configure("Open Kimbo", null, TRACK, PRIMARY) {
          resetMeal()
          openKimbo("meal/voice")
        }
      }
    }
    applyMealVisibility()
    if (meal.phase != "idle" && !isExpanded) setExpanded(true)
    if (isExpanded) resizeToContent()
  }

  private fun applyMealVisibility() {
    val active = meal.phase != "idle"
    mealPanel?.visibility = if (active) View.VISIBLE else View.GONE
    metricBlock?.visibility = if (active) View.GONE else View.VISIBLE
    actionRow?.visibility = if (active) View.GONE else View.VISIBLE
    walkStats?.visibility = if (!active && latestProgress?.isActivity == true) View.VISIBLE else View.GONE
  }

  private fun resetMeal() {
    meal = IslandMeal("idle")
    latestProgress?.let { show(it) }
    scheduleAutoCollapse()
  }

  private fun startListening() {
    val hasPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    if (!hasPermission || !ActivityLiveService.canUseMicrophone) {
      // Android only lets the island record after Kimbo has been granted the mic while open.
      openKimbo("meal/voice")
      return
    }
    discardRecording()
    val file = File(context.cacheDir, "kimbo-island-meal.m4a")
    val next = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else @Suppress("DEPRECATION") MediaRecorder()
    try {
      next.setAudioSource(MediaRecorder.AudioSource.MIC)
      next.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
      next.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
      next.setAudioEncodingBitRate(96_000)
      next.setAudioSamplingRate(44_100)
      next.setMaxDuration(60_000)
      next.setOutputFile(file.absolutePath)
      next.setOnInfoListener { _, what, _ ->
        if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) finishListening()
      }
      next.prepare()
      next.start()
    } catch (_: Exception) {
      next.release()
      meal = IslandMeal("error", "The mic couldn't start here", "Open Kimbo to log this meal by voice.")
      renderMeal()
      return
    }
    recorder = next
    recordingStartedAt = System.currentTimeMillis()
    heardSound = false
    root?.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
    meal = IslandMeal("listening", "Listening…", "Say what you ate, then tap Done", line = "I'm all ears. What did you eat?", mood = "happy")
    renderMeal()
    handler.post(recordingTicker)
  }

  private fun finishListening() {
    val active = recorder ?: return
    handler.removeCallbacks(recordingTicker)
    val duration = System.currentTimeMillis() - recordingStartedAt
    val stopped = runCatching { active.stop() }.isSuccess
    active.release()
    recorder = null
    val file = File(context.cacheDir, "kimbo-island-meal.m4a")
    when {
      !stopped || duration < 900L ->
        meal = IslandMeal("error", "That was too quick", "Hold on a little longer and tell me what you ate.")
      // Android hands apps silent audio when it blocks the mic; say so instead of guessing.
      !heardSound ->
        meal = IslandMeal("error", "I couldn't hear anything", "Android may have paused the mic. Open Kimbo to log by voice.")
      else -> {
        meal = IslandMeal("processing", "Kimbo is thinking…", "Turning your words into a meal", line = "Hmm, let me picture that plate…", mood = "playful")
        if (!KimboActivityModule.dispatchLiveActivityAction(context, "meal-voice", "file://${file.absolutePath}")) {
          resetMeal()
          openKimbo("meal/voice")
          return
        }
      }
    }
    renderMeal()
  }

  private fun discardRecording() {
    handler.removeCallbacks(recordingTicker)
    recorder?.let { active ->
      runCatching { active.stop() }
      active.release()
    }
    recorder = null
  }

  // endregion

  // region Gestures & expansion

  private fun installHeaderGestures(view: View) {
    val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    var downY = 0f
    var hasMoved = false
    var didLongPress = false
    val longPress = Runnable {
      didLongPress = true
      view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
      setExpanded(true)
    }
    view.isClickable = true
    view.setOnClickListener { setExpanded(!isExpanded) }
    view.setOnTouchListener { touchedView, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downY = event.rawY
          hasMoved = false
          didLongPress = false
          handler.postDelayed(longPress, 420L)
          root?.animate()?.cancel()
          root?.animate()?.scaleX(0.97f)?.scaleY(0.97f)?.setDuration(90L)?.start()
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val delta = event.rawY - downY
          if (abs(delta) > touchSlop) {
            hasMoved = true
            handler.removeCallbacks(longPress)
          }
          root?.translationY = delta.coerceIn(-dp(30).toFloat(), dp(30).toFloat())
          true
        }
        MotionEvent.ACTION_UP -> {
          handler.removeCallbacks(longPress)
          val delta = event.rawY - downY
          when {
            didLongPress -> resetGestureTransform()
            delta > dp(24) -> { resetGestureTransform(); setExpanded(true) }
            delta < -dp(24) -> { resetGestureTransform(); setExpanded(false) }
            !hasMoved -> { resetGestureTransform(); touchedView.performClick() }
            else -> settleGesture()
          }
          true
        }
        MotionEvent.ACTION_CANCEL -> {
          handler.removeCallbacks(longPress)
          settleGesture()
          true
        }
        else -> false
      }
    }
  }

  private fun settleGesture() {
    root?.animate()?.translationY(0f)?.scaleX(1f)?.scaleY(1f)
      ?.setDuration(if (animationsEnabled()) 180L else 0L)
      ?.setInterpolator(OvershootInterpolator(0.45f))
      ?.start()
  }

  private fun resetGestureTransform() {
    root?.animate()?.cancel()
    root?.translationY = 0f
    root?.scaleX = 1f
    root?.scaleY = 1f
  }

  private fun setExpanded(expanded: Boolean) {
    if (isExpanded == expanded || root == null || windowParams == null) return
    handler.removeCallbacks(autoCollapse)
    root?.animate()?.cancel()
    expandedContent?.animate()?.cancel()
    root?.animate()?.setListener(null)
    resetGestureTransform()
    isExpanded = expanded
    if (!expanded) {
      isConfirmingEnd = false
      configureActions()
      if (meal.phase == "listening") {
        discardRecording()
        meal = IslandMeal("idle")
      }
    }
    root?.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
    if (expanded) animateExpansion() else animateCollapse()
  }

  private fun measuredExpandedHeight(): Int {
    val content = expandedContent ?: return dp(320)
    content.measure(
      View.MeasureSpec.makeMeasureSpec(expandedWidth, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
    )
    return content.measuredHeight
  }

  private fun resizeToContent() {
    val container = root ?: return
    val params = windowParams ?: return
    val height = measuredExpandedHeight()
    if (params.height == height) return
    params.height = height
    runCatching { windowManager.updateViewLayout(container, params) }
  }

  private fun animateExpansion() {
    val container = root ?: return
    val params = windowParams ?: return
    val targetHeight = measuredExpandedHeight()
    params.width = expandedWidth
    params.height = targetHeight
    windowManager.updateViewLayout(container, params)
    container.background = islandBackground(dp(30).toFloat())
    compactContent?.visibility = View.GONE
    expandedContent?.apply {
      visibility = View.VISIBLE
      alpha = 0f
      translationY = -dp(6).toFloat()
    }
    container.pivotX = expandedWidth / 2f
    container.pivotY = 0f
    container.scaleX = compactWidth.toFloat() / expandedWidth
    container.scaleY = compactHeight.toFloat() / targetHeight
    if (!animationsEnabled()) {
      container.scaleX = 1f
      container.scaleY = 1f
      expandedContent?.alpha = 1f
      expandedContent?.translationY = 0f
    } else {
      container.animate().scaleX(1f).scaleY(1f).setDuration(340L).setInterpolator(OvershootInterpolator(0.75f)).start()
      expandedContent?.animate()?.alpha(1f)?.translationY(0f)?.setStartDelay(90L)?.setDuration(200L)?.start()
    }
    scheduleAutoCollapse()
  }

  private fun animateCollapse() {
    val container = root ?: return
    val params = windowParams ?: return
    val finish = {
      expandedContent?.visibility = View.GONE
      compactContent?.apply {
        visibility = View.VISIBLE
        alpha = 0f
      }
      // Undo the shrink transform only once the window has been laid out at compact size.
      // Resetting it before that relayout draws one frame of the old wide layout pinned to the
      // left of the new narrow window, which looked like the pill jumping left then re-centring.
      container.viewTreeObserver.addOnPreDrawListener(object : ViewTreeObserver.OnPreDrawListener {
        override fun onPreDraw(): Boolean {
          if (container.width > compactWidth) return true
          container.viewTreeObserver.removeOnPreDrawListener(this)
          container.scaleX = 1f
          container.scaleY = 1f
          container.background = islandBackground(compactHeight / 2f)
          compactContent?.animate()?.alpha(1f)?.setDuration(if (animationsEnabled()) 140L else 0L)?.start()
          return true
        }
      })
      params.width = compactWidth
      params.height = compactHeight
      runCatching { windowManager.updateViewLayout(container, params) }
    }
    if (!animationsEnabled()) {
      finish()
      return
    }
    expandedContent?.animate()?.alpha(0f)?.setDuration(110L)?.start()
    container.animate()
      .scaleX(compactWidth.toFloat() / expandedWidth)
      .scaleY(compactHeight.toFloat() / max(1, params.height))
      .setDuration(230L)
      .setInterpolator(DecelerateInterpolator(1.4f))
      .setListener(object : AnimatorListenerAdapter() {
        override fun onAnimationEnd(animation: Animator) {
          container.animate().setListener(null)
          finish()
        }
      })
      .start()
  }

  private fun scheduleAutoCollapse() {
    handler.removeCallbacks(autoCollapse)
    handler.postDelayed(autoCollapse, 9_000L)
  }

  // endregion

  // region Building blocks

  private inner class PillButton {
    private val icon = ImageView(context)
    private val text = label("", 14f, PRIMARY, fontBold)
    val view = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      isClickable = true
      isFocusable = true
      addView(icon, LinearLayout.LayoutParams(dp(17), dp(17)).apply { marginEnd = dp(7) })
      addView(text)
    }

    fun configure(title: String, iconRes: Int?, background: Int, foreground: Int, enabled: Boolean = true, action: () -> Unit) {
      text.text = title
      text.setTextColor(foreground)
      icon.visibility = if (iconRes == null) View.GONE else View.VISIBLE
      if (iconRes != null) {
        icon.setImageResource(iconRes)
        icon.imageTintList = ColorStateList.valueOf(foreground)
      }
      view.isEnabled = enabled
      view.alpha = if (enabled) 1f else 0.7f
      view.contentDescription = title
      view.background = RippleDrawable(ColorStateList.valueOf(Color.argb(40, 255, 255, 255)), rounded(background, dp(23).toFloat()), null)
      view.setOnClickListener {
        it.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
        action()
      }
    }
  }

  private inner class MetricViews(val value: TextView, val bar: GradientBar) {
    fun set(text: String, progress: Float) {
      value.text = text
      bar.setProgress(progress)
    }
  }

  private fun addMetric(parent: LinearLayout, title: String, from: Int, to: Int, first: Boolean = false): MetricViews {
    val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    row.addView(label(title, 12.5f, SECONDARY, fontMedium), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    val value = label("", 12.5f, PRIMARY, fontSemiBold)
    row.addView(value)
    parent.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      if (!first) topMargin = dp(10)
    })
    val bar = GradientBar(context, from, to, TRACK)
    parent.addView(bar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(5)).apply { topMargin = dp(6) })
    return MetricViews(value, bar)
  }

  private fun addStat(parent: LinearLayout, caption: String): TextView {
    val column = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    val value = label("0", 20f, PRIMARY, fontBold).apply { letterSpacing = -0.02f }
    column.addView(value)
    column.addView(label(caption, 11f, MUTED, fontMedium))
    parent.addView(column, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    return value
  }

  private fun iconButton(iconRes: Int, description: String, fill: Int, tint: Int, sizeDp: Int, action: () -> Unit) =
    ImageView(context).apply {
      setImageResource(iconRes)
      imageTintList = ColorStateList.valueOf(tint)
      val padding = dp(sizeDp / 4)
      setPadding(padding, padding, padding, padding)
      contentDescription = description
      isClickable = true
      isFocusable = true
      background = RippleDrawable(
        ColorStateList.valueOf(Color.argb(40, 255, 255, 255)),
        GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(fill) },
        null
      )
      layoutParams = LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp))
      setOnClickListener {
        it.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
        action()
      }
    }

  private fun label(value: String, size: Float, color: Int, typeface: Typeface?) = TextView(context).apply {
    text = value
    textSize = size
    setTextColor(color)
    includeFontPadding = false
    maxLines = 1
    ellipsize = TextUtils.TruncateAt.END
    this.typeface = typeface ?: Typeface.DEFAULT_BOLD
  }

  private fun moodView() = RiveAnimationView(context).apply {
    Rive.init(context)
    setRiveResource(
      R.raw.kimbo_mood,
      artboardName = "Artboard",
      stateMachineName = "State Machine 1",
      autoplay = true,
      fit = Fit.CONTAIN,
      alignment = Alignment.CENTER
    )
    moodViews.add(this)
  }

  private fun islandBackground(radius: Float) = GradientDrawable().apply {
    shape = GradientDrawable.RECTANGLE
    cornerRadius = radius
    setColor(ISLAND)
    setStroke(dp(1), BORDER)
  }

  private fun rounded(color: Int, radius: Float) = GradientDrawable().apply {
    cornerRadius = radius
    setColor(color)
  }

  private fun openKimbo(route: String? = null) {
    val intent = route?.let {
      Intent(Intent.ACTION_VIEW, Uri.parse("kimbo://$it")).setPackage(context.packageName)
    } ?: context.packageManager.getLaunchIntentForPackage(context.packageName)
    intent?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      context.startActivity(it)
    }
  }

  private fun font(id: Int): Typeface? = runCatching { ResourcesCompat.getFont(context, id) }.getOrNull()

  private fun fraction(current: Int, target: Int) = if (target <= 0) 0f else (current.toFloat() / target).coerceIn(0f, 1f)

  private fun moodLabel(mood: String) = when (mood) {
    "happy" -> "PLEASED"
    "playful" -> "HYPED"
    "sad" -> "WORRIED"
    "angry" -> "FIRED UP"
    else -> "KIMBO"
  }

  private fun moodTint(mood: String) = when (mood) {
    "happy" -> STEPS_FROM
    "playful" -> ACCENT
    "sad" -> PROTEIN_FROM
    "angry" -> DANGER
    else -> MUTED
  }

  private fun animationsEnabled() =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.O || ValueAnimator.areAnimatorsEnabled()

  private fun dp(value: Int) = (value * density).toInt()
  private fun dp(value: Float) = value * density

  // endregion

  companion object {
    // Mirrors the app's dark palette (src/design-system/tokens/colors.ts).
    private val ISLAND = Color.rgb(0, 0, 0)
    private val BORDER = Color.argb(28, 255, 255, 255)
    private val SURFACE = Color.rgb(24, 27, 25)
    private val TRACK = Color.rgb(40, 45, 41)
    private val PRIMARY = Color.rgb(247, 247, 242)
    private val SECONDARY = Color.rgb(179, 185, 177)
    private val MUTED = Color.rgb(140, 148, 141)
    private val INK = Color.rgb(17, 17, 15)
    private val ACCENT = Color.rgb(255, 118, 87)
    private val DANGER = Color.rgb(236, 133, 133)
    private val DANGER_SOFT = Color.rgb(54, 30, 30)
    private val CALORIES_FROM = Color.rgb(255, 118, 87)
    private val CALORIES_TO = Color.rgb(255, 179, 107)
    private val STEPS_FROM = Color.rgb(95, 203, 156)
    private val STEPS_TO = Color.rgb(169, 229, 154)
    private val PROTEIN_FROM = Color.rgb(156, 158, 255)
    private val PROTEIN_TO = Color.rgb(199, 178, 255)
  }
}

/** Thin rounded progress bar with a horizontal gradient fill; animates between values. */
private class GradientBar(context: Context, private val from: Int, private val to: Int, track: Int) : View(context) {
  private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = track }
  private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val rect = RectF()
  private var value = 0f
  private var animator: ValueAnimator? = null

  fun setProgress(target: Float) {
    if (abs(target - value) < 0.001f) return
    animator?.cancel()
    if (!ValueAnimator.areAnimatorsEnabled()) {
      value = target
      invalidate()
      return
    }
    animator = ValueAnimator.ofFloat(value, target).apply {
      duration = 520L
      interpolator = DecelerateInterpolator(1.6f)
      addUpdateListener { value = it.animatedValue as Float; invalidate() }
      start()
    }
  }

  override fun onDraw(canvas: Canvas) {
    val h = height.toFloat()
    val r = h / 2f
    rect.set(0f, 0f, width.toFloat(), h)
    canvas.drawRoundRect(rect, r, r, trackPaint)
    if (value <= 0f) return
    val fillWidth = max(h, width * value)
    fillPaint.shader = LinearGradient(0f, 0f, fillWidth, 0f, from, to, Shader.TileMode.CLAMP)
    rect.set(0f, 0f, fillWidth, h)
    canvas.drawRoundRect(rect, r, r, fillPaint)
  }
}

/** Small progress ring with a sweep gradient, used in the compact pill. */
private class RingView(context: Context, private val stroke: Float, track: Int) : View(context) {
  private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = stroke
    color = track
  }
  private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = stroke
    strokeCap = Paint.Cap.ROUND
  }
  private val oval = RectF()
  private val rotate = Matrix()
  private var from = Color.WHITE
  private var to = Color.WHITE
  private var value = 0f
  private var animator: ValueAnimator? = null

  fun setColors(start: Int, end: Int) {
    from = start
    to = end
    invalidate()
  }

  fun setProgress(target: Float) {
    if (abs(target - value) < 0.001f) return
    animator?.cancel()
    if (!ValueAnimator.areAnimatorsEnabled()) {
      value = target
      invalidate()
      return
    }
    animator = ValueAnimator.ofFloat(value, target).apply {
      duration = 600L
      interpolator = DecelerateInterpolator(1.6f)
      addUpdateListener { value = it.animatedValue as Float; invalidate() }
      start()
    }
  }

  override fun onDraw(canvas: Canvas) {
    val inset = stroke / 2f + 1f
    oval.set(inset, inset, width - inset, height - inset)
    canvas.drawArc(oval, 0f, 360f, false, trackPaint)
    if (value <= 0f) return
    val cx = width / 2f
    val cy = height / 2f
    fillPaint.shader = SweepGradient(cx, cy, intArrayOf(from, to, from), floatArrayOf(0f, 0.75f, 1f)).apply {
      rotate.setRotate(-90f, cx, cy)
      setLocalMatrix(rotate)
    }
    canvas.drawArc(oval, -90f, 360f * value, false, fillPaint)
  }
}
