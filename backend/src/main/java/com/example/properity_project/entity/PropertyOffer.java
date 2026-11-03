package com.example.properity_project.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "property_offers")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PropertyOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long enquiryId;
    private BigDecimal amount;
    private String note;
    @Builder.Default
    private String status = "OPEN";
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
