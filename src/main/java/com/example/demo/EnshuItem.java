package com.example.demo;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

// @Entity を付けると、このクラスはDBのテーブルと対応します。
@Entity
@Table(name = "enshu_items")
public class EnshuItem {

    // id は、1件のデータを区別するための番号です。
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    // ゲームタイトルです。
    private String title;

    // ゲームのジャンルです。
    private String genre;

    // 対応プラットフォームです。
    private String platform;

    // データの状態です。
    private String status;

    // 登録日時です。
    private LocalDateTime createdAt;

    // 更新日時です。
    private LocalDateTime updatedAt;

    // JPAが使うため、引数なしコンストラクタを用意します。
    public EnshuItem() {}

    // DBに登録するデータを作るときに使います。
    public EnshuItem(String title, String genre, String platform, String status) {
        this.title = title;
        this.genre = genre;
        this.platform = platform;
        this.status = status;
    }

    public Integer getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getGenre() {
        return genre;
    }

    public void setGenre(String genre) {
        this.genre = genre;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
