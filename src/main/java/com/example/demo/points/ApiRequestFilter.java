package com.example.demo.points;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** ローカルの未認証アプリを別サイトのフォームから変更させない。CORSは開放しない。 */
@Component
public class ApiRequestFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
        HttpServletRequest req,
        HttpServletResponse res,
        FilterChain chain
    ) throws ServletException, IOException {
        if (
            req.getRequestURI().startsWith("/api/") &&
            !java.util.Set.of("GET", "HEAD", "OPTIONS").contains(req.getMethod()) &&
            !"1".equals(req.getHeader("X-Pin-Note"))
        ) {
            res.setStatus(403);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"message\":\"アプリの画面から操作してください。\"}");
            return;
        }
        if (
            req.getRequestURI().startsWith("/api/") &&
            !req.getRequestURI().startsWith("/api/auth/") &&
            (req.getSession(false) == null || req.getSession(false).getAttribute("userId") == null)
        ) {
            res.setStatus(401);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"message\":\"ログインしてください。\"}");
            return;
        }
        if (req.getRequestURI().startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
        chain.doFilter(req, res);
    }
}
