package com.listenmusic.provider;

import java.util.List;

public record LyricData(
    String lyrics,
    String translation,
    String phonetic,
    String format,
    String source,
    List<LyricCredit> credits
) {
    public LyricData(String lyrics, String translation, String format, String source, List<LyricCredit> credits) {
        this(lyrics, translation, null, format, source, credits);
    }

    public LyricData {
        credits = credits == null ? List.of() : List.copyOf(credits);
    }
}
