package expo.modules.kimboactivity

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView

class PermissionsRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val padding = (24 * resources.displayMetrics.density).toInt()
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(padding, padding, padding, padding)
      setBackgroundColor(Color.rgb(246, 248, 244))
      addView(TextView(context).apply {
        text = "How Kimbo uses step data"
        textSize = 26f
        setTextColor(Color.rgb(23, 32, 25))
      }, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
      addView(TextView(context).apply {
        text = "Kimbo reads your daily step total to show movement progress and update an activity notification you explicitly start. Step data is not sold or used for advertising. You can revoke access in Health Connect at any time."
        textSize = 17f
        setTextColor(Color.rgb(78, 93, 82))
        setPadding(0, padding, 0, 0)
      }, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }
    setContentView(layout)
  }
}
