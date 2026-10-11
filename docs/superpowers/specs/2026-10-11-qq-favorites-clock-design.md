# QQ Favorites And Lyric Clock Repair

Approved by the user on 2026-10-11.

- QQ library always exposes the account's real favorites, including when the created-playlist API omits directory 201. Reuse the existing account-favorites detail route; do not create a remote playlist or duplicate a real favorite entry.
- Favorite requests include the upstream directory, TID and UTF-8 parameters. Failed saves roll back honestly and show the returned error through the existing global toast. Prevent overlapping writes for the same track.
- Bound lyric interpolation to 150 ms ahead of the media clock. Buffering, seeking, pause and playback-rate changes use the media clock; preserve real QRC timing and the NetEase line-highlight policy.
- Validate one authorized addition: QQ song MID 0034QXzv2ptMdw, title 愿戴荣光坠入天渊. Read favorites before and after; skip writing if already present. Never remove existing favorites or retry uncertain writes.
- QQ official recent-play synchronization remains unimplemented until its consumer-account upstream contract is verified. Do not present local history as successful cloud synchronization.
- Build and validate the bundled runtime and installer. Existing user services and account files must not be replaced during verification.
