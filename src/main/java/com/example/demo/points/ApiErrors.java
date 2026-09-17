package com.example.demo.points;

import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(basePackages = "com.example.demo.points")
public class ApiErrors {

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> status(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(
            Map.of("message", e.getReason() == null ? "処理に失敗しました。" : e.getReason())
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> invalid() {
        return ResponseEntity.badRequest().body(
            Map.of(
                "message",
                "位置や入力内容を確認してください。名前は100文字、メモは1000文字までです。"
            )
        );
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<?> tooLarge() {
        return ResponseEntity.status(413).body(
            Map.of("message", "写真は1枚5MB以下、合計3枚までです。")
        );
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> database() {
        return ResponseEntity.status(503).body(
            Map.of(
                "message",
                "DBに接続できません。入力を残したまま、少し待って再試行してください。"
            )
        );
    }
}
