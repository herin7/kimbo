package expo.modules.kimboactivity

import android.content.Context
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

private const val SNAPSHOT_PREFERENCES = "kimbo_island_snapshot"

/** Today at a glance, written by React Native (the source of truth) and read by the island. */
internal data class IslandSnapshot(
  val mood: String = "neutral",
  val line: String = "Tap to see how today is going.",
  val calories: Int = 0,
  val calorieTarget: Int = 2_000,
  val protein: Int = 0,
  val proteinTarget: Int = 100,
  val steps: Int = 0,
  val stepTarget: Int = 8_000
) {
  fun save(context: Context) {
    context.getSharedPreferences(SNAPSHOT_PREFERENCES, Context.MODE_PRIVATE).edit()
      .putString("mood", mood)
      .putString("line", line)
      .putInt("calories", calories)
      .putInt("calorieTarget", calorieTarget)
      .putInt("protein", protein)
      .putInt("proteinTarget", proteinTarget)
      .putInt("steps", steps)
      .putInt("stepTarget", stepTarget)
      .apply()
  }

  companion object {
    fun load(context: Context): IslandSnapshot {
      val preferences = context.getSharedPreferences(SNAPSHOT_PREFERENCES, Context.MODE_PRIVATE)
      val fallback = IslandSnapshot()
      return IslandSnapshot(
        mood = preferences.getString("mood", null) ?: fallback.mood,
        line = preferences.getString("line", null) ?: fallback.line,
        calories = preferences.getInt("calories", fallback.calories),
        calorieTarget = preferences.getInt("calorieTarget", fallback.calorieTarget),
        protein = preferences.getInt("protein", fallback.protein),
        proteinTarget = preferences.getInt("proteinTarget", fallback.proteinTarget),
        steps = preferences.getInt("steps", fallback.steps),
        stepTarget = preferences.getInt("stepTarget", fallback.stepTarget)
      )
    }
  }
}

/** The island's own meal-logging flow. "listening" is native-only; the rest come from React Native. */
internal data class IslandMeal(
  val phase: String,
  val title: String = "",
  val detail: String = "",
  val line: String? = null,
  val mood: String? = null
)

class IslandMealRecord : Record {
  @Field var phase: String = "idle"
  @Field var title: String = ""
  @Field var detail: String = ""
  @Field var line: String? = null
  @Field var mood: String? = null

  internal fun toMeal() = IslandMeal(phase, title, detail, line, mood)
}

class IslandSnapshotRecord : Record {
  @Field var mood: String = "neutral"
  @Field var line: String = ""
  @Field var calories: Int = 0
  @Field var calorieTarget: Int = 2_000
  @Field var protein: Int = 0
  @Field var proteinTarget: Int = 100
  @Field var steps: Int = 0
  @Field var stepTarget: Int = 8_000

  internal fun toSnapshot() = IslandSnapshot(mood, line, calories, calorieTarget, protein, proteinTarget, steps, stepTarget)
}
