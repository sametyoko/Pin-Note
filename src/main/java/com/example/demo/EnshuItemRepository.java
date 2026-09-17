package com.example.demo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

// Repository はDB操作を担当します。
// SQLを書いて、DBから取得・登録・更新を行います。
public interface EnshuItemRepository extends Repository<EnshuItem, Integer> {
    // 一覧表示用のデータを全件取得します。
    @Query(value = "SELECT * FROM enshu_items ORDER BY id", nativeQuery = true)
    List<EnshuItem> findAllItems();

    // 編集対象のデータを1件取得します。
    @Query(value = "SELECT * FROM enshu_items WHERE id = :id", nativeQuery = true)
    Optional<EnshuItem> findItemById(@Param("id") Integer id);

    // 初期データがすでにあるか確認します。
    @Query(value = "SELECT COUNT(*) FROM enshu_items", nativeQuery = true)
    long countItems();

    // 初期データを登録します。
    @Modifying
    @Transactional
    @Query(
        value = "INSERT INTO enshu_items (title, genre, platform, status, created_at, updated_at) VALUES (:title, :genre, :platform, :status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        nativeQuery = true
    )
    void insertItem(
        @Param("title") String title,
        @Param("genre") String genre,
        @Param("platform") String platform,
        @Param("status") String status
    );

    // 画面で入力された内容でデータを更新します。
    @Modifying
    @Transactional
    @Query(
        value = "UPDATE enshu_items SET title = :title, genre = :genre, platform = :platform, status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
        nativeQuery = true
    )
    void updateItem(
        @Param("id") Integer id,
        @Param("title") String title,
        @Param("genre") String genre,
        @Param("platform") String platform,
        @Param("status") String status
    );
}
