# ProGuard rules for Kavya Transports release builds.
# Keep Flutter engine and embedding classes (required).
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.**  { *; }
-keep class io.flutter.plugins.**  { *; }

# Keep annotations used by Flutter plugins.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# Suppress warnings for kotlin metadata.
-dontwarn kotlin.**
-dontwarn kotlinx.**

# Google Play Core (referenced by deferred components even if unused).
-dontwarn com.google.android.play.core.**

# MLKit text recognition — suppress missing language model classes (Chinese/Devanagari/Japanese/Korean).
# Only Latin text recognition is bundled; these are optional language packs.
-dontwarn com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions$Builder
-dontwarn com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
-dontwarn com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions$Builder
-dontwarn com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
-dontwarn com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions$Builder
-dontwarn com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
-dontwarn com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions$Builder
-dontwarn com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
