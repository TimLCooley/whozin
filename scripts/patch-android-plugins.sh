#!/bin/bash
# Patches Capacitor plugins for Gradle 9+ / AGP 8.9+ compatibility

PLUGINS=(
  "node_modules/@capacitor-community/contacts/android/build.gradle"
  "node_modules/@capawesome/capacitor-apple-sign-in/android/build.gradle"
  "node_modules/@codetrix-studio/capacitor-google-auth/android/build.gradle"
)

# Detect whether sed is BSD (macOS) or GNU. BSD sed -i requires a backup
# extension ("" allowed). GNU sed -i does not. Using the wrong form is a
# silent no-op on the other platform — which previously broke Windows builds.
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(-i)        # GNU sed (Linux, Git Bash on Windows)
else
  SED_INPLACE=(-i '')     # BSD sed (macOS)
fi

for f in "${PLUGINS[@]}"; do
  if [ -f "$f" ]; then
    # Fix deprecated proguard-android.txt
    sed "${SED_INPLACE[@]}" "s/proguard-android\.txt/proguard-android-optimize.txt/g" "$f"
    # Fix deprecated jcenter()
    sed "${SED_INPLACE[@]}" "s/jcenter()/mavenCentral()/g" "$f"
  fi
done

echo "Android plugin patches applied."
