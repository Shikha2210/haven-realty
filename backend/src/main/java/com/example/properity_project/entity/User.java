package com.example.properity_project.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * One row per person. A customer is a buyer and may also be a seller (flags), so there is never a
 * second account for the same person. The single agent is the only row with role AGENT.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String email;
    private String password;
    private String fullName;
    private String phone;
    private LocalDate dateOfBirth;
    private String city;
    private String state;
    private String address;
    private String postalCode;
    private String role; // CUSTOMER or AGENT

    @Builder.Default
    private boolean accountEnabled = true;
    @Builder.Default
    private boolean emailVerified = false;
    @Builder.Default
    private boolean phoneVerified = false;
    @Builder.Default
    private boolean buyerEnabled = true;
    @Builder.Default
    private boolean sellerEnabled = false;

    private String preferences;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    public boolean isAgent() {
        return "AGENT".equals(role);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isEnabled() {
        return accountEnabled;
    }
}
