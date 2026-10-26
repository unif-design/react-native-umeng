package com.umeng.socialize.weixin.view
import umeng.boundary.Boundary
open class WXCallbackActivity {
  init { Boundary.record("wechat.callback", this) }
}
