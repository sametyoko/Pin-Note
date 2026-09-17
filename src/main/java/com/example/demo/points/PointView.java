package com.example.demo.points;

import java.time.OffsetDateTime;
import java.util.List;

public record PointView(
    long id,
    String title,
    double latitude,
    double longitude,
    String municipality,
    String memo,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<Photo> photos,
    boolean favorite
) {
    public record Photo(long id, String url) {}
}
