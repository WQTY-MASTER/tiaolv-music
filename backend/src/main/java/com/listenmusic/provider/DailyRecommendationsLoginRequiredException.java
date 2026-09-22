package com.listenmusic.provider;

public class DailyRecommendationsLoginRequiredException extends ProviderLoginRequiredException {
    public DailyRecommendationsLoginRequiredException() {
        super("网易云每日推荐需要登录");
    }
}
