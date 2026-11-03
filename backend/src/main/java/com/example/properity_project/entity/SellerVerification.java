package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "seller_verifications")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    @Builder.Default
    private String status = "PENDING";
    private String rejectionReason;
    private String reviewNotes;
    @Builder.Default
    private boolean consentGiven = false;
    @Builder.Default
    private LocalDateTime submittedAt = LocalDateTime.now();
    private LocalDateTime reviewedAt;
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
