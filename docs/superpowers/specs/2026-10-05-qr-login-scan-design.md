# QR Login Scan Design

## Goal

Make the QR login panel identify the selected Chinese music platform clearly and add a restrained animated horizontal scan line over an active QR code.

## Behavior

- The title is `登录 网易云音乐` for NetEase and `登录 QQ音乐` for QQ.
- The scan line is visible only when a QR image exists and the login state is `WAITING` or `CONFIRMING`.
- Expired, failed, loading, authenticated, and account-summary states do not animate.
- The scan line stays inside the QR frame and never blocks pointer input or QR readability.
- When reduced motion is requested, the line becomes a static low-opacity marker.

## Implementation

Keep the behavior in `AuthPanel.vue`: derive an `isScanning` state, apply a `scanning` class to the existing QR frame, and render the effect with a CSS pseudo-element. No canvas, timer, or new dependency is needed.

## Verification

Extend the authentication UI contract test, run it before and after implementation, then run the Electron build and authentication smoke checks.
