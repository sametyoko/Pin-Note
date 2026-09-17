package com.example.demo.points;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class Accounts {

    private final JdbcTemplate db;
    private final HttpServletRequest request;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);

    public Accounts(JdbcTemplate db, HttpServletRequest request) {
        this.db = db;
        this.request = request;
    }

    public record Credentials(
        @NotBlank @Pattern(regexp = "[a-zA-Z0-9_]{3,40}") String username,
        @NotNull @Size(min = 8, max = 72) String password
    ) {}

    public long currentId() {
        var session = request.getSession(false);
        if (
            session == null || !(session.getAttribute("userId") instanceof Long)
        ) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "ログインしてください。");
        return (Long) session.getAttribute("userId");
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        long id = currentId();
        return db.queryForMap("SELECT id,username FROM app_users WHERE id=?", id);
    }

    private void throttle() {
        var session = request.getSession();
        synchronized (session) {
            long now = System.currentTimeMillis();
            Long since = (Long) session.getAttribute("attemptSince");
            int count = Optional.ofNullable((Integer) session.getAttribute("attempts")).orElse(0);
            if (since == null || now - since > 60000) {
                session.setAttribute("attemptSince", now);
                count = 0;
            }
            if (count >= 8) throw new ResponseStatusException(
                HttpStatus.TOO_MANY_REQUESTS,
                "少し待ってから再試行してください。"
            );
            session.setAttribute("attempts", count + 1);
        }
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> signup(@Valid @RequestBody Credentials input) {
        throttle();
        checkPassword(input.password());
        String username = input.username().toLowerCase(Locale.ROOT);
        String hash = encoder.encode(input.password());
        var ids = db.queryForList(
            "INSERT INTO app_users(username,password_hash) VALUES (?,?) ON CONFLICT(username) DO NOTHING RETURNING id",
            Long.class,
            username,
            hash
        );
        if (ids.isEmpty()) throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "このユーザー名は使用されています。"
        );
        loginSession(ids.get(0));
        return me();
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody Credentials input) {
        throttle();
        checkPassword(input.password());
        var users = db.queryForList(
            "SELECT id,password_hash FROM app_users WHERE username=?",
            input.username().toLowerCase(Locale.ROOT)
        );
        if (
            users.isEmpty() ||
            !encoder.matches(input.password(), (String) users.get(0).get("password_hash"))
        ) throw new ResponseStatusException(
            HttpStatus.UNAUTHORIZED,
            "ユーザー名またはパスワードが違います。"
        );
        loginSession(((Number) users.get(0).get("id")).longValue());
        return me();
    }

    @PostMapping("/logout")
    public void logout() {
        var session = request.getSession(false);
        if (session != null) session.invalidate();
    }

    private void checkPassword(String password) {
        if (
            password.getBytes(StandardCharsets.UTF_8).length > 72
        ) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "パスワードはUTF-8で72バイト以内にしてください。"
        );
    }

    private void loginSession(long id) {
        request.getSession();
        request.changeSessionId();
        request.getSession().setAttribute("userId", id);
        request.getSession().setMaxInactiveInterval(3600);
    }
}
