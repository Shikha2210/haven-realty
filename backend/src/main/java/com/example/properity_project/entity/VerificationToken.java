package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "verification_tokens")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private String channel;
    private String purpose;
    private String codeHash;
    @Builder.Default
    private LocalDateTime expiresAt = LocalDateTime.now();
    private LocalDateTime usedAt;
    @Builder.Default
    private Integer attempts = 0;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
