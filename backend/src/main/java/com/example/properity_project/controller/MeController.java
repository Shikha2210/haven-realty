package com.example.properity_project.controller;

import com.example.properity_project.dto.AuthDtos.*;
import com.example.properity_project.dto.EnquiryDtos.*;
import com.example.properity_project.dto.PropertyDtos.PropertyCard;
import com.example.properity_project.dto.VerificationDtos.MyVerification;
import com.example.properity_project.entity.User;
import com.example.properity_project.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Everything a signed-in customer does as a buyer (and the way to become a seller). */
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final UserService users;
    private final AuthenticationService auth;
    private final SellerVerificationService verification;
    private final PropertyService properties;
    private final EnquiryService enquiries;
    private final NotificationService notifications;

    // ---- profile & verification

    @PutMapping
    public UserView update(@AuthenticationPrincipal User user, @Valid @RequestBody ProfileUpdate req) {
        return users.updateProfile(user, req);
    }

    @PostMapping("/verify")
    public Map<String, String> verify(@AuthenticationPrincipal User user, @Valid @RequestBody VerifyRequest req) {
        auth.verify(user, req);
        return Map.of("message", "Verified");
    }

    @PostMapping("/resend")
    public Map<String, Object> resend(@AuthenticationPrincipal User user, @RequestBody Map<String, String> body) {
        return auth.resend(user, body.getOrDefault("channel", "EMAIL"));
    }

    // ---- seller application (same account, separate verification status)

    @GetMapping("/seller-application")
    public MyVerification application(@AuthenticationPrincipal User user) {
        return verification.mine(user);
    }

    @PostMapping(value = "/seller-application", consumes = "multipart/form-data")
    public MyVerification apply(@AuthenticationPrincipal User user,
                                @RequestParam(defaultValue = "false") boolean consent,
                                @RequestParam(value = "identity", required = false) MultipartFile identity,
                                @RequestParam(value = "address", required = false) MultipartFile address,
                                @RequestParam(value = "photo", required = false) MultipartFile photo) {
        return verification.submit(user, consent, identity, address, photo);
    }

    // ---- wishlist / recently viewed / dashboard

    @GetMapping("/wishlist")
    public List<PropertyCard> wishlist(@AuthenticationPrincipal User user) {
        return properties.wishlist(user);
    }

    @PostMapping("/wishlist/{propertyId}")
    public Map<String, String> save(@AuthenticationPrincipal User user, @PathVariable Long propertyId) {
        properties.addToWishlist(user, propertyId);
        return Map.of("message", "Saved");
    }

    @DeleteMapping("/wishlist/{propertyId}")
    public Map<String, String> unsave(@AuthenticationPrincipal User user, @PathVariable Long propertyId) {
        properties.removeFromWishlist(user, propertyId);
        return Map.of("message", "Removed");
    }

    @GetMapping("/recently-viewed")
    public List<PropertyCard> recentlyViewed(@AuthenticationPrincipal User user) {
        return properties.recentlyViewed(user);
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@AuthenticationPrincipal User user) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("user", users.toView(user));
        m.put("recentlyViewed", properties.recentlyViewed(user));
        m.put("wishlist", properties.wishlist(user));
        m.put("recommended", properties.recommended(user));
        m.put("enquiries", enquiries.mine(user).stream().limit(5).toList());
        m.put("notifications", notifications.list(user).stream().limit(5).toList());
        m.put("unreadNotifications", notifications.unread(user));
        return m;
    }

    // ---- enquiries (buyer <-> agent)

    @PostMapping("/enquiries")
    public CustomerEnquiry createEnquiry(@AuthenticationPrincipal User user, @Valid @RequestBody CreateEnquiry req) {
        return enquiries.create(user, req);
    }

    @GetMapping("/enquiries")
    public List<CustomerEnquiry> myEnquiries(@AuthenticationPrincipal User user) {
        return enquiries.mine(user);
    }

    @GetMapping("/enquiries/{id}")
    public CustomerEnquiryDetail enquiry(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return enquiries.mineOne(user, id);
    }

    @PostMapping("/enquiries/{id}/messages")
    public CustomerEnquiryDetail message(@AuthenticationPrincipal User user, @PathVariable Long id,
                                         @Valid @RequestBody MessageRequest req) {
        return enquiries.customerMessage(user, id, req.body());
    }

    @PostMapping("/enquiries/{id}/cancel")
    public CustomerEnquiryDetail cancel(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return enquiries.cancel(user, id);
    }
}
