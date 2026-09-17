package com.example.demo.points;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 実PostgreSQLの専用スキーマで検証。通常データの削除・初期化はしない。 */
@EnabledIfEnvironmentVariable(named = "PIN_NOTE_TEST_DB", matches = "true")
@SpringBootTest(
    properties = {
        "spring.datasource.url=${TEST_DB_URL:jdbc:postgresql://127.0.0.1:55432/pin_note?currentSchema=pin_note_tests}",
        "spring.flyway.schemas=pin_note_tests",
        "spring.flyway.default-schema=pin_note_tests",
        "spring.jpa.properties.hibernate.default_schema=pin_note_tests",
        "pin-note.geocoding-enabled=false",
    }
)
@AutoConfigureMockMvc
class PointApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate db;

    MockHttpSession session;
    List<Long> users = new ArrayList<>();

    @BeforeEach
    void account() throws Exception {
        session = signup("u" + UUID.randomUUID().toString().replace("-", ""));
    }

    @AfterEach
    void cleanup() {
        for (Long id : users) {
            db.update("DELETE FROM point_history WHERE owner_id=?", id);
            db.update("DELETE FROM points WHERE owner_id=?", id);
            db.update("DELETE FROM app_users WHERE id=?", id);
        }
    }

    ResultActions perform(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.session(session));
    }

    MockHttpSession signup(String username) throws Exception {
        var result = mvc
            .perform(
                post("/api/auth/signup")
                    .header("X-Pin-Note", "1")
                    .contentType("application/json")
                    .content(
                        json.writeValueAsString(
                            java.util.Map.of("username", username, "password", "test_password_42")
                        )
                    )
            )
            .andExpect(status().isCreated())
            .andReturn();
        users.add(json.readTree(result.getResponse().getContentAsString()).path("id").asLong());
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    long latest() throws Exception {
        return json
            .readTree(perform(get("/api/history")).andReturn().getResponse().getContentAsString())
            .get(0)
            .path("id")
            .asLong();
    }

    long latestRedo() throws Exception {
        return json
            .readTree(
                perform(get("/api/history/redo"))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString()
            )
            .get(0)
            .path("id")
            .asLong();
    }

    void undo() throws Exception {
        perform(post("/api/history/" + latest() + "/undo").header("X-Pin-Note", "1")).andExpect(
            status().isOk()
        );
    }

    void redo() throws Exception {
        perform(post("/api/history/" + latestRedo() + "/redo").header("X-Pin-Note", "1")).andExpect(
            status().isOk()
        );
    }

    long create(String title) throws Exception {
        return json
            .readTree(
                perform(
                    multipart("/api/points")
                        .file(data(UUID.randomUUID().toString(), title, 35.6, "[]"))
                        .header("X-Pin-Note", "1")
                )
                    .andExpect(status().isCreated())
                    .andReturn()
                    .getResponse()
                    .getContentAsString()
            )
            .path("id")
            .asLong();
    }

    private MockMultipartFile data(
        String requestId,
        String title,
        double latitude,
        String retained
    ) {
        String body =
            "{\"requestId\":\"" +
            requestId +
            "\",\"title\":\"" +
            title +
            "\",\"latitude\":" +
            latitude +
            ",\"longitude\":139.7,\"municipality\":\"\",\"memo\":\"\",\"retainedPhotoIds\":" +
            retained +
            "}";
        return new MockMultipartFile(
            "data",
            "data.json",
            "application/json",
            body.getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
    }

    @Test
    void locationOnlyRetryPhotoEditAndDelete() throws Exception {
        String requestId = UUID.randomUUID().toString();
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", bytes);
        var photo = new MockMultipartFile("photos", "test.png", "image/png", bytes.toByteArray());
        var response = perform(
            multipart("/api/points")
                .file(data(requestId, "", 35.6, "[]"))
                .file(photo)
                .header("X-Pin-Note", "1")
        )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.photos.length()").value(1))
            .andReturn();
        var point = json.readTree(response.getResponse().getContentAsString());
        long id = point.path("id").asLong();
        assertThat(point.path("title").asText()).endsWith("のポイント");
        perform(
            multipart("/api/points")
                .file(data(requestId, "", 35.6, "[]"))
                .file(photo)
                .header("X-Pin-Note", "1")
        )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(id));
        perform(get(point.path("photos").get(0).path("url").asText()))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/png"));
        perform(get("/api/points/" + id)).andExpect(status().isOk());
        String retained = "[" + point.path("photos").get(0).path("id").asLong() + "]";
        perform(
            multipart(org.springframework.http.HttpMethod.PUT, "/api/points/" + id)
                .file(data(UUID.randomUUID().toString(), "更新した場所", 35.7, retained))
                .header("X-Pin-Note", "1")
        )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("更新した場所"))
            .andExpect(jsonPath("$.photos.length()").value(1));
        perform(delete("/api/points/" + id).header("X-Pin-Note", "1")).andExpect(
            status().isNoContent()
        );
        perform(get("/api/points/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void rejectsInvalidCoordinatesAndNonImageAndCrossSiteForm() throws Exception {
        perform(
            multipart("/api/points")
                .file(data(UUID.randomUUID().toString(), "", 91, "[]"))
                .header("X-Pin-Note", "1")
        ).andExpect(status().isBadRequest());
        perform(
            multipart("/api/points")
                .file(data(UUID.randomUUID().toString(), "", 35, "[]"))
                .file(
                    new MockMultipartFile(
                        "photos",
                        "fake.png",
                        "image/png",
                        "not an image".getBytes()
                    )
                )
                .header("X-Pin-Note", "1")
        ).andExpect(status().isBadRequest());
        perform(
            multipart("/api/points").file(data(UUID.randomUUID().toString(), "", 35, "[]"))
        ).andExpect(status().isForbidden());
    }

    @Test
    void usersAreIsolatedAndLoginWorks() throws Exception {
        long id = create("private");
        long history = latest();
        MockHttpSession a = session;
        String username = (String) db
            .queryForMap("SELECT username FROM app_users WHERE id=?", users.get(0))
            .get("username");
        session = signup("other" + UUID.randomUUID().toString().replace("-", ""));
        perform(get("/api/points")).andExpect(jsonPath("$.length()").value(0));
        perform(get("/api/points/" + id)).andExpect(status().isNotFound());
        perform(delete("/api/points/" + id).header("X-Pin-Note", "1")).andExpect(
            status().isNotFound()
        );
        perform(
            multipart(org.springframework.http.HttpMethod.PUT, "/api/points/" + id)
                .file(data(UUID.randomUUID().toString(), "stolen", 35.6, "[]"))
                .header("X-Pin-Note", "1")
        ).andExpect(status().isNotFound());
        perform(post("/api/history/" + history + "/undo").header("X-Pin-Note", "1")).andExpect(
            status().isConflict()
        );
        session = a;
        perform(post("/api/auth/logout").header("X-Pin-Note", "1")).andExpect(status().isOk());
        mvc.perform(get("/api/points")).andExpect(status().isUnauthorized());
        var logged = mvc
            .perform(
                post("/api/auth/login")
                    .header("X-Pin-Note", "1")
                    .contentType("application/json")
                    .content(
                        json.writeValueAsString(
                            java.util.Map.of(
                                "username",
                                username.toUpperCase(),
                                "password",
                                "test_password_42"
                            )
                        )
                    )
            )
            .andExpect(status().isOk())
            .andReturn();
        session = (MockHttpSession) logged.getRequest().getSession(false);
        perform(get("/api/points/" + id)).andExpect(status().isOk());
        mvc.perform(
            post("/api/auth/login")
                .header("X-Pin-Note", "1")
                .contentType("application/json")
                .content(
                    json.writeValueAsString(
                        java.util.Map.of("username", username, "password", "incorrect_pass")
                    )
                )
        ).andExpect(status().isUnauthorized());
    }

    @Test
    void undoRestoresDeletedPhotoAndEditedValues() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", bytes);
        var response = perform(
            multipart("/api/points")
                .file(data(UUID.randomUUID().toString(), "original", 35.6, "[]"))
                .file(new MockMultipartFile("photos", "test.png", "image/png", bytes.toByteArray()))
                .header("X-Pin-Note", "1")
        )
            .andExpect(status().isCreated())
            .andReturn();
        var point = json.readTree(response.getResponse().getContentAsString());
        long id = point.path("id").asLong();
        String photo = point.path("photos").get(0).path("url").asText();
        MockHttpSession a = session;
        session = signup("b" + UUID.randomUUID().toString().replace("-", ""));
        perform(get(photo)).andExpect(status().isNotFound());
        session = a;
        perform(
            multipart(org.springframework.http.HttpMethod.PUT, "/api/points/" + id)
                .file(data(UUID.randomUUID().toString(), "edited", 35.7, "[]"))
                .header("X-Pin-Note", "1")
        ).andExpect(status().isOk());
        perform(delete("/api/points/" + id).header("X-Pin-Note", "1")).andExpect(
            status().isNoContent()
        );
        long deletion = latest();
        perform(post("/api/history/" + deletion + "/undo").header("X-Pin-Note", "1")).andExpect(
            status().isOk()
        );
        perform(get("/api/points/" + id)).andExpect(jsonPath("$.title").value("edited"));
        perform(post("/api/history/" + deletion + "/undo").header("X-Pin-Note", "1")).andExpect(
            status().isConflict()
        );
        perform(post("/api/history/" + latest() + "/undo").header("X-Pin-Note", "1")).andExpect(
            status().isOk()
        );
        perform(get("/api/points/" + id))
            .andExpect(jsonPath("$.title").value("original"))
            .andExpect(jsonPath("$.photos.length()").value(1));
        perform(get(photo))
            .andExpect(status().isOk())
            .andExpect(content().bytes(bytes.toByteArray()));
        perform(delete("/api/points/" + id).header("X-Pin-Note", "1")).andExpect(
            status().isNoContent()
        );
        perform(post("/api/history/" + latest() + "/undo").header("X-Pin-Note", "1")).andExpect(
            status().isOk()
        );
        perform(get(photo)).andExpect(status().isOk());
        perform(post("/api/history/" + latest() + "/undo").header("X-Pin-Note", "1")).andExpect(
            status().isOk()
        );
        perform(get("/api/points/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void historyKeepsOnlyTenOperations() throws Exception {
        for (int i = 0; i < 12; i++) create("point" + i);
        perform(get("/api/history")).andExpect(jsonPath("$.length()").value(10));
        long last = 0;
        for (int i = 0; i < 10; i++) {
            last = latest();
            perform(post("/api/history/" + last + "/undo").header("X-Pin-Note", "1")).andExpect(
                status().isOk()
            );
        }
        perform(get("/api/points")).andExpect(jsonPath("$.length()").value(2));
        perform(get("/api/history")).andExpect(jsonPath("$.length()").value(0));
        perform(post("/api/history/" + last + "/undo").header("X-Pin-Note", "1")).andExpect(
            status().isConflict()
        );
        perform(get("/api/history/redo")).andExpect(jsonPath("$.length()").value(10));
        for (int i = 0; i < 10; i++) redo();
        perform(get("/api/points")).andExpect(jsonPath("$.length()").value(12));
        perform(get("/api/history")).andExpect(jsonPath("$.length()").value(10));
        perform(get("/api/history/redo")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void redoRestoresCreateEditDeleteAndPhotosInOrder() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", bytes);
        var response = perform(
            multipart("/api/points")
                .file(data(UUID.randomUUID().toString(), "before", 35.6, "[]"))
                .file(new MockMultipartFile("photos", "test.png", "image/png", bytes.toByteArray()))
                .header("X-Pin-Note", "1")
        )
            .andExpect(status().isCreated())
            .andReturn();
        var point = json.readTree(response.getResponse().getContentAsString());
        long id = point.path("id").asLong();
        String photo = point.path("photos").get(0).path("url").asText();
        perform(
            multipart(org.springframework.http.HttpMethod.PUT, "/api/points/" + id)
                .file(data(UUID.randomUUID().toString(), "after", 35.7, "[]"))
                .header("X-Pin-Note", "1")
        ).andExpect(status().isOk());
        perform(delete("/api/points/" + id).header("X-Pin-Note", "1")).andExpect(
            status().isNoContent()
        );
        undo();
        undo();
        undo();
        perform(get("/api/points/" + id)).andExpect(status().isNotFound());
        long creationRedo = latestRedo();
        redo();
        perform(get(photo))
            .andExpect(status().isOk())
            .andExpect(content().bytes(bytes.toByteArray()));
        perform(get("/api/points/" + id)).andExpect(jsonPath("$.title").value("before"));
        perform(post("/api/history/" + creationRedo + "/redo").header("X-Pin-Note", "1")).andExpect(
            status().isConflict()
        );
        redo();
        perform(get("/api/points/" + id))
            .andExpect(jsonPath("$.title").value("after"))
            .andExpect(jsonPath("$.latitude").value(35.7))
            .andExpect(jsonPath("$.photos.length()").value(0));
        perform(get(photo)).andExpect(status().isNotFound());
        redo();
        perform(get("/api/points/" + id)).andExpect(status().isNotFound());
        undo();
        undo();
        perform(get(photo)).andExpect(status().isOk());
    }

    @Test
    void redoIsPrivateAndNewChangesDiscardIt() throws Exception {
        long id = create("first");
        undo();
        long redoId = latestRedo();
        MockHttpSession original = session;
        session = signup("c" + UUID.randomUUID().toString().replace("-", ""));
        perform(get("/api/history/redo")).andExpect(jsonPath("$.length()").value(0));
        perform(post("/api/history/" + redoId + "/redo").header("X-Pin-Note", "1")).andExpect(
            status().isConflict()
        );
        session = original;
        create("new branch");
        perform(get("/api/history/redo")).andExpect(jsonPath("$.length()").value(0));
        perform(post("/api/history/" + redoId + "/redo").header("X-Pin-Note", "1")).andExpect(
            status().isConflict()
        );
        perform(get("/api/points/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void favoritesArePrivatePersistThroughEditsAndSupportUndoRedo() throws Exception {
        long id = create("favorite test");
        perform(get("/api/points/" + id)).andExpect(jsonPath("$.favorite").value(false));
        perform(
            patch("/api/points/" + id + "/favorite")
                .header("X-Pin-Note", "1")
                .contentType("application/json")
                .content("{\"favorite\":true}")
        )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.favorite").value(true));
        long history = latest();
        perform(
            patch("/api/points/" + id + "/favorite")
                .header("X-Pin-Note", "1")
                .contentType("application/json")
                .content("{\"favorite\":true}")
        ).andExpect(status().isOk());
        assertThat(latest()).isEqualTo(history);
        undo();
        perform(get("/api/points/" + id)).andExpect(jsonPath("$.favorite").value(false));
        redo();
        perform(get("/api/points/" + id)).andExpect(jsonPath("$.favorite").value(true));
        perform(
            multipart(org.springframework.http.HttpMethod.PUT, "/api/points/" + id)
                .file(data(UUID.randomUUID().toString(), "edited favorite", 35.7, "[]"))
                .header("X-Pin-Note", "1")
        )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.favorite").value(true));
        perform(delete("/api/points/" + id).header("X-Pin-Note", "1")).andExpect(
            status().isNoContent()
        );
        undo();
        perform(get("/api/points/" + id)).andExpect(jsonPath("$.favorite").value(true));
        perform(
            patch("/api/points/" + id + "/favorite")
                .header("X-Pin-Note", "1")
                .contentType("application/json")
                .content("{}")
        ).andExpect(status().isBadRequest());
        session = signup("f" + UUID.randomUUID().toString().replace("-", ""));
        perform(
            patch("/api/points/" + id + "/favorite")
                .header("X-Pin-Note", "1")
                .contentType("application/json")
                .content("{\"favorite\":false}")
        ).andExpect(status().isNotFound());
    }
}
