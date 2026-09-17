package com.example.demo.points;

import java.awt.image.BufferedImage;
import java.io.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** 登録と写真を同じトランザクションで保存する。SQLとDBの関係が授業でも追いやすい構成。 */
@Service
public class PointService {

    private final JdbcTemplate db;
    private final Accounts accounts;
    private final UndoService undo;

    public PointService(JdbcTemplate db, Accounts accounts, UndoService undo) {
        this.db = db;
        this.accounts = accounts;
        this.undo = undo;
    }

    @Transactional(readOnly = true)
    public List<PointView> list() {
        var photos = db.query(
            "SELECT ph.id, ph.point_id FROM point_photos ph JOIN points p ON p.id=ph.point_id WHERE p.owner_id=? ORDER BY sort_order",
            (rs, n) ->
                Map.entry(
                    rs.getLong("point_id"),
                    new PointView.Photo(rs.getLong("id"), "/api/photos/" + rs.getLong("id"))
                ),
            accounts.currentId()
        );
        Map<Long, List<PointView.Photo>> byPoint = new HashMap<>();
        for (var p : photos)
            byPoint.computeIfAbsent(p.getKey(), key -> new ArrayList<>()).add(p.getValue());
        return db.query(
            "SELECT * FROM points WHERE owner_id=? ORDER BY updated_at DESC, id DESC",
            (rs, n) ->
                new PointView(
                    rs.getLong("id"),
                    rs.getString("title"),
                    rs.getDouble("latitude"),
                    rs.getDouble("longitude"),
                    rs.getString("municipality"),
                    rs.getString("memo"),
                    rs.getObject("created_at", OffsetDateTime.class),
                    rs.getObject("updated_at", OffsetDateTime.class),
                    byPoint.getOrDefault(rs.getLong("id"), List.of()),
                    rs.getBoolean("favorite")
                ),
            accounts.currentId()
        );
    }

    @Transactional(readOnly = true)
    public PointView get(long id) {
        return list()
            .stream()
            .filter(p -> p.id() == id)
            .findFirst()
            .orElseThrow(() -> missing());
    }

    @Transactional
    public PointView save(Long id, PointInput input, List<MultipartFile> files) {
        long owner = accounts.currentId();
        undo.lock(owner);
        if (!Double.isFinite(input.latitude()) || !Double.isFinite(input.longitude())) throw bad(
            "正しい緯度・経度を指定してください。"
        );
        if (
            new HashSet<>(input.retainedPhotoIds()).size() != input.retainedPhotoIds().size()
        ) throw bad("写真が重複しています。");
        if (input.retainedPhotoIds().size() + files.size() > 3) throw bad("写真は3枚までです。");
        if (id == null && !input.retainedPhotoIds().isEmpty()) throw bad(
            "新規登録の写真指定が不正です。"
        );
        // 同じ登録リクエストの再送は1件にまとめる（応答が途切れた場合の再試行にも対応）。
        if (id == null) {
            var previous = db.queryForList(
                "SELECT id FROM points WHERE request_id=? AND owner_id=?",
                Long.class,
                input.requestId(),
                owner
            );
            if (!previous.isEmpty()) return get(previous.get(0));
        } else {
            var locked = db.queryForList(
                "SELECT id FROM points WHERE id=? AND owner_id=? FOR UPDATE",
                Long.class,
                id,
                owner
            );
            if (locked.isEmpty()) throw missing();
            var owned = db.queryForList(
                "SELECT id FROM point_photos WHERE point_id=?",
                Long.class,
                id
            );
            if (!owned.containsAll(input.retainedPhotoIds())) throw bad(
                "このポイントに属さない写真です。"
            );
        }
        String before = id == null ? null : undo.snapshot(id, owner);
        var prepared = new ArrayList<ImageData>();
        for (MultipartFile file : files) prepared.add(prepare(file));
        String city = input.municipality() == null ? "" : input.municipality().trim();
        String title = input.title() == null ? "" : input.title().trim();
        if (title.isEmpty()) title =
            LocalDateTime.now(ZoneId.of("Asia/Tokyo")).format(
                DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm")
            ) + (city.isEmpty() ? " のポイント" : " " + city);
        if (title.length() > 100) title = title.substring(0, 100);
        String memo = input.memo() == null ? "" : input.memo();
        if (id == null) {
            var ids = db.queryForList(
                "INSERT INTO points(request_id,title,latitude,longitude,municipality,memo,owner_id) VALUES (?,?,?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING RETURNING id",
                Long.class,
                input.requestId(),
                title,
                input.latitude(),
                input.longitude(),
                city,
                memo,
                owner
            );
            if (ids.isEmpty()) throw bad(
                "登録リクエストが重複しています。画面を開き直してください。"
            );
            id = ids.get(0);
        } else {
            db.update(
                "UPDATE points SET title=?,latitude=?,longitude=?,municipality=?,memo=?,updated_at=now() WHERE id=?",
                title,
                input.latitude(),
                input.longitude(),
                city,
                memo,
                id
            );
        }
        // 既存写真を保持し、新しい順序を割り当ててから一括再登録。
        var kept = new ArrayList<ImageData>();
        for (Long photoId : input.retainedPhotoIds()) kept.add(photo(photoId));
        db.update("DELETE FROM point_photos WHERE point_id=?", id);
        kept.addAll(prepared);
        for (int i = 0; i < kept.size(); i++) db.update(
            "INSERT INTO point_photos(point_id,image_data,content_type,sort_order) VALUES (?,?,?,?)",
            id,
            kept.get(i).bytes(),
            kept.get(i).type(),
            i
        );
        undo.record(owner, id, before == null ? "CREATE" : "EDIT", title, before);
        return get(id);
    }

