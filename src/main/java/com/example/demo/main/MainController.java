package com.example.demo.main;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class MainController {

    @GetMapping("/")
    public String index() {
        return "main/index";
    }

    @GetMapping({ "/points", "/points/" })
    public String points() {
        return "forward:/points/index.html";
    }
}
