package com.listenmusic.service;

import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class LocalFilenameMetadataParser {
    private static final Pattern TRACK_PREFIX = Pattern.compile("^\\s*\\d{1,3}\\s*-\\s*");
    private static final Pattern EXPLICIT_SEPARATOR = Pattern.compile("\\s+-\\s+");

    public Optional<ParsedMetadata> parse(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return Optional.empty();
        }
        String baseName = stripExtension(fileName).trim();
        baseName = TRACK_PREFIX.matcher(baseName).replaceFirst("");
        Matcher separator = EXPLICIT_SEPARATOR.matcher(baseName);
        if (!separator.find()) {
            return Optional.empty();
        }
        String artist = baseName.substring(0, separator.start()).trim();
        String title = baseName.substring(separator.end()).trim();
        return artist.isEmpty() || title.isEmpty()
            ? Optional.empty()
            : Optional.of(new ParsedMetadata(title, artist));
    }

    private static String stripExtension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.substring(0, dot) : fileName;
    }

    public record ParsedMetadata(String title, String artist) {
    }
}
