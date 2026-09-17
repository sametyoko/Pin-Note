package com.example.demo.points;

import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;

public record PointInput(
    @NotNull UUID requestId,
    @Size(max = 100) String title,
    @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
    @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
    @Size(max = 100) String municipality,
    @Size(max = 1000) String memo,
    @NotNull @Size(max = 3) List<@NotNull Long> retainedPhotoIds
) {}
