#!/usr/bin/env python3
"""מוסיף חתימת release (מפתח DALI PAY) ל-android/app/build.gradle שנוצר ע"י expo prebuild."""
import re, sys

path = sys.argv[1]
version_code = sys.argv[2]
s = open(path, encoding='utf-8').read()

release_cfg = """signingConfigs {
        release {
            storeFile file(System.getenv('DALI_KEYSTORE'))
            storePassword System.getenv('DALI_PASS')
            keyAlias 'dalipay'
            keyPassword System.getenv('DALI_PASS')
        }
"""
assert 'signingConfigs {' in s, 'signingConfigs block not found'
s = s.replace('signingConfigs {\n', release_cfg, 1)

bt = s.index('buildTypes {')
rel = s.index('release {', bt)
tail = s[rel:]
assert 'signingConfig signingConfigs.debug' in tail, 'release signingConfig line not found'
s = s[:rel] + tail.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release', 1)

s, n = re.subn(r'versionCode\s+\d+', 'versionCode ' + version_code, s, count=1)
assert n == 1, 'versionCode not found'
open(path, 'w', encoding='utf-8').write(s)
print('patched', path)
