package com.listenmusic.provider;

import java.util.List;
import java.util.Map;

public record PlaylistCategoryData(
    List<String> hotTags,
    Map<String, List<String>> groups,
    List<String> highQualityTags
) {}
