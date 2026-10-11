package com.listenmusic.service;

import com.listenmusic.domain.Track;
import com.listenmusic.repository.QqListeningStatsRepository;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class QqListeningStatsServiceTest {
    private final QqListeningStatsRepository repository = mock(QqListeningStatsRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-08T06:30:00Z"), ZoneId.of("Asia/Shanghai"));
    private final QqListeningStatsService service = new QqListeningStatsService(repository, clock);

    @Test
    void springCanCreateTheServiceWithItsRepositoryDependency() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(QqListeningStatsRepository.class, () -> repository);
            context.register(QqListeningStatsService.class);
            context.refresh();

            assertThat(context.getBean(QqListeningStatsService.class)).isNotNull();
        }
    }

    @Test
    void recordsAValidatedDeltaForTheCapturedAccountAndLocalDate() {
        Track track = track("qq:mid-1");

        service.recordDelta("100", "QQ用户", "https://img.test/avatar.jpg", track, 15.25, 1);

        verify(repository).recordDelta(
            "100", "QQ用户", "https://img.test/avatar.jpg", track,
            LocalDate.parse("2026-10-08"), 15.25, 1,
            java.time.OffsetDateTime.parse("2026-10-08T14:30+08:00")
        );
    }

    @Test
    void rejectsInvalidSourcesDeltasAndPlayCounts() {
        assertThatThrownBy(() -> service.recordDelta("", "QQ用户", null, track("qq:1"), 10, 0))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.recordDelta("100", "QQ用户", null, track("netease:1"), 10, 0))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.recordDelta("100", "QQ用户", null, track("qq:1"), Double.NaN, 0))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.recordDelta("100", "QQ用户", null, track("qq:1"), -1, 0))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.recordDelta("100", "QQ用户", null, track("qq:1"), 61, 0))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.recordDelta("100", "QQ用户", null, track("qq:1"), 10, 2))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.recordDelta("100", "QQ用户", null, track("qq:1"), 0, 0))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void resolvesWeekSevenDayAllAndCustomRanges() {
        service.loadRanking("100", "week", null, null);
        verify(repository).findRanking("100", LocalDate.parse("2026-10-05"), LocalDate.parse("2026-10-08"), 100);

        service.loadRanking("100", "7d", null, null);
        verify(repository).findRanking("100", LocalDate.parse("2026-10-02"), LocalDate.parse("2026-10-08"), 100);

        service.loadRanking("100", "all", null, null);
        verify(repository).findRanking("100", null, null, 100);

        service.loadRanking("100", "custom", "2026-09-01", "2026-09-30");
        verify(repository).findRanking("100", LocalDate.parse("2026-09-01"), LocalDate.parse("2026-09-30"), 100);
    }

    @Test
    void rejectsIncompleteReversedAndUnknownRanges() {
        assertThatThrownBy(() -> service.loadRanking("100", "custom", "2026-09-01", null))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.loadRanking("100", "custom", "2026-10-02", "2026-10-01"))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.loadRanking("100", "month", null, null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void deletesOnlyAnExplicitRangeOrTheWholeSelectedAccount() {
        service.delete("100", false, "2026-09-01", "2026-09-30");
        verify(repository).deleteRange("100", LocalDate.parse("2026-09-01"), LocalDate.parse("2026-09-30"));

        service.delete("200", true, null, null);
        verify(repository).deleteAll("200");

        assertThatThrownBy(() -> service.delete("100", true, "2026-09-01", "2026-09-30"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    private static Track track(String id) {
        return new Track(
            id, "测试歌曲", "测试歌手", "测试专辑", 180L, "qq", null, null,
            "https://img.test/cover.jpg", null, null, null, null, null
        );
    }
}
