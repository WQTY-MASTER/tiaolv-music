package com.listenmusic.provider;

public enum SearchType {
    SONG(1, 0),
    PLAYLIST(1000, 3),
    ARTIST(100, 1);

    private final int apiValue;
    private final int qqValue;

    SearchType(int apiValue, int qqValue) {
        this.apiValue = apiValue;
        this.qqValue = qqValue;
    }

    public int apiValue() {
        return apiValue;
    }

    public int qqValue() {
        return qqValue;
    }

    public static SearchType fromApiValue(int value) {
        for (SearchType type : values()) {
            if (type.apiValue == value) {
                return type;
            }
        }
        throw new IllegalArgumentException("不支持的搜索类型: " + value);
    }
}
