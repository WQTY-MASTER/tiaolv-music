package com.listenmusic.service;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalFilenameMetadataParserTest {
    private final LocalFilenameMetadataParser parser = new LocalFilenameMetadataParser();

    @Test
    void parsesArtistAndKeepsTheRemainingTitleAfterTheFirstSeparator() {
        LocalFilenameMetadataParser.ParsedMetadata result = parser
            .parse("歌手 - 歌名 - Live.flac")
            .orElseThrow();

        assertEquals("歌手", result.artist());
        assertEquals("歌名 - Live", result.title());
    }

    @Test
    void removesANumericTrackPrefixBeforeParsing() {
        LocalFilenameMetadataParser.ParsedMetadata result = parser
            .parse("01 - 歌手 - 歌名.flac")
            .orElseThrow();

        assertEquals("歌手", result.artist());
        assertEquals("歌名", result.title());
    }

    @Test
    void skipsNamesWithoutTheExplicitSpacedSeparator() {
        Optional<LocalFilenameMetadataParser.ParsedMetadata> result = parser.parse("没有分隔符.flac");

        assertTrue(result.isEmpty());
    }
}
