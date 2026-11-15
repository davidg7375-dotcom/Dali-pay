#!/usr/bin/env bash
# בדיקת עשן: מתקין את ה-APK באמולטור, פותח אותו, מצלם ומוודא שאין קריסה.
set -u
OUT=device-shots; mkdir -p "$OUT"
adb install -r dali-pay-x86-test.apk | tee "$OUT/install.txt"
grep -q Success "$OUT/install.txt" || { echo "INSTALL FAILED"; exit 1; }
adb logcat -c
adb shell monkey -p com.dalipay.app -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 25
adb exec-out screencap -p > "$OUT/01-launch.png"
adb logcat -d > "$OUT/logcat.txt"
PID=$(adb shell pidof com.dalipay.app | tr -d '\r')
echo "pid: ${PID:-none}" | tee "$OUT/result.txt"
if grep -q "FATAL EXCEPTION" "$OUT/logcat.txt"; then echo "CRASH" | tee -a "$OUT/result.txt"; grep -A12 "FATAL EXCEPTION" "$OUT/logcat.txt" | head -30 >> "$OUT/result.txt"; exit 1; fi
[ -n "$PID" ] || { echo "APP NOT RUNNING" | tee -a "$OUT/result.txt"; exit 1; }
echo "OK: app running, no crash" | tee -a "$OUT/result.txt"
