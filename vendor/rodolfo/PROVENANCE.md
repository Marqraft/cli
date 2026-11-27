Source: https://github.com/kexhq/rodolfo
Local checkout commit: 8920b6d (kexhq/rodolfo#24, on main 725e118)
Version: 0.2.0 (unpublished snapshot). Sources copied, then patched in
src/rodolfo.kex for Kex 0.4.0-rc.3's checks (an exhaustive Entry match and
no bare `.try` in respond/textual/typed) until upstream takes the same fix.
Also `flatMap` renamed to `into` for Kex main (kexhq/kex 8c29fcff).
Manifest omits upstream example workspace members.
