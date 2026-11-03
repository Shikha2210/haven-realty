package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "verification_history")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerificationHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long verificationId;
    private String fromStatus;
    private String toStatus;
    private String note;
    private Long actorId;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
