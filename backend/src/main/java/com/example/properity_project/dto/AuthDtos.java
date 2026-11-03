package com.example.properity_project.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public final class AuthDtos {
    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank(message = "Full name is required") @Size(max = 120) String fullName,
            @NotBlank(message = "Email is required") @Email(message = "Enter a valid email") String email,
            @Pattern(regexp = "\\d{10}", message = "Enter a 10-digit mobile number") String phone,
            LocalDate dateOfBirth,
            @NotBlank(message = "Address is required") @Size(max = 300) String address,
            @NotBlank(message = "City is required") String city,
            @NotBlank(message = "State is required") String state,
            @Pattern(regexp = "\\d{6}", message = "Enter a 6-digit PIN code") String postalCode,
            @NotBlank(message = "Password is required") @Size(min = 8, max = 72, message = "Use 8 to 72 characters") String password,
            String purpose) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password, String portal) {}

    public record VerifyRequest(@NotBlank String channel, @NotBlank String code) {}

    public record ForgotRequest(@NotBlank @Email String email) {}

    public record ResetRequest(@NotBlank @Email String email, @NotBlank String code,
                               @NotBlank @Size(min = 8, max = 72) String newPassword) {}

    public record ChangePasswordRequest(@NotBlank String currentPassword,
                                        @NotBlank @Size(min = 8, max = 72) String newPassword) {}

    public record ProfileUpdate(
            @NotBlank @Size(max = 120) String fullName,
            @Pattern(regexp = "\\d{10}", message = "Enter a 10-digit mobile number") String phone,
            LocalDate dateOfBirth, String address, String city, String state,
            @Pattern(regexp = "|\\d{6}", message = "Enter a 6-digit PIN code") String postalCode,
            @Size(max = 1000) String preferences) {}

    public record UserView(Long id, String email, String fullName, String phone, String role,
                           boolean buyerEnabled, boolean sellerEnabled, boolean emailVerified,
                           boolean phoneVerified, String sellerStatus, String city, String state,
                           String address, String postalCode, LocalDate dateOfBirth, String preferences) {}

    /** devEmailCode/devPhoneCode are only filled when app.dev-expose-otp=true (demo mode). */
    public record AuthResponse(String token, UserView user, String nextStep,
                               String devEmailCode, String devPhoneCode) {}
}
