package com.listenmusic.service;

import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class FlacMetadataParser {
    public FlacMetadata parse(Path file) {
        try (DataInputStream input = new DataInputStream(Files.newInputStream(file))) {
            byte[] magic = input.readNBytes(4);
            if (!"fLaC".equals(new String(magic, StandardCharsets.US_ASCII))) {
                throw new IllegalArgumentException("Not a FLAC file: " + file);
            }

            Map<String, String> comments = new LinkedHashMap<>();
            byte[] cover = null;
            String coverMimeType = null;
            long durationSeconds = 0;
            boolean lastBlock = false;

            while (!lastBlock) {
                int header = input.readUnsignedByte();
                lastBlock = (header & 0x80) != 0;
                int blockType = header & 0x7f;
                int length = readUnsignedMedium(input);
                byte[] block = input.readNBytes(length);
                if (block.length != length) {
                    throw new IOException("Unexpected end of FLAC metadata block");
                }

                if (blockType == 0) {
                    durationSeconds = readDurationSeconds(block);
                } else if (blockType == 4) {
                    readVorbisComments(block, comments);
                } else if (blockType == 6) {
                    Picture picture = readPicture(block);
                    if (picture != null && cover == null) {
                        cover = picture.data();
                        coverMimeType = picture.mimeType();
                    }
                }
            }

            return new FlacMetadata(
                firstValue(comments, "TITLE"),
                firstValue(comments, "ARTIST"),
                firstValue(comments, "ALBUM"),
                durationSeconds,
                firstValue(comments, "LYRICS", "UNSYNCEDLYRICS", "SYNCEDLYRICS"),
                cover,
                coverMimeType
            );
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to parse FLAC metadata: " + file, ex);
        }
    }

    private static long readDurationSeconds(byte[] block) {
        if (block.length < 18) {
            return 0;
        }
        long sampleRate = ((long) (block[10] & 0xff) << 12)
            | ((long) (block[11] & 0xff) << 4)
            | ((block[12] & 0xff) >>> 4);
        long totalSamples = ((long) (block[13] & 0x0f) << 32)
            | ((long) (block[14] & 0xff) << 24)
            | ((long) (block[15] & 0xff) << 16)
            | ((long) (block[16] & 0xff) << 8)
            | (block[17] & 0xffL);
        return sampleRate == 0 ? 0 : Math.round((double) totalSamples / sampleRate);
    }

    private static void readVorbisComments(byte[] block, Map<String, String> comments) throws IOException {
        try (DataInputStream input = new DataInputStream(new ByteArrayInputStream(block))) {
            int vendorLength = readLittleEndianInt(input);
            skipFully(input, vendorLength);
            int count = readLittleEndianInt(input);
            for (int i = 0; i < count; i++) {
                int length = readLittleEndianInt(input);
                String comment = new String(input.readNBytes(length), StandardCharsets.UTF_8);
                int separator = comment.indexOf('=');
                if (separator > 0) {
                    comments.putIfAbsent(
                        comment.substring(0, separator).toUpperCase(),
                        comment.substring(separator + 1)
                    );
                }
            }
        }
    }

    private static Picture readPicture(byte[] block) throws IOException {
        try (DataInputStream input = new DataInputStream(new ByteArrayInputStream(block))) {
            readInt(input);
            int mimeLength = readInt(input);
            String mimeType = new String(input.readNBytes(mimeLength), StandardCharsets.US_ASCII);
            int descriptionLength = readInt(input);
            skipFully(input, descriptionLength);
            readInt(input);
            readInt(input);
            readInt(input);
            readInt(input);
            int dataLength = readInt(input);
            if (dataLength < 0 || dataLength > input.available()) {
                return null;
            }
            return new Picture(mimeType, input.readNBytes(dataLength));
        }
    }

    private static String firstValue(Map<String, String> values, String... keys) {
        for (String key : keys) {
            String value = values.get(key);
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static int readUnsignedMedium(DataInputStream input) throws IOException {
        return (input.readUnsignedByte() << 16)
            | (input.readUnsignedByte() << 8)
            | input.readUnsignedByte();
    }

    private static int readLittleEndianInt(DataInputStream input) throws IOException {
        return input.readUnsignedByte()
            | (input.readUnsignedByte() << 8)
            | (input.readUnsignedByte() << 16)
            | (input.readUnsignedByte() << 24);
    }

    private static int readInt(DataInputStream input) throws IOException {
        return input.readInt();
    }

    private static void skipFully(DataInputStream input, int length) throws IOException {
        int remaining = length;
        while (remaining > 0) {
            int skipped = input.skipBytes(remaining);
            if (skipped <= 0) {
                throw new IOException("Unexpected end of metadata");
            }
            remaining -= skipped;
        }
    }

    private record Picture(String mimeType, byte[] data) {
    }
}
