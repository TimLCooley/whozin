#!/bin/bash
# Patches Capacitor plugins for Gradle 9+ / AGP 8.9+ compatibility

PLUGINS=(
  "node_modules/@capacitor-community/contacts/android/build.gradle"
  "node_modules/@capawesome/capacitor-apple-sign-in/android/build.gradle"
  "node_modules/@codetrix-studio/capacitor-google-auth/android/build.gradle"
)

for f in "${PLUGINS[@]}"; do
  if [ -f "$f" ]; then
    # Fix deprecated proguard-android.txt
    sed -i '' "s/proguard-android\.txt/proguard-android-optimize.txt/g" "$f"
    # Fix deprecated jcenter()
    sed -i '' "s/jcenter()/mavenCentral()/g" "$f"
  fi
done

echo "Android plugin patches applied."
