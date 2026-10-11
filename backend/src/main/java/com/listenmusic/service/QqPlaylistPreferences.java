package com.listenmusic.service;

import com.listenmusic.domain.QqListeningRankEntry;
import com.listenmusic.domain.Track;
import com.listenmusic.provider.HomepagePlaylist;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class QqPlaylistPreferences {
    private QqPlaylistPreferences() {}

    static List<String> searchTerms(List<QqListeningRankEntry> ranking, List<Track> favorites) {
        Map<String, Double> scores = new LinkedHashMap<>();
        Map<String, String> labels = new LinkedHashMap<>();
        for (QqListeningRankEntry entry : ranking) {
            if (entry.playCount() <= 0 || !Double.isFinite(entry.listenedSeconds()) || entry.listenedSeconds() < 30) continue;
            double weight = Math.log1p(Math.min(entry.listenedSeconds(), 7200) / 30)
                + Math.log1p(Math.max(0, entry.playCount()));
            addTrack(scores, labels, entry.track(), weight);
        }
        Set<String> seenFavorites = new HashSet<>();
        for (Track track : favorites) {
            if (seenFavorites.add(track.id())) addTrack(scores, labels, track, 2.5);
        }
        return scores.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue(Comparator.reverseOrder()).thenComparing(Map.Entry::getKey))
            .limit(3).map(entry -> labels.get(entry.getKey())).toList();
    }

    private static void addTrack(Map<String, Double> scores, Map<String, String> labels, Track track, double weight) {
        if (track == null || !"qq".equals(track.source())) return;
        if (track.artist() != null) {
            for (String artist : track.artist().split("[/、;]")) addTerm(scores, labels, artist, weight);
        }
        addTerm(scores, labels, track.album(), weight * 0.6);
    }

    private static void addTerm(Map<String, Double> scores, Map<String, String> labels, String raw, double weight) {
        if (raw == null) return;
        String label = raw.trim();
        String key = label.toLowerCase(Locale.ROOT);
        if (label.length() < 2 || label.length() > 80 || key.startsWith("未知")
            || Set.of("unknown", "unknown artist", "unknown album", "various artists", "群星").contains(key)) return;
        scores.merge(key, weight, Double::sum);
        labels.putIfAbsent(key, label);
    }

    static List<HomepagePlaylist> blend(List<HomepagePlaylist> provider, List<HomepagePlaylist> local) {
        List<HomepagePlaylist> result = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        List<HomepagePlaylist> uniqueLocal = local.stream().filter(p -> ids.add(p.id())).limit(4).toList();
        List<HomepagePlaylist> uniqueProvider = provider.stream().filter(p -> ids.add(p.id())).toList();
        int localIndex = 0;
        int providerIndex = 0;
        while (result.size() < 12 && (localIndex < uniqueLocal.size() || providerIndex < uniqueProvider.size())) {
            if (localIndex < uniqueLocal.size() && (result.size() % 3 == 0 || providerIndex >= uniqueProvider.size())) {
                result.add(uniqueLocal.get(localIndex++));
            } else {
                result.add(uniqueProvider.get(providerIndex++));
            }
        }
        return List.copyOf(result);
    }
}
