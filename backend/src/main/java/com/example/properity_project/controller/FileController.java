package com.example.properity_project.controller;

import com.example.properity_project.entity.User;
import com.example.properity_project.service.FileStorageService;
import com.example.properity_project.service.PropertyService;
import com.example.properity_project.service.SellerVerificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Private documents: identity proofs and ownership papers. Only the owner and the agent can fetch them. */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final SellerVerificationService verifications;
    private final PropertyService properties;
    private final FileStorageService storage;

    @GetMapping("/verification-documents/{id}")
    public ResponseEntity<Resource> verificationDocument(@PathVariable Long id, @AuthenticationPrincipal User user) {
        var d = verifications.documentFor(user, id);
        return serve(d.getStoredName(), d.getContentType(), d.getOriginalName());
    }

    @GetMapping("/property-documents/{id}")
    public ResponseEntity<Resource> propertyDocument(@PathVariable Long id, @AuthenticationPrincipal User user) {
        var d = properties.documentFor(user, id);
        return serve(d.getStoredName(), d.getContentType(), d.getOriginalName());
    }

    private ResponseEntity<Resource> serve(String stored, String type, String original) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(type))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(original).build().toString())
                .header("X-Content-Type-Options", "nosniff").header("Cache-Control", "private, no-store")
                .body(storage.load(stored));
    }
}
