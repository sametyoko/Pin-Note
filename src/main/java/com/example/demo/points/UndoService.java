package com.example.demo.points;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UndoService {

    private final JdbcTemplate db;

    public UndoService(JdbcTemplate db) {
        this.db = db;
    }

    public void lock(long owner) {
        db.queryForList("SELECT id FROM app_users WHERE id=? FOR UPDATE", owner);
    }

    public String snapshot(long id, long owner) {
        var rows = db.queryForList(
            "SELECT jsonb_build_object('point',to_jsonb(p),'photos',COALESCE((SELECT jsonb_agg(to_jsonb(ph)) FROM point_photos ph WHERE ph.point_id=p.id),'[]'::jsonb))::text AS snapshot FROM points p WHERE p.id=? AND p.owner_id=?",
            id,
            owner
        );
        return rows.isEmpty() ? null : (String) rows.get(0).get("snapshot");
    }

    public void record(long owner, long point, String action, String title, String snapshot) {
        db.update("DELETE FROM point_history WHERE owner_id=? AND redo=true", owner);
        db.update(
            "INSERT INTO point_history(owner_id,point_id,action,title,snapshot) VALUES (?,?,?,?,?::jsonb)",
            owner,
            point,
            action,
            title,
            snapshot
        );
        db.update(
            "DELETE FROM point_history WHERE owner_id=? AND id NOT IN (SELECT id FROM point_history WHERE owner_id=? ORDER BY id DESC LIMIT 10)",
            owner,
            owner
        );
    }

    public List<Map<String, Object>> list(long owner) {
        return list(owner, false);
    }

    public List<Map<String, Object>> list(long owner, boolean redo) {
        return db.queryForList(
            "SELECT id,action,title,created_at FROM point_history WHERE owner_id=? AND redo=? ORDER BY id DESC LIMIT 10",
            owner,
            redo
        );
    }

    @Transactional
    public void undo(long owner, long expectedId) {
        restore(owner, expectedId, false);
    }

    @Transactional
    public void redo(long owner, long expectedId) {
        restore(owner, expectedId, true);
    }

    private void restore(long owner, long expectedId, boolean redo) {
        lock(owner);
        var history = db.queryForList(
            "SELECT id,point_id,action,title,snapshot::text FROM point_history WHERE owner_id=? AND redo=? ORDER BY id DESC LIMIT 1",
            owner,
            redo
        );
        if (
            history.isEmpty() || ((Number) history.get(0).get("id")).longValue() != expectedId
        ) throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "履歴が更新されています。一覧を再読み込みしてください。"
        );
        var h = history.get(0);
        long point = ((Number) h.get("point_id")).longValue();
        String current = snapshot(point, owner);
        db.update("DELETE FROM points WHERE id=? AND owner_id=?", point, owner);
        String previous = (String) h.get("snapshot");
        if (previous != null) {
            db.update(
                "INSERT INTO points SELECT * FROM jsonb_populate_record(NULL::points,(?::jsonb)->'point')",
                previous
            );
            db.update(
                "INSERT INTO point_photos SELECT * FROM jsonb_populate_recordset(NULL::point_photos,(?::jsonb)->'photos')",
                previous
            );
        }
        // Move to the opposite stack with a new ID: stale requests cannot repeat an operation.
        db.update("DELETE FROM point_history WHERE id=? AND owner_id=?", expectedId, owner);
        db.update(
            "INSERT INTO point_history(owner_id,point_id,action,title,snapshot,redo) VALUES (?,?,?,?,?::jsonb,?)",
            owner,
            point,
            h.get("action"),
            h.get("title"),
            current,
            !redo
        );
    }
}
