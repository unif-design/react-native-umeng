# @unif/react-native-umeng consumer proguard rules
#
# 这些规则跟随 library aar 一起发布,宿主 App 跑 R8 / proguard 时自动合并,
# 消费者不用复制到自己的 app/proguard-rules.pro。
#
# 友盟 / 微信 / 钉钉 SDK 内部大量用 Java 反射 (Class.forName / Method
# invocation) 查类,混淆后类名变 a/b/c → ClassNotFoundException → 运行
# 时 crash。

# ── 友盟系列 ──────────────────────────────────────────────
-dontwarn com.umeng.**
-keepattributes *Annotation*

-keep class com.umeng.** { *; }
# 友盟历史依赖的内部包名 (合并 / 改名遗留)
-keep class com.uyumao.** { *; }
-keep class com.uc.** { *; }
-keep class com.ut.** { *; }
-keep class com.ta.** { *; }

# ── 微信 SDK ─────────────────────────────────────────────
-keep class com.tencent.mm.opensdk.** { *; }
-keep class com.tencent.wxop.** { *; }
-keep class com.tencent.mm.sdk.** { *; }

# ── 钉钉 SDK ─────────────────────────────────────────────
-keep class com.alibaba.android.** { *; }

# ── 反射兜底 ─────────────────────────────────────────────
# Android R 资源 ID (友盟少数版本反射读)
-keep public class **.R$* { public static final int *; }
# 友盟反序列化对象:反射调 new XXX(JSONObject)
-keepclassmembers class * { public <init>(org.json.JSONObject); }
# enum 反序列化用 values() / valueOf()
-keepclassmembers enum * {
  public static **[] values();
  public static ** valueOf(java.lang.String);
}
