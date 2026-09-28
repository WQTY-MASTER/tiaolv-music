package com.listenmusic.provider;

public record HomepagePlaylist(
    String id,
    String title,
    String subtitle,
    String imageUrl,
    int count,
    boolean createdByAccount
) {
    public HomepagePlaylist(String id, String title, String subtitle, String imageUrl, int count) {
        this(id, title, subtitle, imageUrl, count, false);
    }
}
