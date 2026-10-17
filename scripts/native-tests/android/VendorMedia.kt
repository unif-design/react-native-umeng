package com.umeng.socialize.media
class UMImage(val activity: android.app.Activity, val url: String) {
  var thumbnail: UMImage? = null

  fun setThumb(value: UMImage) {
    thumbnail = value
  }
}

class UMWeb(val url: String) {
  var title: String = ""
  var description: String? = null
  var thumbnail: UMImage? = null

  fun setThumb(value: UMImage) {
    thumbnail = value
  }
}
