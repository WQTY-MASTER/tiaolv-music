package com.listenmusic.provider;

public record HomepagePlaylist(
    String id,
    String title,
    String subtitle,
    String imageUrl,
    int count,
    boolean createdByAccount,
    boolean deletable,
    boolean favorite,
    String recommendationSource,
    String recommendationReason
) {
    public HomepagePlaylist(String id, String title, String subtitle, String imageUrl, int count, boolean createdByAccount, boolean deletable, boolean favorite) {
        this(id, title, subtitle, imageUrl, count, createdByAccount, deletable, favorite, null, null);
    }

    public HomepagePlaylist withRecommendation(String source, String reason) {
        return new HomepagePlaylist(id, title, subtitle, imageUrl, count, createdByAccount, deletable, favorite, source, reason);
    }
    public HomepagePlaylist(String id, String title, String subtitle, String imageUrl, int count, boolean createdByAccount, boolean deletable) {
        this(id, title, subtitle, imageUrl, count, createdByAccount, deletable, false);
    }
    public HomepagePlaylist(String id, String title, String subtitle, String imageUrl, int count, boolean createdByAccount) {
        this(id, title, subtitle, imageUrl, count, createdByAccount, false);
    }
    public HomepagePlaylist(String id, String title, String subtitle, String imageUrl, int count) {
        this(id, title, subtitle, imageUrl, count, false);
    }
}
