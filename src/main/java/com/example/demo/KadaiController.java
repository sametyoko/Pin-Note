package com.example.demo;

import java.util.List;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
@RequestMapping("/kadai")
public class KadaiController {

    private final KadaiItemRepository kadaiItemRepository;

    public KadaiController(KadaiItemRepository kadaiItemRepository) {
        this.kadaiItemRepository = kadaiItemRepository;
    }

    @GetMapping("/index")
    public String index(Model model) {
        createInitialData();

        List<KadaiItem> items = kadaiItemRepository.findAllItems();
        model.addAttribute("items", items);

        return "kadai/index";
    }

    @GetMapping("/edit/{id}")
    public String edit(@PathVariable Integer id, Model model) {
        KadaiItem item = kadaiItemRepository.findItemById(id).orElse(null);

        if (item == null) {
            return "redirect:/kadai/index";
        }

        model.addAttribute("item", item);

        return "kadai/edit";
    }

    @PostMapping("/update")
    public String update(@RequestParam Integer id) {
        return "redirect:/kadai/index";
    }

    private void createInitialData() {
        if (kadaiItemRepository.countItems() > 0) {
            return;
        }

        kadaiItemRepository.insertItem("マインクラフト", "サンドボックス", "Switch / PC", "通常");
        kadaiItemRepository.insertItem("スプラトゥーン", "アクション", "Switch", "重要");
        kadaiItemRepository.insertItem(
            "モンスターハンター",
            "アクション",
            "Switch / PS / PC",
            "通常"
        );
        kadaiItemRepository.insertItem("ゼルダの伝説", "アドベンチャー", "Switch", "通常");
    }
}