    public record ImageData(byte[] bytes, String type) {}

    @Transactional
    public PointView favorite(long id, boolean value) {
        long owner = accounts.currentId();
        undo.lock(owner);
        var point = get(id);
        if (point.favorite() == value) return point;
        String before = undo.snapshot(id, owner);
        db.update("UPDATE points SET favorite=? WHERE id=? AND owner_id=?", value, id, owner);
        undo.record(owner, id, "FAVORITE", point.title(), before);
        return get(id);
    }

    @Transactional(readOnly = true)
    public ImageData photo(long id) {
        return db
            .query(
                "SELECT ph.image_data,ph.content_type FROM point_photos ph JOIN points p ON p.id=ph.point_id WHERE ph.id=? AND p.owner_id=?",
                (rs, n) -> new ImageData(rs.getBytes(1), rs.getString(2)),
                id,
                accounts.currentId()
            )
            .stream()
            .findFirst()
            .orElseThrow(() -> missing());
    }

    @Transactional
    public void delete(long id) {
        long owner = accounts.currentId();
        undo.lock(owner);
        var point = get(id);
        String before = undo.snapshot(id, owner);
        if (
            db.update("DELETE FROM points WHERE id=? AND owner_id=?", id, owner) == 0
        ) throw missing();
        undo.record(owner, id, "DELETE", point.title(), before);
    }

    private ImageData prepare(MultipartFile file) {
        if (file.isEmpty() || file.getSize() > 5 * 1024 * 1024) throw bad(
            "写真は1枚5MB以下にしてください。"
        );
        try (var stream = ImageIO.createImageInputStream(file.getInputStream())) {
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw bad("JPEGまたはPNGの写真を選んでください。");
            var reader = readers.next();
            try {
                reader.setInput(stream);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!Set.of("jpeg", "jpg", "png").contains(format)) throw bad(
                    "JPEGまたはPNGの写真を選んでください。"
                );
                if ((long) reader.getWidth(0) * reader.getHeight(0) > 25_000_000) throw bad(
                    "写真は2500万画素以下にしてください。"
                );
                BufferedImage image = reader.read(0);
                var out = new ByteArrayOutputStream();
                // 再エンコードで画像以外の埋め込み情報を保存しない。
                ImageIO.write(image, format.equals("png") ? "png" : "jpeg", out);
                return new ImageData(
                    out.toByteArray(),
                    format.equals("png") ? "image/png" : "image/jpeg"
                );
            } finally {
                reader.dispose();
            }
        } catch (IOException ex) {
            throw bad("写真を読み取れませんでした。");
        }
    }

    private ResponseStatusException missing() {
        return new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "ポイントまたは写真が見つかりません。"
        );
    }

    private ResponseStatusException bad(String text) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, text);
    }
}
