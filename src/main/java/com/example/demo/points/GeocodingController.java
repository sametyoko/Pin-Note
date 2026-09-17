package com.example.demo.points;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

/** 市区町村は補助情報。外部サービスに失敗しても場所の登録は可能。 */
@RestController
public class GeocodingController {

    private final String endpoint;
    private final boolean enabled;
    private final ObjectMapper json;
    private final HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(3))
        .build();
    private final Map<String, String> cache = new LinkedHashMap<>();
    private long lastRequest;

    public GeocodingController(
        @Value("${pin-note.geocoding-url}") String endpoint,
        @Value("${pin-note.geocoding-enabled}") boolean enabled,
        ObjectMapper json
    ) {
        this.endpoint = endpoint;
        this.enabled = enabled;
        this.json = json;
    }

    @GetMapping("/api/municipality")
    public synchronized Map<String, String> reverse(
        @RequestParam double latitude,
        @RequestParam double longitude
    ) {
        if (
            !enabled ||
            !Double.isFinite(latitude) ||
            !Double.isFinite(longitude) ||
            Math.abs(latitude) > 90 ||
            Math.abs(longitude) > 180
        ) return result("");
        String key = String.format(Locale.ROOT, "%.5f,%.5f", latitude, longitude);
        if (cache.containsKey(key)) return result(cache.get(key));
        // アプリ全体で1秒以上空ける。混雑時は日時のみの名前にフォールバック。
        if (System.currentTimeMillis() - lastRequest < 1100) return result("");
        lastRequest = System.currentTimeMillis();
        try {
            var uri = URI.create(
                endpoint +
                    String.format(
                        Locale.ROOT,
                        "?format=jsonv2&lat=%.6f&lon=%.6f&zoom=10&addressdetails=1&accept-language=ja",
                        latitude,
                        longitude
                    )
            );
            var req = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(4))
                .header("User-Agent", "PinNote-Classroom/0.1 (local personal map notebook)")
                .GET()
                .build();
            var response = client.send(req, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return result("");
            var address = json.readTree(response.body()).path("address");
            String city = "";
            for (String name : List.of(
                "city",
                "town",
                "village",
                "municipality",
                "city_district"
            )) {
                if (address.hasNonNull(name)) {
                    city = address.get(name).asText();
                    break;
                }
            }
            if (city.length() > 100) city = city.substring(0, 100);
            if (cache.size() >= 500) cache.remove(cache.keySet().iterator().next());
            cache.put(key, city);
            return result(city);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return result("");
        } catch (Exception e) {
            return result("");
        }
    }

    private Map<String, String> result(String city) {
        return Map.of("municipality", city);
    }
}
