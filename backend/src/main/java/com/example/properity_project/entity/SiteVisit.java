package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "site_visits")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SiteVisit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long enquiryId;
    @Builder.Default
    private LocalDateTime scheduledAt = LocalDateTime.now();
    @Builder.Default
    private String status = "SCHEDULED";
    private String notes;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
