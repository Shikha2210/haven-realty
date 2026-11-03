package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "property_documents")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PropertyDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long propertyId;
    private String docType;
    private String storedName;
    private String originalName;
    private String contentType;
    @Builder.Default
    private LocalDateTime uploadedAt = LocalDateTime.now();
}
