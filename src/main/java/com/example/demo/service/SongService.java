package com.example.demo.service;

import com.example.demo.model.Song;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class SongService {

    private final OkHttpClient httpClient = new OkHttpClient();

    public List<Song> searchSongs(String term) throws IOException {
        List<Song> songs = new ArrayList<>();
        String encodedTerm = URLEncoder.encode(term, StandardCharsets.UTF_8.toString());
        String url = "https://itunes.apple.com/search?term=" + encodedTerm + "&media=music&entity=song";

        Request request = new Request.Builder().url(url).build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) throw new IOException("Unexpected code " + response);

            JSONObject jsonResponse = new JSONObject(response.body().string());
            JSONArray results = jsonResponse.getJSONArray("results");

            for (int i = 0; i < results.length(); i++) {
                JSONObject track = results.getJSONObject(i);
                String trackName = track.optString("trackName", "Unknown Track");
                String artistName = track.optString("artistName", "Unknown Artist");
                String previewUrl = track.optString("previewUrl", null);

                if (previewUrl != null) {
                    songs.add(new Song(trackName, artistName, previewUrl));
                }
            }
        }
        return songs;
    }
}
