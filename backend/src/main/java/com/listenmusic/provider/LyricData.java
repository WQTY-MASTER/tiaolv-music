package com.listenmusic.provider;

import java.util.List;

public record LyricData(
    String lyrics,
    String translation,
    String format,
    String source,
    List<LyricCredit> credits
) {
    public LyricData {
        credits = credits == null ? List.of() : List.copyOf(credits);
    }
}
