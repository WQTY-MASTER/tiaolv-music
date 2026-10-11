package com.listenmusic.service;

import com.listenmusic.domain.QqListeningDataSummary;
import com.listenmusic.domain.QqListeningRankEntry;
import com.listenmusic.domain.Track;
import com.listenmusic.repository.QqListeningStatsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Locale;

@Service
public class QqListeningStatsService {
    private static final double MAX_DELTA_SECONDS = 60;
    private static final int MAX_RANKING_TRACKS = 100;

    private final QqListeningStatsRepository repository;
    private final Clock clock;

    @Autowired
    public QqListeningStatsService(QqListeningStatsRepository repository) {
        this(repository, Clock.systemDefaultZone());
    }

    QqListeningStatsService(QqListeningStatsRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public void recordDelta(
        String accountId,
        String accountNickname,
        String accountAvatarUrl,
        Track track,
        double listenedSeconds,
        int playCount
    ) {
        if (accountId == null || accountId.isBlank()) {
            throw new IllegalArgumentException("QQ 账号 ID 不能为空");
        }
        if (track == null || track.id() == null || !track.id().startsWith("qq:")
            || !"qq".equalsIgnoreCase(track.source())) {
            throw new IllegalArgumentException("只记录 QQ 音乐歌曲");
        }
        if (!Double.isFinite(listenedSeconds) || listenedSeconds < 0 || listenedSeconds > MAX_DELTA_SECONDS) {
            throw new IllegalArgumentException("单次有效播放时长必须在 0 到 60 秒之间");
        }
        if (playCount < 0 || playCount > 1) {
            throw new IllegalArgumentException("单次有效播放次数只能是 0 或 1");
        }
        if (listenedSeconds == 0 && playCount == 0) {
            throw new IllegalArgumentException("播放增量不能为空");
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        repository.recordDelta(
            accountId.trim(), accountNickname, accountAvatarUrl, track,
            LocalDate.now(clock), listenedSeconds, playCount, now
        );
    }

    public List<QqListeningRankEntry> loadRanking(String accountId, String period, String from, String to) {
        DateRange range = rankingRange(period, from, to);
        return repository.findRanking(accountId, range.from(), range.to(), MAX_RANKING_TRACKS);
    }

    public List<QqListeningDataSummary> summaries() {
        return repository.findAccountSummaries();
    }

    public void delete(String accountId, boolean all, String from, String to) {
        if (accountId == null || accountId.isBlank()) {
            throw new IllegalArgumentException("QQ 账号 ID 不能为空");
        }
        if (all) {
            if (!isBlank(from) || !isBlank(to)) {
                throw new IllegalArgumentException("全部删除不能同时指定日期范围");
            }
            repository.deleteAll(accountId.trim());
            return;
        }
        DateRange range = customRange(from, to);
        repository.deleteRange(accountId.trim(), range.from(), range.to());
    }

    private DateRange rankingRange(String period, String from, String to) {
        String normalized = isBlank(period) ? "week" : period.trim().toLowerCase(Locale.ROOT);
        LocalDate today = LocalDate.now(clock);
        return switch (normalized) {
            case "week" -> new DateRange(
                today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)), today
            );
            case "7d" -> new DateRange(today.minusDays(6), today);
            case "all" -> {
                if (!isBlank(from) || !isBlank(to)) {
                    throw new IllegalArgumentException("全部排行不能指定日期范围");
                }
                yield new DateRange(null, null);
            }
            case "custom" -> customRange(from, to);
            default -> throw new IllegalArgumentException("不支持的听歌排行时间范围: " + period);
        };
    }

    private static DateRange customRange(String from, String to) {
        if (isBlank(from) || isBlank(to)) {
            throw new IllegalArgumentException("请选择完整的开始和结束日期");
        }
        try {
            LocalDate start = LocalDate.parse(from.trim());
            LocalDate end = LocalDate.parse(to.trim());
            if (end.isBefore(start)) {
                throw new IllegalArgumentException("结束日期不能早于开始日期");
            }
            return new DateRange(start, end);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("日期格式必须为 YYYY-MM-DD");
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record DateRange(LocalDate from, LocalDate to) {
    }
}
