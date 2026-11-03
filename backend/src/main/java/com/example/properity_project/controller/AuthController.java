package com.example.properity_project.controller;

import com.example.properity_project.dto.AuthDtos.*;
import com.example.properity_project.service.AuthenticationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Public endpoints. Note: there is deliberately NO agent registration route. */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationService auth;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(auth.registerCustomer(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(auth.login(request));
    }

    @PostMapping("/forgot-password")
    public Map<String, Object> forgot(@Valid @RequestBody ForgotRequest request) {
        return auth.forgotPassword(request);
    }

    @PostMapping("/reset-password")
    public Map<String, String> reset(@Valid @RequestBody ResetRequest request) {
        auth.resetPassword(request);
        return Map.of("message", "Password updated. You can sign in now.");
    }
}
