package com.example.demo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface KadaiItemRepository extends Repository<KadaiItem, Integer> {
    @Query(value = "SELECT * FROM kadai_items ORDER BY id", nativeQuery = true)
    List<KadaiItem> findAllItems();

    @Query(value = "SELECT * FROM kadai_items WHERE id = :id", nativeQuery = true)
    Optional<KadaiItem> findItemById(@Param("id") Integer id);

    @Query(value = "SELECT COUNT(*) FROM kadai_items", nativeQuery = true)
    long countItems();

    @Modifying
    @Transactional
    @Query(
        value = "INSERT INTO kadai_items (title, genre, platform, status, created_at, updated_at) VALUES (:title, :genre, :platform, :status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        nativeQuery = true
    )
    void insertItem(
        @Param("title") String title,
        @Param("genre") String genre,
        @Param("platform") String platform,
        @Param("status") String status
    );

    @Modifying
    @Transactional
    @Query(
        value = "UPDATE kadai_items SET title = :title, genre = :genre, platform = :platform, status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
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
