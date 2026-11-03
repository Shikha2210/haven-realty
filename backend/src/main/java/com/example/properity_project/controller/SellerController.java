package com.example.properity_project.controller;

import com.example.properity_project.dto.PropertyDtos.*;
import com.example.properity_project.entity.User;
import com.example.properity_project.service.ChannelService;
import com.example.properity_project.service.PropertyService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/** Seller portal. Every call is scoped to the signed-in seller's own listings. */
@RestController
@RequestMapping("/api/seller")
@RequiredArgsConstructor
public class SellerController {

    private final PropertyService properties;
    private final ChannelService channels;

    public record MessageBody(@NotBlank String body, Long propertyId) {}

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@AuthenticationPrincipal User u) {
        return properties.sellerDashboard(u);
    }

    @GetMapping("/properties")
    public List<SellerProperty> list(@AuthenticationPrincipal User u) {
        return properties.mine(u);
    }

    @PostMapping("/properties")
    public SellerProperty create(@AuthenticationPrincipal User u, @Valid @RequestBody PropertyInput in) {
        return properties.create(u, in);
    }

    @GetMapping("/properties/{id}")
    public SellerProperty one(@AuthenticationPrincipal User u, @PathVariable Long id) {
        return properties.mineOne(u, id);
    }

    @PutMapping("/properties/{id}")
    public SellerProperty update(@AuthenticationPrincipal User u, @PathVariable Long id, @Valid @RequestBody PropertyInput in) {
        return properties.update(u, id, in);
    }

    @PostMapping(value = "/properties/{id}/images", consumes = "multipart/form-data")
    public SellerProperty addImages(@AuthenticationPrincipal User u, @PathVariable Long id,
                                    @RequestParam("files") List<MultipartFile> files) {
        return properties.addImages(u, id, files);
    }

    @DeleteMapping("/properties/{id}/images/{imageId}")
    public SellerProperty removeImage(@AuthenticationPrincipal User u, @PathVariable Long id, @PathVariable Long imageId) {
        return properties.removeImage(u, id, imageId);
    }

    @PostMapping(value = "/properties/{id}/documents", consumes = "multipart/form-data")
    public SellerProperty addDocument(@AuthenticationPrincipal User u, @PathVariable Long id,
                                      @RequestParam("file") MultipartFile file,
                                      @RequestParam(value = "docType", required = false) String docType) {
        return properties.addDocument(u, id, docType, file);
    }

    @PostMapping("/properties/{id}/submit")
    public SellerProperty submit(@AuthenticationPrincipal User u, @PathVariable Long id) {
        return properties.submit(u, id);
    }

    @PostMapping("/properties/{id}/deactivate")
    public SellerProperty deactivate(@AuthenticationPrincipal User u, @PathVariable Long id) {
        return properties.setActive(u, id, false);
    }

    @PostMapping("/properties/{id}/activate")
    public SellerProperty activate(@AuthenticationPrincipal User u, @PathVariable Long id) {
        return properties.setActive(u, id, true);
    }

    // Seller <-> Agent channel (the only conversation a seller can ever see)

    @GetMapping("/messages")
    public List<Map<String, Object>> messages(@AuthenticationPrincipal User u) {
        return channels.sellerThread(u);
    }

    @PostMapping("/messages")
    public Map<String, Object> send(@AuthenticationPrincipal User u, @Valid @RequestBody MessageBody b) {
        return channels.sellerSend(u, b.body(), b.propertyId());
    }
}
