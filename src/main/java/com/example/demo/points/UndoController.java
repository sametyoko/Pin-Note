package com.example.demo.points;

import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/history")
public class UndoController {

    private final Accounts accounts;
    private final UndoService undo;

    public UndoController(Accounts accounts, UndoService undo) {
        this.accounts = accounts;
        this.undo = undo;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        return undo.list(accounts.currentId());
    }

    @GetMapping("/redo")
    public List<Map<String, Object>> redoList() {
        return undo.list(accounts.currentId(), true);
    }

    @PostMapping("/{id}/redo")
    public void redo(@PathVariable long id) {
        undo.redo(accounts.currentId(), id);
    }

    @PostMapping("/{id}/undo")
    public void undo(@PathVariable long id) {
        undo.undo(accounts.currentId(), id);
    }
}
