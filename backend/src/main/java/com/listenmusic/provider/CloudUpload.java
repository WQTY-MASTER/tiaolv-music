package com.listenmusic.provider;

public record CloudUpload(String fileName, String contentType, byte[] bytes) {
}
