package com.example.properity_project.controller;

import com.example.properity_project.dto.AuthDtos.*;
import com.example.properity_project.entity.User;
import com.example.properity_project.service.NotificationService;
import com.example.properity_project.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Endpoints shared by customers and the agent. */
@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {

    private final UserService users;
    private final NotificationService notifications;

    @GetMapping("/me")
    public UserView me(@AuthenticationPrincipal User user) {
        return users.toView(user);
    }

    @PostMapping("/change-password")
    public Map<String, String> changePassword(@AuthenticationPrincipal User user, @Valid @RequestBody ChangePasswordRequest req) {
        users.changePassword(user, req);
        return Map.of("message", "Password changed");
    }

    @GetMapping("/notifications")
    public Map<String, Object> list(@AuthenticationPrincipal User user) {
        return Map.of("items", notifications.list(user), "unread", notifications.unread(user));
    }

    @PostMapping("/notifications/read-all")
    public Map<String, String> readAll(@AuthenticationPrincipal User user) {
        notifications.markAllRead(user);
        return Map.of("message", "ok");
    }

    @PostMapping("/notifications/{id}/read")
    public Map<String, String> read(@AuthenticationPrincipal User user, @PathVariable Long id) {
        notifications.markRead(user, id);
        return Map.of("message", "ok");
    }
}
