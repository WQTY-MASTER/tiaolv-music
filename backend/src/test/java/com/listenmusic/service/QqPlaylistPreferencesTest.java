package com.listenmusic.service;

import com.listenmusic.domain.QqListeningRankEntry;
import com.listenmusic.provider.HomepagePlaylist;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import static org.junit.jupiter.api.Assertions.*;

class QqPlaylistPreferencesTest {
    @Test
    void boundsTheLocalShareAndDeduplicatesPlaylistIds() {
        List<HomepagePlaylist> official = IntStream.range(0, 20)
            .mapToObj(i -> playlist("qq:" + i)).toList();
        List<HomepagePlaylist> local = new ArrayList<>();
        local.add(playlist("qq:0"));
        local.add(playlist("qq:0"));
        IntStream.range(20, 30).forEach(i -> local.add(playlist("qq:" + i)));
        List<HomepagePlaylist> result = QqPlaylistPreferences.blend(official, local);
        assertEquals(12, result.size());
        assertEquals(12, result.stream().map(HomepagePlaylist::id).distinct().count());
        assertEquals(4, result.stream().filter(local::contains).count());
        assertEquals(List.of("qq:0", "qq:1", "qq:2", "qq:20"), result.subList(0, 4).stream().map(HomepagePlaylist::id).toList());
    }

    @Test
    void ranksRepeatedEffectiveListeningAboveAnIsolatedFavorite() {
        var track = AccountCatalogRecommendationsTest.track("鸣潮先约电台/苏诗丁", "心月辞");
        var ranking = List.of(new QqListeningRankEntry(track, 10, 2000, "2026-10-09T00:00:00Z"));
        var favorites = List.of(AccountCatalogRecommendationsTest.track("Other artist", "Other album"));
        var terms = QqPlaylistPreferences.searchTerms(ranking, favorites);
        assertEquals(3, terms.size());
        assertTrue(terms.contains("鸣潮先约电台"));
        assertFalse(terms.contains("Other artist"));
    }

    @Test
    void ignoresUnknownLabelsAndDoesNotMultiplyDuplicateFavorites() {
        var unknown = AccountCatalogRecommendationsTest.track("未知歌手", "未知专辑");
        assertTrue(QqPlaylistPreferences.searchTerms(List.of(), List.of(unknown)).isEmpty());
        var favorite = AccountCatalogRecommendationsTest.track("Artist", "Album");
        assertEquals(QqPlaylistPreferences.searchTerms(List.of(), List.of(favorite)),
            QqPlaylistPreferences.searchTerms(List.of(), List.of(favorite, favorite)));
    }

    private static HomepagePlaylist playlist(String id) {
        return new HomepagePlaylist(id, "Playlist", "Creator", "cover", 10);
    }
}
