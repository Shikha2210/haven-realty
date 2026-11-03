package com.example.properity_project.service;

import com.example.properity_project.dto.AuthDtos.*;
import com.example.properity_project.entity.SellerVerification;
import com.example.properity_project.entity.User;
import com.example.properity_project.repository.SellerVerificationRepository;
import com.example.properity_project.repository.UserRepository;
import com.example.properity_project.util.Errors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService implements UserDetailsService {

    private final UserRepository users;
    private final SellerVerificationRepository verifications;
    private final PasswordEncoder encoder;
    private final AuditService audit;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return users.findByEmail(email.toLowerCase())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    public static void checkPasswordStrength(String password) {
        if (password == null || password.length() < 8 || !password.matches(".*[A-Za-z].*") || !password.matches(".*\\d.*")) {
            throw Errors.bad("Password must be at least 8 characters and contain a letter and a number");
        }
    }

    public String sellerStatus(User u) {
        if (u.isAgent()) return "NONE";
        if (u.isSellerEnabled()) return "VERIFIED";
        return verifications.findFirstByUserIdOrderByIdDesc(u.getId()).map(SellerVerification::getStatus).orElse("NONE");
    }

    public UserView toView(User u) {
        return new UserView(u.getId(), u.getEmail(), u.getFullName(), u.getPhone(), u.getRole(), u.isBuyerEnabled(),
                u.isSellerEnabled(), u.isEmailVerified(), u.isPhoneVerified(), sellerStatus(u), u.getCity(),
                u.getState(), u.getAddress(), u.getPostalCode(), u.getDateOfBirth(), u.getPreferences());
    }

    @Transactional
    public UserView updateProfile(User current, ProfileUpdate req) {
        User u = users.findById(current.getId()).orElseThrow(() -> Errors.notFound("User"));
        if (!req.phone().equals(u.getPhone())) {
            if (users.existsByPhone(req.phone())) throw Errors.conflict("That mobile number is already registered");
            u.setPhone(req.phone());
            u.setPhoneVerified(false);
        }
        u.setFullName(req.fullName());
        u.setDateOfBirth(req.dateOfBirth());
        u.setAddress(req.address());
        u.setCity(req.city());
        u.setState(req.state());
        u.setPostalCode(req.postalCode());
        u.setPreferences(req.preferences());
        return toView(u);
    }

    @Transactional
    public void changePassword(User current, ChangePasswordRequest req) {
        User u = users.findById(current.getId()).orElseThrow(() -> Errors.notFound("User"));
        if (!encoder.matches(req.currentPassword(), u.getPassword())) throw Errors.bad("Current password is incorrect");
        checkPasswordStrength(req.newPassword());
        u.setPassword(encoder.encode(req.newPassword()));
        audit.log(u.getId(), "PASSWORD_CHANGED", "User", u.getId(), null);
    }
}
