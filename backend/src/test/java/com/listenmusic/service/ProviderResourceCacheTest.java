package com.listenmusic.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.listenmusic.provider.LyricData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.test.util.TestPropertyValues;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProviderResourceCacheTest {
    @TempDir
    Path tempDirectory;

    @Test
    void springCanCreateTheCacheServiceWithItsInjectedConstructor() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            TestPropertyValues.of(
                "listenmusic.cache.config-file=" + tempDirectory.resolve("spring-cache-settings.json")
            ).applyTo(context);
            context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
            context.register(ProviderResourceCache.class);
            context.refresh();

            assertTrue(context.getBean(ProviderResourceCache.class).settings().coverEnabled());
        }
    }

    @Test
    void defaultsEveryCategoryToEnabledAndUsesTheManagedDirectory() {
        ProviderResourceCache cache = cacheAt(tempDirectory.resolve("cache-settings.json"));

        ProviderResourceCache.Settings settings = cache.settings();

        assertEquals(tempDirectory.resolve("cache").toAbsolutePath().normalize().toString(), settings.directory());
        assertTrue(settings.coverEnabled());
        assertTrue(settings.lyricsEnabled());
        assertTrue(settings.metadataEnabled());
    }

    @Test
    void isolatesEntriesByProviderResourceAndCategory() {
        ProviderResourceCache cache = cacheAt(tempDirectory.resolve("cache-settings.json"));
        LyricData netease = new LyricData("网易云歌词", "翻译", "LRC", "netease", List.of());
        LyricData qq = new LyricData("QQ 逐字歌词", "翻译", "QRC", "qq", List.of());

        cache.write(ProviderResourceCache.Category.LYRICS, "netease", "123", netease);
        cache.write(ProviderResourceCache.Category.LYRICS, "qq", "123", qq);

        assertEquals(
            "网易云歌词",
            cache.read(ProviderResourceCache.Category.LYRICS, "netease", "123", LyricData.class)
                .orElseThrow().lyrics()
        );
        assertEquals(
            "QQ 逐字歌词",
            cache.read(ProviderResourceCache.Category.LYRICS, "qq", "123", LyricData.class)
                .orElseThrow().lyrics()
        );
        assertTrue(cache.read(ProviderResourceCache.Category.METADATA, "qq", "123", LyricData.class).isEmpty());
    }

    @Test
    void disablingACategoryStopsNewWritesWithoutDeletingExistingEntries() {
        Path configFile = tempDirectory.resolve("cache-settings.json");
        ProviderResourceCache cache = cacheAt(configFile);
        LyricData original = new LyricData("原歌词", "", "LRC", "netease", List.of());
        cache.write(ProviderResourceCache.Category.LYRICS, "netease", "123", original);

        cache.update(new ProviderResourceCache.Settings(
            cache.settings().directory(), true, false, true
        ));
        cache.write(
            ProviderResourceCache.Category.LYRICS,
            "netease",
            "123",
            new LyricData("不应覆盖", "", "QRC", "netease", List.of())
        );

        assertEquals(
            "原歌词",
            cache.read(ProviderResourceCache.Category.LYRICS, "netease", "123", LyricData.class)
                .orElseThrow().lyrics()
        );
        ProviderResourceCache reloaded = cacheAt(configFile);
        assertFalse(reloaded.settings().lyricsEnabled());
    }

    @Test
    void reportsManagedUsageAndClearsOnlyManagedEntries() throws Exception {
        ProviderResourceCache cache = cacheAt(tempDirectory.resolve("cache-settings.json"));
        cache.write(
            ProviderResourceCache.Category.LYRICS,
            "netease",
            "123",
            new LyricData("歌词", "翻译", "LRC", "netease", List.of())
        );
        cache.write(
            ProviderResourceCache.Category.METADATA,
            "qq",
            "456",
            new SampleMetadata("歌曲")
        );
        Path unrelated = Path.of(cache.settings().directory()).resolve("offline-download.flac");
        Files.writeString(unrelated, "do not delete");
        Path unrelatedCover = Path.of(cache.settings().directory()).resolve("cover").resolve("family.jpg");
        Files.createDirectories(unrelatedCover.getParent());
        Files.writeString(unrelatedCover, "also do not delete");

        ProviderResourceCache.Statistics before = cache.statistics();
        assertEquals(2, before.totalEntries());
        assertTrue(before.totalBytes() > 0);
        assertEquals(1, before.lyrics().entries());
        assertEquals(1, before.metadata().entries());

        cache.clear();

        ProviderResourceCache.Statistics after = cache.statistics();
        assertEquals(0, after.totalEntries());
        assertEquals(0, after.totalBytes());
        assertTrue(Files.exists(unrelated));
        assertTrue(Files.exists(unrelatedCover));
    }

    @Test
    void movesManagedEntriesWhenTheDirectoryChangesAndCanRestoreDefault() {
        ProviderResourceCache cache = cacheAt(tempDirectory.resolve("cache-settings.json"));
        cache.write(
            ProviderResourceCache.Category.METADATA,
            "netease",
            "123",
            new SampleMetadata("迁移歌曲")
        );
        Path customDirectory = tempDirectory.resolve("custom-cache");

        cache.update(new ProviderResourceCache.Settings(customDirectory.toString(), true, true, true));

        assertEquals(
            "迁移歌曲",
            cache.read(ProviderResourceCache.Category.METADATA, "netease", "123", SampleMetadata.class)
                .orElseThrow().title()
        );
        assertEquals(customDirectory.toAbsolutePath().normalize().toString(), cache.settings().directory());

        cache.restoreDefaultDirectory();

        assertEquals(tempDirectory.resolve("cache").toAbsolutePath().normalize().toString(), cache.settings().directory());
        assertEquals(
            "迁移歌曲",
            cache.read(ProviderResourceCache.Category.METADATA, "netease", "123", SampleMetadata.class)
                .orElseThrow().title()
        );
    }

    private ProviderResourceCache cacheAt(Path configFile) {
        return new ProviderResourceCache(new ObjectMapper(), configFile);
    }

    private record SampleMetadata(String title) {
    }
}
