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
@RequestMapping("/enshu")
public class EnshuController {

    // Repository は、DBのデータを取得・更新するために使います。
    private final EnshuItemRepository enshuItemRepository;

    // ControllerでRepositoryを使えるようにします。
    public EnshuController(EnshuItemRepository enshuItemRepository) {
        this.enshuItemRepository = enshuItemRepository;
    }

    // 一覧画面を表示します。
    @GetMapping("/index")
    public String index(Model model) {
        // 画面で操作するための初期データをDBに入れます。
        createInitialData();

        // DBに入っているデータを全件取得します。
        List<EnshuItem> items = enshuItemRepository.findAllItems();

        // 取得したデータをHTMLに渡します。
        model.addAttribute("items", items);

        return "enshu/index";
    }

    // 編集画面を表示します。
    @GetMapping("/edit/{id}")
    public String edit(@PathVariable Integer id, Model model) {
        // URLで受け取ったidを使って、編集対象のデータを1件取得します。
        EnshuItem item = enshuItemRepository.findItemById(id).orElse(null);

        // 対象データがない場合は一覧画面に戻ります。
        if (item == null) {
            return "redirect:/enshu/index";
        }

        // 取得したデータをHTMLに渡します。
        model.addAttribute("item", item);

        return "enshu/edit";
    }

    // 保存ボタンを押したときに実行されます。
    @PostMapping("/update")
    public String update(
        @RequestParam Integer id,
        @RequestParam String title,
        @RequestParam String genre,
        @RequestParam String platform,
        @RequestParam String status
    ) {
        // idを使って、更新対象のデータを取得します。
        EnshuItem item = enshuItemRepository.findItemById(id).orElse(null);

        // 対象データがある場合だけ、画面の入力値で更新します。
        if (item != null) {
            // SQLを使って、変更内容をDBに保存します。
            enshuItemRepository.updateItem(id, title, genre, platform, status);
        }

        // 保存後は一覧画面に戻ります。
        return "redirect:/enshu/index";
    }

    // 最初に表示するゲームデータを用意します。
    private void createInitialData() {
        if (enshuItemRepository.countItems() > 0) {
            return;
        }

        enshuItemRepository.insertItem("マインクラフト", "サンドボックス", "Switch / PC", "通常");
        enshuItemRepository.insertItem("スプラトゥーン", "アクション", "Switch", "重要");
        enshuItemRepository.insertItem(
            "モンスターハンター",
            "アクション",
            "Switch / PS / PC",
            "通常"
        );
        enshuItemRepository.insertItem("ゼルダの伝説", "アドベンチャー", "Switch", "通常");
    }
}
