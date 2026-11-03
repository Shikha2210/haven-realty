package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "verification_documents")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerificationDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long verificationId;
    private String docType;
    private String storedName;
    private String originalName;
    private String contentType;
    private Long sizeBytes;
    @Builder.Default
    private LocalDateTime uploadedAt = LocalDateTime.now();
    @Builder.Default
    private boolean superseded = false;
}
