# Mini Startup Readiness

The user reports blue rectangular corner areas on first opening that disappear
later. Scope: startup sequencing only; retain the antialiased native region,
layout, platform highlight rules, and real user data.

Existing code already uses show:false, transparent background, transparent root
CSS and ready-to-show. Electron 35 disables OS rounded corners for transparent
windows without a thick frame. Do not duplicate those settings or replace the
custom resize policy with native resizable:true.

There is an observable readiness gap: ready-to-show can precede the asynchronous
Vue playback snapshot/DOM update. Gate initial display on both first paint and
a mini-renderer acknowledgement after snapshot, nextTick and two animation
frames. Force native clipping immediately before display, not only afterward.
Only the owned mini renderer can acknowledge readiness. Keep the main view
available until completion; fail closed/recover the main window after a startup
timeout, load error, close or disposal. Duplicate readiness must not restore a
deliberately minimized mini window.

The exact user-specific Windows flash remains unconfirmed until first-display
checks and user revalidation; do not claim the proposed explanation is proven.
