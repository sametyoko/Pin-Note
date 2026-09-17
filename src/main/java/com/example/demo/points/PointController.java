package com.example.demo.points;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class PointController {

    private final PointService service;

    public PointController(PointService service) {
        this.service = service;
    }

    @GetMapping("/points")
    public List<PointView> list() {
        return service.list();
    }

    @GetMapping("/points/{id}")
    public PointView get(@PathVariable long id) {
        return service.get(id);
    }

    public record FavoriteInput(@jakarta.validation.constraints.NotNull Boolean favorite) {}

    @PatchMapping("/points/{id}/favorite")
    public PointView favorite(@PathVariable long id, @Valid @RequestBody FavoriteInput data) {
        return service.favorite(id, data.favorite());
    }

    @PostMapping(value = "/points", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PointView create(
        @Valid @RequestPart("data") PointInput data,
        @RequestPart(value = "photos", required = false) List<MultipartFile> photos
    ) {
        return service.save(null, data, photos == null ? List.of() : photos);
    }

    @PutMapping(value = "/points/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PointView update(
        @PathVariable long id,
        @Valid @RequestPart("data") PointInput data,
        @RequestPart(value = "photos", required = false) List<MultipartFile> photos
    ) {
        return service.save(id, data, photos == null ? List.of() : photos);
    }

    @DeleteMapping("/points/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        service.delete(id);
    }

    @GetMapping("/photos/{id}")
    public ResponseEntity<byte[]> photo(@PathVariable long id) {
        var p = service.photo(id);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(p.type()))
            .header("X-Content-Type-Options", "nosniff")
            .cacheControl(CacheControl.noStore())
            .body(p.bytes());
    }
}
