package com.example.demo.model;

public class Song {
    private String trackName;
    private String artistName;
    private String previewUrl;

    public Song(String trackName, String artistName, String previewUrl) {
        this.trackName = trackName;
        this.artistName = artistName;
        this.previewUrl = previewUrl;
    }

    // Getters and Setters
    public String getTrackName() {
        return trackName;
    }

    public void setTrackName(String trackName) {
        this.trackName = trackName;
    }

    public String getArtistName() {
        return artistName;
    }

    public void setArtistName(String artistName) {
        this.artistName = artistName;
    }

    public String getPreviewUrl() {
        return previewUrl;
    }

    public void setPreviewUrl(String previewUrl) {
        this.previewUrl = previewUrl;
    }
}
